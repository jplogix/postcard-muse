import * as fs from "node:fs";
import * as path from "node:path";

const API_BASE = "http://localhost:5000";
const SAMPLES_DIR = path.join(__dirname, "..", "server", "static", "samples");
const OUTPUT_FILE = path.join(__dirname, "sample-results.json");

interface SampleDef {
  id: string;
  title: string;
  location: string;
  language: string;
  frontImage: string;
  backImage: string;
}

const samples: SampleDef[] = [
  { id: "sample-christmas", title: "Christmas Card", location: "Dresden", language: "German", frontImage: "christmas_front.jpg", backImage: "christmas_back.jpg" },
  { id: "sample-dresden-bw", title: "Dresden Views", location: "Dresden", language: "German", frontImage: "dresden_bw_front.jpg", backImage: "dresden_bw_back.jpg" },
  { id: "sample-dresden-color", title: "Dresden to Caribbean", location: "Dresden", language: "German", frontImage: "dresden_color_front.jpg", backImage: "dresden_color_back.jpg" },
  { id: "sample-standseilbahn", title: "Dresden Railway", location: "Dresden", language: "German", frontImage: "standseilbahn_front.jpg", backImage: "standseilbahn_back.jpg" },
  { id: "sample-neujahr", title: "New Year's Card", location: "Dresden", language: "German", frontImage: "neujahr_front.jpg", backImage: "neujahr_back.jpg" },
  { id: "sample-scouts", title: "Scout Camp 1934", location: "Germany", language: "German", frontImage: "scouts_front.jpg", backImage: "scouts_back.jpg" },
  { id: "sample-deer", title: "Deer Park", location: "Germany", language: "German", frontImage: "deer_front.jpg", backImage: "deer_back.jpg" },
  { id: "sample-dresden-letter", title: "Dresden Letter 1980", location: "Dresden", language: "German", frontImage: "christmas_front.jpg", backImage: "dresden_letter_back.jpg" },
  { id: "sample-dresden-panorama", title: "Dresden Panorama", location: "Dresden", language: "German", frontImage: "dresden_panorama_front.jpg", backImage: "dresden_panorama_back.jpg" },
];

async function processOne(sample: SampleDef) {
  console.log(`Processing: ${sample.title} (${sample.id})`);

  const frontPath = path.join(SAMPLES_DIR, sample.frontImage);
  const backPath = path.join(SAMPLES_DIR, sample.backImage);

  const frontBase64 = fs.readFileSync(frontPath).toString("base64");
  const backBase64 = fs.readFileSync(backPath).toString("base64");

  const pcResp = await fetch(`${API_BASE}/api/process-postcard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frontImageBase64: frontBase64,
      backImageBase64: backBase64,
      targetLanguage: "English",
      excludeAddress: true,
    }),
  });

  if (!pcResp.ok) {
    console.error(`  ERROR: ${await pcResp.text()}`);
    return null;
  }

  const pcData = await pcResp.json();
  console.log(`  OK - ${(pcData.words || []).length} words, lang: ${pcData.detectedLanguage}`);

  return {
    id: sample.id,
    title: sample.title,
    location: sample.location,
    language: sample.language,
    frontImage: sample.frontImage,
    backImage: sample.backImage,
    originalText: pcData.originalText || "",
    translatedText: pcData.translatedText || "",
    detectedLanguage: pcData.detectedLanguage || "Unknown",
    description: pcData.description || "",
    words: pcData.words || [],
  };
}

async function main() {
  console.log(`Processing ${samples.length} samples (AI text extraction only)...\n`);

  const existing: any[] = fs.existsSync(OUTPUT_FILE)
    ? JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"))
    : [];

  const existingIds = new Set(existing.map((r: any) => r.id));
  const results = [...existing];

  for (const sample of samples) {
    if (existingIds.has(sample.id)) {
      console.log(`Skipping ${sample.id} (already processed)`);
      continue;
    }
    try {
      const result = await processOne(sample);
      if (result) {
        results.push(result);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`  Saved (${results.length} total)\n`);
      }
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}\n`);
    }
  }

  console.log(`\nDone! ${results.length}/${samples.length} saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
