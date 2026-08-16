"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const pdf_loader_1 = require("../services/pdf_loader");
const memory_1 = require("../services/memory");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});
exports.uploadRouter = (0, express_1.Router)();
exports.uploadRouter.post('/upload', upload.single('file'), async (req, res) => {
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
        const { savedPath, pdfId } = pdf_loader_1.pdfLoaderService.savePdf(file);
        // 2. Parse PDF/TXT, split into chunks, embed, store in local vector store
        const extractedData = await pdf_loader_1.pdfLoaderService.processAndIndexPdf(savedPath, pdfId, file.originalname);
        // 3. Persist metadata in SQL `pdfs` table
        const vectorStorePath = path_1.default.join('storage/vector_store', `${pdfId}.json`);
        await memory_1.memoryService.recordPdf(pdfId, file.originalname, vectorStorePath);
        // 4. Create new chat session in SQL `chat_sessions` table
        const chatSession = await memory_1.memoryService.getOrCreateSession(pdfId);
        extractedData.session_id = chatSession.id;
        res.status(200).json({
            status: 'success',
            message: 'PDF uploaded, indexed, and session created successfully.',
            data: extractedData,
        });
    }
    catch (err) {
        console.error('Upload Error:', err);
        res.status(err.status || 500).json({
            detail: err.message || 'Error processing document upload.',
        });
    }
});
