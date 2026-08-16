"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfLoaderService = exports.PDFLoaderService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const chunking_1 = require("./chunking");
const vector_store_1 = require("./vector_store");
class PDFLoaderService {
    uploadDir;
    constructor(uploadDir = 'storage/uploads') {
        this.uploadDir = path_1.default.isAbsolute(uploadDir)
            ? uploadDir
            : path_1.default.resolve(process.cwd(), uploadDir);
        if (!fs_1.default.existsSync(this.uploadDir)) {
            fs_1.default.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    savePdf(file) {
        const filenameLower = (file.originalname || '').toLowerCase();
        if (!filenameLower.endsWith('.pdf') && !filenameLower.endsWith('.txt')) {
            throw new Error('Only .pdf and .txt files are supported.');
        }
        const pdfId = `pdf_${crypto_1.default.randomBytes(5).toString('hex')}`;
        const safeFilename = `${pdfId}_${path_1.default.basename(file.originalname)}`;
        const destPath = path_1.default.join(this.uploadDir, safeFilename);
        fs_1.default.writeFileSync(destPath, file.buffer);
        return { savedPath: destPath, pdfId };
    }
    async processAndIndexPdf(filePath, pdfId, originalFilename) {
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error('File not found on server.');
        }
        let documents = [];
        let pagesData = [];
        let fullText = '';
        let totalPages = 1;
        if (filePath.toLowerCase().endsWith('.txt')) {
            const textContent = fs_1.default.readFileSync(filePath, 'utf-8');
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
        }
        else {
            const dataBuffer = fs_1.default.readFileSync(filePath);
            const pdfData = await (0, pdf_parse_1.default)(dataBuffer);
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
                }
                else {
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
        const chunkedDocs = chunking_1.chunkingService.chunkDocuments(validDocs);
        if (!chunkedDocs || chunkedDocs.length === 0) {
            throw new Error('Could not generate text chunks from the file.');
        }
        const chunksSummary = chunking_1.chunkingService.formatChunksSummary(chunkedDocs);
        const vectorIndexResult = await vector_store_1.vectorStoreManager.createVectorIndex(chunkedDocs, pdfId);
        const previewText = fullText.slice(0, 400).trim() + (fullText.length > 400 ? '...' : '');
        return {
            pdf_id: pdfId,
            filename: originalFilename,
            file_path: filePath,
            total_pages: totalPages,
            total_characters: fullText.length,
            total_chunks: chunkedDocs.length,
            chunk_size: chunking_1.chunkingService.chunk_size,
            chunk_overlap: chunking_1.chunkingService.chunk_overlap,
            vector_db: vectorIndexResult.vector_db,
            indexed_vectors: vectorIndexResult.indexed_chunks,
            preview_text: previewText,
            chunks: chunksSummary,
            pages: pagesData,
        };
    }
}
exports.PDFLoaderService = PDFLoaderService;
exports.pdfLoaderService = new PDFLoaderService();
