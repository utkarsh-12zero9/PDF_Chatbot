"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorStoreManager = exports.VectorStoreManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const embedding_1 = require("./embedding");
dotenv_1.default.config();
class VectorStoreManager {
    storageDir;
    constructor(storageDir = 'storage/vector_store') {
        this.storageDir = path_1.default.isAbsolute(storageDir)
            ? storageDir
            : path_1.default.resolve(process.cwd(), storageDir);
        if (!fs_1.default.existsSync(this.storageDir)) {
            fs_1.default.mkdirSync(this.storageDir, { recursive: true });
        }
    }
    getStorePath(pdfId) {
        return path_1.default.join(this.storageDir, `${pdfId}.json`);
    }
    async createVectorIndex(documents, pdfId) {
        if (!documents || documents.length === 0) {
            throw new Error('No document chunks provided for vector indexing.');
        }
        const contents = documents.map((d) => d.page_content);
        const embeddings = await embedding_1.embeddingService.embedDocuments(contents);
        const indexedDocs = documents.map((doc, idx) => ({
            page_content: doc.page_content,
            metadata: doc.metadata,
            embedding: embeddings[idx] || [],
        }));
        const storePath = this.getStorePath(pdfId);
        fs_1.default.writeFileSync(storePath, JSON.stringify(indexedDocs, null, 2), 'utf-8');
        return {
            pdf_id: pdfId,
            vector_db: 'local',
            indexed_chunks: documents.length,
            store_path: storePath,
        };
    }
    getVectorStore(pdfId) {
        const storePath = this.getStorePath(pdfId);
        if (!fs_1.default.existsSync(storePath)) {
            return null;
        }
        try {
            const raw = fs_1.default.readFileSync(storePath, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async similaritySearch(query, pdfId, k = 4) {
        const indexedDocs = this.getVectorStore(pdfId);
        if (!indexedDocs || indexedDocs.length === 0) {
            return [];
        }
        const queryVec = await embedding_1.embeddingService.embedQuery(query);
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
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0)
            return 0;
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
        if (denominator === 0)
            return 0;
        return dot / denominator;
    }
}
exports.VectorStoreManager = VectorStoreManager;
exports.vectorStoreManager = new VectorStoreManager();
