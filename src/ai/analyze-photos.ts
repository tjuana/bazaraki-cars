import { getGroqClient, getClient, GROQ_VISION_MODEL, GEMINI_MODEL } from './client.js';

const PHOTO_SYSTEM = `You are an expert used car inspector analyzing photos of a vehicle for a buyer in Cyprus.

Look carefully at each photo and identify:
1. **Bodywork issues**: dents, scratches, rust, panel gaps, misaligned panels
2. **Paint issues**: color mismatches between panels (sign of repainting after accident), orange peel, overspray
3. **Accident signs**: repainted panels, replaced parts, uneven gaps, structural damage
4. **Interior condition**: wear, damage, cleanliness
5. **Tires & wheels**: wear level, damage, alloy condition
6. **Under-hood**: if visible — fluid leaks, corrosion, non-original parts
7. **General condition**: does it match the claimed mileage and year?

Be specific about which panel/area you see issues. If photos are too small or blurry to assess something, say so.
If everything looks clean, say that clearly too — don't invent problems.`;

const AUCTION_SHEET_SYSTEM = `You are an expert at reading Japanese car auction inspection sheets (オークション評価表).

Read EVERYTHING on this auction sheet. Extract every single readable field, stamp, mark, and note.
Transcribe all Japanese text with English translation in parentheses.

Return a JSON object with:
- "rawText": full transcription of everything you can read on the sheet, line by line
- "fields": object with ALL extracted fields, including but not limited to:
  - grade, interiorGrade, exteriorGrade
  - mileage (走行距離), mileageUnit
  - repairHistory (修復歴: あり=yes, なし=no)
  - auction name, date, lot number
  - chassis/frame number, model code
  - color, engine type, displacement, transmission
  - equipment/options (装備)
  - registration date, expiry
  - any other fields visible
- "damageMarks": array of all damage marks from the body diagram with panel locations
  (A=scratch, U/E=dent, W=wave/ripple, S=rust, X=crack, P=paint, XX=replaced panel)
- "redFlags": array of any concerns (low grade, repair history, mileage discrepancy, heavy damage marks, etc.)

Be thorough — this is the most valuable document for the buyer.`;

export interface AuctionSheetData {
  rawText: string;
  fields: Record<string, string>;
  damageMarks: string[];
  redFlags: string[];
}

export interface PhotoAnalysisResult {
  overallCondition: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  positives: string[];
  accidentSuspicion: 'none' | 'low' | 'medium' | 'high';
  summary: string;
  auctionSheet: AuctionSheetData | null;
}

const GROQ_BATCH_SIZE = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

const CONDITION_RANK: Record<string, number> = { excellent: 0, good: 1, fair: 2, poor: 3 };
const SUSPICION_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };

function mergeResults(carResult: PhotoAnalysisResult, sheetResult: AuctionSheetData | null): PhotoAnalysisResult {
  return { ...carResult, auctionSheet: sheetResult };
}

// ── Step 1: Classify which photos are auction sheets ────────────────────────

async function classifyPhotos(dataUrls: string[]): Promise<{ carPhotos: string[]; sheetPhotos: string[] }> {
  const groq = getGroqClient();

  // Send first photo of each to classify — but limit to 5 at a time
  // Simple heuristic: send all in one request, ask which indices are sheets
  const batch = dataUrls.slice(0, GROQ_BATCH_SIZE);
  const remaining = dataUrls.slice(GROQ_BATCH_SIZE);

  const imageContent = batch.map((url, i) => ({
    type: 'image_url' as const,
    image_url: { url },
  }));

  try {
    const result = await groq.chat.completions.create({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Look at these ${batch.length} images. Which ones are Japanese auction inspection sheets (paper documents with Japanese text, grades, body diagrams)? Return JSON only: {"sheetIndices": [0, 2]} — array of 0-based indices that are auction sheets. If none, return {"sheetIndices": []}`,
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const raw = JSON.parse(result.choices[0]?.message?.content ?? '{}');
    const sheetIndices = new Set<number>(raw.sheetIndices ?? []);

    const carPhotos: string[] = [];
    const sheetPhotos: string[] = [];

    batch.forEach((url, i) => {
      if (sheetIndices.has(i)) {
        sheetPhotos.push(url);
      } else {
        carPhotos.push(url);
      }
    });

    // Remaining photos beyond first batch — assume car photos
    carPhotos.push(...remaining);

    return { carPhotos, sheetPhotos };
  } catch {
    // Classification failed — treat all as car photos
    return { carPhotos: dataUrls, sheetPhotos: [] };
  }
}

// ── Step 2: Analyze car photos with Groq ────────────────────────────────────

async function analyzeCarPhotos(urls: string[]): Promise<PhotoAnalysisResult> {
  if (urls.length === 0) {
    return {
      overallCondition: 'good',
      issues: [],
      positives: [],
      accidentSuspicion: 'none',
      summary: 'No car photos to analyze.',
      auctionSheet: null,
    };
  }

  const batches = chunk(urls, GROQ_BATCH_SIZE);
  const results: PhotoAnalysisResult[] = [];

  for (const batch of batches) {
    results.push(await analyzeCarBatchGroq(batch));
  }

  if (results.length === 1) return results[0];

  const issues = results.flatMap((r) => r.issues);
  const positives = results.flatMap((r) => r.positives);
  const overallCondition = results.reduce((worst, r) =>
    (CONDITION_RANK[r.overallCondition] ?? 1) > (CONDITION_RANK[worst] ?? 1) ? r.overallCondition : worst,
    results[0].overallCondition,
  );
  const accidentSuspicion = results.reduce((worst, r) =>
    (SUSPICION_RANK[r.accidentSuspicion] ?? 0) > (SUSPICION_RANK[worst] ?? 0) ? r.accidentSuspicion : worst,
    results[0].accidentSuspicion,
  );
  const summary = results.map((r) => r.summary).join(' ');

  return { overallCondition, issues, positives, accidentSuspicion, summary, auctionSheet: null };
}

async function analyzeCarBatchGroq(urls: string[]): Promise<PhotoAnalysisResult> {
  const groq = getGroqClient();

  const imageContent = urls.map((url) => ({
    type: 'image_url' as const,
    image_url: { url },
  }));

  const result = await groq.chat.completions.create({
    model: GROQ_VISION_MODEL,
    messages: [
      { role: 'system', content: PHOTO_SYSTEM },
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `Analyze these ${urls.length} car photos. Respond with JSON only:
{
  "overallCondition": "excellent|good|fair|poor",
  "issues": ["list of problems found"],
  "positives": ["list of good points"],
  "accidentSuspicion": "none|low|medium|high",
  "summary": "2-3 sentence overall assessment"
}`,
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const raw = JSON.parse(result.choices[0]?.message?.content ?? '{}');
  return {
    overallCondition: raw.overallCondition ?? 'good',
    issues: raw.issues ?? [],
    positives: raw.positives ?? [],
    accidentSuspicion: raw.accidentSuspicion ?? 'none',
    summary: raw.summary ?? 'Analysis unavailable.',
    auctionSheet: null,
  };
}

// ── Step 3: Read auction sheets with Gemini ─────────────────────────────────

async function analyzeAuctionSheets(dataUrls: string[]): Promise<AuctionSheetData | null> {
  if (dataUrls.length === 0 || !process.env.GEMINI_API_KEY) return null;

  const model = getClient().getGenerativeModel({ model: GEMINI_MODEL });

  // Convert data URLs to Gemini inline format
  const imageParts = dataUrls.map((dataUrl) => {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) return null;
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }).filter(Boolean) as { inlineData: { mimeType: string; data: string } }[];

  if (imageParts.length === 0) return null;

  const prompt = `${AUCTION_SHEET_SYSTEM}\n\nRead this auction sheet carefully. Return JSON only:
{
  "rawText": "complete transcription of everything on the sheet",
  "fields": {"grade": "...", "interiorGrade": "...", "...": "every field you can read"},
  "damageMarks": ["mark + location"],
  "redFlags": ["any concerns"]
}`;

  try {
    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text();
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    const raw = JSON.parse(cleaned);
    return {
      rawText: raw.rawText ?? '',
      fields: raw.fields ?? {},
      damageMarks: raw.damageMarks ?? [],
      redFlags: raw.redFlags ?? [],
    };
  } catch (err) {
    console.error('[auction-sheet-ocr]', (err as Error).message);
    return null;
  }
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function analyzePhotos(imageUrls: string[]): Promise<PhotoAnalysisResult> {
  if (imageUrls.length === 0) {
    return {
      overallCondition: 'good',
      issues: [],
      positives: [],
      accidentSuspicion: 'none',
      summary: 'No photos available to analyze.',
      auctionSheet: null,
    };
  }

  // 1. Classify: which are auction sheets, which are car photos
  const { carPhotos, sheetPhotos } = await classifyPhotos(imageUrls);

  // 2. Run in parallel: car photos → Groq, auction sheets → Gemini
  const [carResult, sheetResult] = await Promise.all([
    analyzeCarPhotos(carPhotos),
    analyzeAuctionSheets(sheetPhotos),
  ]);

  // 3. Merge
  return mergeResults(carResult, sheetResult);
}
