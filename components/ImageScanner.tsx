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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
  }

  void main() {
    float scanPos = fract(uTime * uScanSpeed);
    float dist = abs(vUv.y - scanPos);
    float bandWide = smoothstep(0.12, 0.0, dist);
    float bandCore = smoothstep(0.025, 0.0, dist);

    float distortion = bandWide * 0.008 * sin(vUv.y * 80.0 + uTime * 12.0);
    vec2 uv = vUv;
    uv.x += distortion;

    vec4 texColor = texture2D(uTexture, uv);

    // Flickering grid overlay
    float gridSize = 20.0;
    vec2 cellId = floor(uv * gridSize);
    vec2 cellUv = fract(uv * gridSize);
    float cellGap = 0.08;
    float inCell = step(cellGap, cellUv.x) * step(cellGap, cellUv.y)
                 * (1.0 - step(1.0 - cellGap, cellUv.x)) * (1.0 - step(1.0 - cellGap, cellUv.y));

    float cellSeed = hash(cellId);
    float flickerRate = 0.5 + cellSeed * 2.5;
    float flickerPhase = cellSeed * 6.2831;
    float flickerVal = sin(uTime * flickerRate + flickerPhase) * 0.5 + 0.5;
    float randomThreshold = hash2(cellId + floor(uTime * 0.8));
    float cellOn = step(0.55, flickerVal * 0.7 + randomThreshold * 0.3);
    float cellAlpha = cellOn * (0.04 + 0.06 * flickerVal);
    float bandBoost = bandWide * 0.12;
    cellAlpha += bandBoost * cellOn;
    vec3 gridColor = uGlowColor * cellAlpha * inCell;

    // Grid border lines
    float lineX = step(0.97, fract(uv.x * gridSize));
    float lineY = step(0.97, fract(uv.y * gridSize));
    float gridLine = max(lineX, lineY) * 0.03;
    vec3 lineColor = uGlowColor * gridLine;

    float noise = hash(vec2(floor(uv.x * 60.0), floor(uv.y * 60.0) + uTime * 6.0));
    float flicker = bandWide * noise * 0.15;

    vec3 glow = uGlowColor * bandWide * 0.45;
    vec3 bloom = uGlowColor * bandCore * 0.6;
    float brightnessBoost = bandWide * 0.12;

    vec3 finalColor = texColor.rgb;
    finalColor += gridColor;
    finalColor += lineColor;
    finalColor += glow;
    finalColor += bloom;
    finalColor += vec3(flicker) * uGlowColor;
    finalColor += vec3(brightnessBoost);

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
