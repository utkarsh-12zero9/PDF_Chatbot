"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddingService = exports.EmbeddingService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const inference_1 = require("@huggingface/inference");
dotenv_1.default.config();
class EmbeddingService {
    hfToken;
    modelName;
    hfClient = null;
    embeddingDim = 384;
    constructor() {
        this.hfToken = (process.env.HUGGINGFACEHUB_API_TOKEN || '').trim();
        this.modelName = (process.env.HUGGINGFACE_EMBEDDING_MODEL ||
            'sentence-transformers/all-MiniLM-L6-v2').trim();
        if (this.hfToken) {
            this.hfClient = new inference_1.HfInference(this.hfToken);
        }
    }
    async embedQuery(text) {
        const embeddings = await this.embedDocuments([text]);
        return embeddings[0] || this.fallbackEmbed(text);
    }
    async embedDocuments(texts) {
        if (this.hfClient && this.hfToken) {
            try {
                const results = [];
                for (const text of texts) {
                    const res = await this.hfClient.featureExtraction({
                        model: this.modelName,
                        inputs: text,
                    });
                    if (Array.isArray(res)) {
                        let vec = [];
                        if (typeof res[0] === 'number') {
                            vec = res;
                        }
                        else if (Array.isArray(res[0])) {
                            // Mean pooling if 2D matrix returned
                            const matrix = res;
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
            }
            catch (err) {
                console.warn(`HuggingFace Embedding API error: ${err}. Using local vector embedding fallback.`);
            }
        }
        return texts.map((t) => this.fallbackEmbed(t));
    }
    fallbackEmbed(text) {
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
    normalizeVector(vec) {
        let normSq = 0;
        for (const v of vec) {
            normSq += v * v;
        }
        const norm = Math.sqrt(normSq);
        if (norm === 0)
            return vec;
        return vec.map((v) => v / norm);
    }
}
exports.EmbeddingService = EmbeddingService;
exports.embeddingService = new EmbeddingService();
