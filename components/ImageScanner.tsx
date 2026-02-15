import React, { useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import {
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  TextureLoader,
  Texture,
  ClampToEdgeWrapping,
  LinearFilter,
  IUniform,
} from "three";

interface ImageScannerProps {
  imageUrl: string;
  scanSpeed?: number;
  glowColor?: [number, number, number];
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uScanSpeed;
  uniform vec3 uGlowColor;

  varying vec2 vUv;

  // Simple pseudo-random noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // Scan band position: loops bottom to top
    float scanPos = fract(uTime * uScanSpeed);

    // Distance from scan band center
    float dist = abs(vUv.y - scanPos);

    // Smooth band falloff (wider = 0.08, core = 0.02)
    float bandWide = smoothstep(0.12, 0.0, dist);
    float bandCore = smoothstep(0.025, 0.0, dist);

    // Horizontal UV distortion inside the scan band
    float distortion = bandWide * 0.008 * sin(vUv.y * 80.0 + uTime * 12.0);
    vec2 uv = vUv;
    uv.x += distortion;

    // Sample the postcard texture
    vec4 texColor = texture2D(uTexture, uv);

    // Grid overlay: thin lines blended behind image
    float gridX = step(0.98, fract(uv.x * 30.0));
    float gridY = step(0.98, fract(uv.y * 30.0));
    float grid = max(gridX, gridY) * 0.06;
    vec3 gridColor = vec3(grid) * uGlowColor;

    // Flicker noise inside the band to simulate AI analysis
    float noise = hash(vec2(floor(uv.x * 60.0), floor(uv.y * 60.0) + uTime * 6.0));
    float flicker = bandWide * noise * 0.15;

    // Neon glow: bright cyan/blue where band passes
    vec3 glow = uGlowColor * bandWide * 0.45;

    // Fake bloom: extra brightness at core of band
    vec3 bloom = uGlowColor * bandCore * 0.6;

    // Slight brightness boost in scan region
    float brightnessBoost = bandWide * 0.12;

    // Compose final color
    vec3 finalColor = texColor.rgb;
    finalColor += gridColor;
    finalColor += glow;
    finalColor += bloom;
    finalColor += vec3(flicker) * uGlowColor;
    finalColor += vec3(brightnessBoost);

    // Subtle vignette for depth
    float vig = 1.0 - 0.3 * length((vUv - 0.5) * 1.4);
    finalColor *= vig;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function ImageScanner({
  imageUrl,
  scanSpeed = 0.15,
  glowColor = [0.2, 0.8, 1.0],
}: ImageScannerProps) {
  const timeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const textureRef = useRef<Texture | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const meshRef = useRef<Mesh | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
      if (meshRef.current && sceneRef.current) {
        sceneRef.current.remove(meshRef.current);
        meshRef.current.geometry.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      if (!mountedRef.current) return;

      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;

      const scene = new Scene();
      sceneRef.current = scene;

      const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 1;

      const loader = new TextureLoader();
      const texture = await new Promise<Texture>((resolve, reject) => {
        loader.load(
          imageUrl,
          (tex) => resolve(tex),
          undefined,
          (err) => reject(err)
        );
      });

      if (!mountedRef.current) {
        texture.dispose();
        return;
      }

      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      textureRef.current = texture;

      const uniforms: Record<string, IUniform> = {
        uTexture: { value: texture },
        uTime: { value: 0.0 },
        uScanSpeed: { value: scanSpeed },
        uGlowColor: { value: glowColor },
      };

      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
      });
      materialRef.current = material;

      const geometry = new PlaneGeometry(2, 2);
      const mesh = new Mesh(geometry, material);
      meshRef.current = mesh;
      scene.add(mesh);

      let lastTime = performance.now();

      const animate = () => {
        if (!mountedRef.current) return;
        rafRef.current = requestAnimationFrame(animate);

        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        timeRef.current += delta;

        material.uniforms.uTime.value = timeRef.current;

        renderer.render(scene, camera);
        gl.endFrameEXP();
      };

      rafRef.current = requestAnimationFrame(animate);
    },
    [imageUrl, scanSpeed, glowColor]
  );

  if (Platform.OS === "web") {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
        msaaSamples={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 16,
    overflow: "hidden",
  },
  glView: {
    flex: 1,
  },
});
