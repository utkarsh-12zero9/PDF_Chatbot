import { DocumentChunk } from './chunking';
import { vectorStoreManager } from './vector_store';

export class RetrieverService {
  public defaultK: number;

  constructor(defaultK: number = 4) {
    this.defaultK = defaultK;
  }

  public async getTopKChunks(
    query: string,
    pdfId: string,
    k?: number
  ): Promise<DocumentChunk[]> {
    const topK = k !== undefined ? k : this.defaultK;
    return vectorStoreManager.similaritySearch(query, pdfId, topK);
  }

  public formatRetrievedChunks(docs: DocumentChunk[]): Array<{
    rank: number;
    content: string;
    metadata: Record<string, any>;
  }> {
    return docs.map((doc, idx) => ({
      rank: idx + 1,
      content: doc.page_content,
      metadata: doc.metadata,
    }));
  }
}

export const retrieverService = new RetrieverService(4);
