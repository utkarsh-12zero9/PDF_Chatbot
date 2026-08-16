"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieverService = exports.RetrieverService = void 0;
const vector_store_1 = require("./vector_store");
class RetrieverService {
    defaultK;
    constructor(defaultK = 4) {
        this.defaultK = defaultK;
    }
    async getTopKChunks(query, pdfId, k) {
        const topK = k !== undefined ? k : this.defaultK;
        return vector_store_1.vectorStoreManager.similaritySearch(query, pdfId, topK);
    }
    formatRetrievedChunks(docs) {
        return docs.map((doc, idx) => ({
            rank: idx + 1,
            content: doc.page_content,
            metadata: doc.metadata,
        }));
    }
}
exports.RetrieverService = RetrieverService;
exports.retrieverService = new RetrieverService(4);
