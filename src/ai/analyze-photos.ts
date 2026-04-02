import { getGroqClient, getClient, getProvider, GROQ_VISION_MODEL, GEMINI_MODEL } from './client.js';

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

export interface PhotoAnalysisResult {
  overallCondition: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  positives: string[];
  accidentSuspicion: 'none' | 'low' | 'medium' | 'high';
  summary: string;
}

export async function analyzePhotos(imageUrls: string[]): Promise<PhotoAnalysisResult> {
  // Take up to 6 photos (avoid token limits)
  const urls = imageUrls.slice(0, 6);
  if (urls.length === 0) {
    return {
      overallCondition: 'good',
      issues: [],
      positives: [],
      accidentSuspicion: 'none',
      summary: 'No photos available to analyze.',
    };
  }

  const provider = getProvider();

  if (provider === 'groq') {
    return analyzeWithGroqVision(urls);
  }
  return analyzeWithGeminiVision(urls);
}

async function analyzeWithGroqVision(urls: string[]): Promise<PhotoAnalysisResult> {
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
  };
}

async function analyzeWithGeminiVision(urls: string[]): Promise<PhotoAnalysisResult> {
  const model = getClient().getGenerativeModel({ model: GEMINI_MODEL });

  // Fetch images and convert to base64
  const imageParts = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
      return { inlineData: { data: base64, mimeType } };
    })
  );

  const prompt = `${PHOTO_SYSTEM}\n\nAnalyze these ${urls.length} car photos. Respond with JSON only:
{
  "overallCondition": "excellent|good|fair|poor",
  "issues": ["list of problems found"],
  "positives": ["list of good points"],
  "accidentSuspicion": "none|low|medium|high",
  "summary": "2-3 sentence overall assessment"
}`;

  const result = await model.generateContent([prompt, ...imageParts]);
  const raw = JSON.parse(result.response.text());
  return {
    overallCondition: raw.overallCondition ?? 'good',
    issues: raw.issues ?? [],
    positives: raw.positives ?? [],
    accidentSuspicion: raw.accidentSuspicion ?? 'none',
    summary: raw.summary ?? 'Analysis unavailable.',
  };
}
