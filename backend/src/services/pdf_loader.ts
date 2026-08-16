import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import { chunkingService, DocumentChunk } from './chunking';
import { vectorStoreManager } from './vector_store';

export class PDFLoaderService {
  public uploadDir: string;

  constructor(uploadDir: string = 'storage/uploads') {
    this.uploadDir = path.isAbsolute(uploadDir)
      ? uploadDir
      : path.resolve(process.cwd(), uploadDir);

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public savePdf(file: Express.Multer.File): { savedPath: string; pdfId: string } {
    const filenameLower = (file.originalname || '').toLowerCase();
    if (!filenameLower.endsWith('.pdf') && !filenameLower.endsWith('.txt')) {
      throw new Error('Only .pdf and .txt files are supported.');
    }

    const pdfId = `pdf_${crypto.randomBytes(5).toString('hex')}`;
    const safeFilename = `${pdfId}_${path.basename(file.originalname)}`;
    const destPath = path.join(this.uploadDir, safeFilename);

    fs.writeFileSync(destPath, file.buffer);
    return { savedPath: destPath, pdfId };
  }

  public async processAndIndexPdf(
    filePath: string,
    pdfId: string,
    originalFilename: string
  ): Promise<Record<string, any>> {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found on server.');
    }

    let documents: DocumentChunk[] = [];
    let pagesData: Array<{ page_number: number; character_count: number; content: string }> = [];
    let fullText = '';
    let totalPages = 1;

    if (filePath.toLowerCase().endsWith('.txt')) {
      const textContent = fs.readFileSync(filePath, 'utf-8');
      if (textContent.trim()) {
        fullText = textContent.trim();
        documents.push({
          page_content: fullText,
          metadata: { source: filePath, page: 0 },
        });
        pagesData.push({
          page_number: 1,
          character_count: fullText.length,
          content: fullText,
        });
      }
    } else {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      totalPages = pdfData.numpages || 1;
      fullText = (pdfData.text || '').trim();

      if (fullText) {
        // Break parsed text into rough page segments if available or single page doc
        const pageTextBlocks = fullText.split(/\n\s*\n\s*\n/).filter((t) => t.trim().length > 0);
        
        if (pageTextBlocks.length > 1 && pageTextBlocks.length === totalPages) {
          pageTextBlocks.forEach((textBlock, idx) => {
            const pageContent = textBlock.trim();
            documents.push({
              page_content: pageContent,
              metadata: { source: filePath, page: idx },
            });
            pagesData.push({
              page_number: idx + 1,
              character_count: pageContent.length,
              content: pageContent,
            });
          });
        } else {
          documents.push({
            page_content: fullText,
            metadata: { source: filePath, page: 0 },
          });
          pagesData.push({
            page_number: 1,
            character_count: fullText.length,
            content: fullText,
          });
        }
      }
    }

    const validDocs = documents.filter((doc) => doc.page_content && doc.page_content.trim());
    if (validDocs.length === 0) {
      throw new Error('The uploaded document contains no extractable text.');
    }

    for (const doc of validDocs) {
      doc.metadata.pdf_id = pdfId;
      doc.metadata.filename = originalFilename;
    }

    const chunkedDocs = chunkingService.chunkDocuments(validDocs);
    if (!chunkedDocs || chunkedDocs.length === 0) {
      throw new Error('Could not generate text chunks from the file.');
    }

    const chunksSummary = chunkingService.formatChunksSummary(chunkedDocs);
    const vectorIndexResult = await vectorStoreManager.createVectorIndex(chunkedDocs, pdfId);

    const previewText = fullText.slice(0, 400).trim() + (fullText.length > 400 ? '...' : '');

    return {
      pdf_id: pdfId,
      filename: originalFilename,
      file_path: filePath,
      total_pages: totalPages,
      total_characters: fullText.length,
      total_chunks: chunkedDocs.length,
      chunk_size: chunkingService.chunk_size,
      chunk_overlap: chunkingService.chunk_overlap,
      vector_db: vectorIndexResult.vector_db,
      indexed_vectors: vectorIndexResult.indexed_chunks,
      preview_text: previewText,
      chunks: chunksSummary,
      pages: pagesData,
    };
  }
}

export const pdfLoaderService = new PDFLoaderService();
