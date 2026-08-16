import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { pdfLoaderService } from '../services/pdf_loader';
import { memoryService } from '../services/memory';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

export const uploadRouter = Router();

uploadRouter.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ detail: 'No file provided.' });
        return;
      }

      const filenameLower = (file.originalname || '').toLowerCase();
      if (!filenameLower.endsWith('.pdf') && !filenameLower.endsWith('.txt')) {
        res.status(400).json({
          detail: 'Invalid file type. Please upload a .pdf or .txt file.',
        });
        return;
      }

      // 1. Save file to storage
      const { savedPath, pdfId } = pdfLoaderService.savePdf(file);

      // 2. Parse PDF/TXT, split into chunks, embed, store in local vector store
      const extractedData = await pdfLoaderService.processAndIndexPdf(
        savedPath,
        pdfId,
        file.originalname
      );

      // 3. Persist metadata in SQL `pdfs` table
      const vectorStorePath = path.join('storage/vector_store', `${pdfId}.json`);
      await memoryService.recordPdf(
        pdfId,
        file.originalname,
        vectorStorePath
      );

      // 4. Create new chat session in SQL `chat_sessions` table
      const chatSession = await memoryService.getOrCreateSession(pdfId);

      extractedData.session_id = chatSession.id;

      res.status(200).json({
        status: 'success',
        message: 'PDF uploaded, indexed, and session created successfully.',
        data: extractedData,
      });
    } catch (err: any) {
      console.error('Upload Error:', err);
      res.status(err.status || 500).json({
        detail: err.message || 'Error processing document upload.',
      });
    }
  }
);
