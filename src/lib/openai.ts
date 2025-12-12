import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function splitTextIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (!text || typeof text !== 'string' || text.length === 0) {
    return [];
  }
  
  if (chunkSize <= 0) {
    chunkSize = 1000;
  }
  
  if (overlap < 0 || overlap >= chunkSize) {
    overlap = Math.min(200, Math.floor(chunkSize / 5));
  }
  
  const maxChunks = 10000;
  const chunks: string[] = [];
  let start = 0;
  let iterations = 0;
  
  while (start < text.length && iterations < maxChunks) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end);
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    const nextStart = end - overlap;
    if (nextStart <= start || nextStart >= text.length) {
      break;
    }
    start = nextStart;
    iterations++;
  }
  
  if (chunks.length === 0 && text.length > 0) {
    chunks.push(text.substring(0, Math.min(chunkSize, text.length)));
  }
  
  return chunks;
}
