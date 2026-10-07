import { createHash } from 'node:crypto';

export interface LayaQuestionDefinition {
  type: 'noul' | 'score' | 'choice';
  instructions: string;
  criteria?: string[] | Record<string, string>;
}

export interface LayaPredictionRequest {
  state: Record<string, any>;
  questions: Record<string, LayaQuestionDefinition>;
}

export interface LayaPredictionResult {
  answers: Record<string, any>;
  routing?: any;
  latency_ms?: number;
}

// In-memory cache for Laya decisions during a single process run
const layaCache = new Map<string, LayaPredictionResult>();

export async function layaPredict(
  input: LayaPredictionRequest,
  url = 'http://192.168.20.252:8321/predict',
  maxRetries = 2
): Promise<LayaPredictionResult> {
  const cacheKey = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  if (layaCache.has(cacheKey)) {
    return layaCache.get(cacheKey)!;
  }

  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt <= maxRetries) {
    try {
      const startTime = Date.now();
      const result = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      
      if (!result.ok) {
        throw new Error(`Laya predict failed: ${result.statusText} - ${await result.text()}`);
      }
      
      const data = await result.json() as LayaPredictionResult;
      
      // Observability
      const elapsed = Date.now() - startTime;
      console.log(`[Laya] Prediction succeeded in ${elapsed}ms (Attempt ${attempt + 1})`);
      
      layaCache.set(cacheKey, data);
      return data;
    } catch (err) {
      lastError = err as Error;
      attempt++;
      if (attempt <= maxRetries) {
        const delay = Math.pow(2, attempt) * 100;
        console.warn(`[Laya] Prediction failed, retrying in ${delay}ms... (Attempt ${attempt})`, lastError.message);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  
  console.error(`[Laya] All ${maxRetries + 1} prediction attempts failed.`);
  throw lastError;
}
