import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { DocumentChunk } from './chunking';
import { embeddingService } from './embedding';

dotenv.config();

export interface IndexedVectorDoc {
  page_content: string;
  metadata: Record<string, any>;
  embedding: number[];
}

export class VectorStoreManager {
  private storageDir: string;

  constructor(storageDir: string = 'storage/vector_store') {
    this.storageDir = path.isAbsolute(storageDir)
      ? storageDir
      : path.resolve(process.cwd(), storageDir);

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getStorePath(pdfId: string): string {
    return path.join(this.storageDir, `${pdfId}.json`);
  }

  public async createVectorIndex(
    documents: DocumentChunk[],
    pdfId: string
  ): Promise<{
    pdf_id: string;
    vector_db: string;
    indexed_chunks: number;
    store_path: string;
  }> {
    if (!documents || documents.length === 0) {
      throw new Error('No document chunks provided for vector indexing.');
    }

    const contents = documents.map((d) => d.page_content);
    const embeddings = await embeddingService.embedDocuments(contents);

    const indexedDocs: IndexedVectorDoc[] = documents.map((doc, idx) => ({
      page_content: doc.page_content,
      metadata: doc.metadata,
      embedding: embeddings[idx] || [],
    }));

    const storePath = this.getStorePath(pdfId);
    fs.writeFileSync(storePath, JSON.stringify(indexedDocs, null, 2), 'utf-8');

    return {
      pdf_id: pdfId,
      vector_db: 'local',
      indexed_chunks: documents.length,
      store_path: storePath,
    };
  }

  public getVectorStore(pdfId: string): IndexedVectorDoc[] | null {
    const storePath = this.getStorePath(pdfId);
    if (!fs.existsSync(storePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(storePath, 'utf-8');
      return JSON.parse(raw) as IndexedVectorDoc[];
    } catch {
      return null;
    }
  }

  public async similaritySearch(
    query: string,
    pdfId: string,
    k: number = 4
  ): Promise<DocumentChunk[]> {
    const indexedDocs = this.getVectorStore(pdfId);
    if (!indexedDocs || indexedDocs.length === 0) {
      return [];
    }

    const queryVec = await embeddingService.embedQuery(query);

    const scored = indexedDocs.map((doc) => {
      const score = this.cosineSimilarity(queryVec, doc.embedding);
      return { doc, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const topK = scored.slice(0, k);

    return topK.map((item) => ({
      page_content: item.doc.page_content,
      metadata: item.doc.metadata,
    }));
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    const len = Math.min(vecA.length, vecB.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    return dot / denominator;
  }
}

export const vectorStoreManager = new VectorStoreManager();
