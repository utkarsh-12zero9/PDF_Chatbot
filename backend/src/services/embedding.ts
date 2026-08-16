import dotenv from 'dotenv';
import { HfInference } from '@huggingface/inference';

dotenv.config();

export class EmbeddingService {
  private hfToken: string;
  private modelName: string;
  private hfClient: HfInference | null = null;
  private embeddingDim: number = 384;

  constructor() {
    this.hfToken = (process.env.HUGGINGFACEHUB_API_TOKEN || '').trim();
    this.modelName = (
      process.env.HUGGINGFACE_EMBEDDING_MODEL ||
      'sentence-transformers/all-MiniLM-L6-v2'
    ).trim();

    if (this.hfToken) {
      this.hfClient = new HfInference(this.hfToken);
    }
  }

  public async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedDocuments([text]);
    return embeddings[0] || this.fallbackEmbed(text);
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    if (this.hfClient && this.hfToken) {
      try {
        const results: number[][] = [];
        for (const text of texts) {
          const res = await this.hfClient.featureExtraction({
            model: this.modelName,
            inputs: text,
          });

          if (Array.isArray(res)) {
            let vec: number[] = [];
            if (typeof res[0] === 'number') {
              vec = res as number[];
            } else if (Array.isArray(res[0])) {
              // Mean pooling if 2D matrix returned
              const matrix = res as number[][];
              const cols = matrix[0].length;
              vec = new Array(cols).fill(0);
              for (const row of matrix) {
                for (let c = 0; c < cols; c++) {
                  vec[c] += row[c];
                }
              }
              for (let c = 0; c < cols; c++) {
                vec[c] /= matrix.length;
              }
            }
            if (vec.length > 0) {
              results.push(this.normalizeVector(vec));
              continue;
            }
          }
          results.push(this.fallbackEmbed(text));
        }
        return results;
      } catch (err) {
        console.warn(`HuggingFace Embedding API error: ${err}. Using local vector embedding fallback.`);
      }
    }

    return texts.map((t) => this.fallbackEmbed(t));
  }

  private fallbackEmbed(text: string): number[] {
    const vec = new Array(this.embeddingDim).fill(0);
    const words = text.toLowerCase().match(/\w+/g) || [];

    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this.embeddingDim;
      vec[idx] += 1;
    }

    return this.normalizeVector(vec);
  }

  private normalizeVector(vec: number[]): number[] {
    let normSq = 0;
    for (const v of vec) {
      normSq += v * v;
    }
    const norm = Math.sqrt(normSq);
    if (norm === 0) return vec;
    return vec.map((v) => v / norm);
  }
}

export const embeddingService = new EmbeddingService();
