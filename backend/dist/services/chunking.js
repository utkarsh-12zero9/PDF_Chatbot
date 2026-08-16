"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkingService = exports.ChunkingService = void 0;
class ChunkingService {
    chunk_size;
    chunk_overlap;
    separators;
    constructor(chunkSize = 1000, chunkOverlap = 200) {
        this.chunk_size = chunkSize;
        this.chunk_overlap = chunkOverlap;
        this.separators = ["\n\n", "\n", " ", ""];
    }
    chunkDocuments(documents) {
        const nonPassageDocs = documents.filter((doc) => doc.page_content && doc.page_content.trim().length > 0);
        if (nonPassageDocs.length === 0)
            return [];
        const result = [];
        let globalChunkIdx = 0;
        for (const doc of nonPassageDocs) {
            const textChunks = this.splitText(doc.page_content);
            for (const textChunk of textChunks) {
                result.push({
                    page_content: textChunk,
                    metadata: {
                        ...doc.metadata,
                        chunk_id: globalChunkIdx,
                        chunk_size: textChunk.length,
                    },
                });
                globalChunkIdx++;
            }
        }
        if (result.length === 0 && nonPassageDocs.length > 0) {
            for (const doc of nonPassageDocs) {
                result.push({
                    page_content: doc.page_content,
                    metadata: {
                        ...doc.metadata,
                        chunk_id: globalChunkIdx,
                        chunk_size: doc.page_content.length,
                    },
                });
                globalChunkIdx++;
            }
        }
        return result;
    }
    splitText(text) {
        if (!text || text.length === 0)
            return [];
        if (text.length <= this.chunk_size)
            return [text];
        return this.recursiveSplit(text, this.separators);
    }
    recursiveSplit(text, separators) {
        const finalChunks = [];
        let separator = separators[separators.length - 1];
        let newSeparators = [];
        for (let i = 0; i < separators.length; i++) {
            const s = separators[i];
            if (s === "" || text.includes(s)) {
                separator = s;
                newSeparators = separators.slice(i + 1);
                break;
            }
        }
        const splits = separator !== "" ? text.split(separator) : text.split("");
        let goodSplits = [];
        for (const s of splits) {
            if (s.length < this.chunk_size) {
                goodSplits.push(s);
            }
            else {
                if (goodSplits.length > 0) {
                    const merged = this.mergeSplits(goodSplits, separator);
                    finalChunks.push(...merged);
                    goodSplits = [];
                }
                if (newSeparators.length === 0) {
                    finalChunks.push(s);
                }
                else {
                    const subChunks = this.recursiveSplit(s, newSeparators);
                    finalChunks.push(...subChunks);
                }
            }
        }
        if (goodSplits.length > 0) {
            const merged = this.mergeSplits(goodSplits, separator);
            finalChunks.push(...merged);
        }
        return finalChunks;
    }
    mergeSplits(splits, separator) {
        const docs = [];
        const currentDoc = [];
        let total = 0;
        for (const d of splits) {
            const len = d.length + (currentDoc.length > 0 ? separator.length : 0);
            if (total + len > this.chunk_size) {
                if (total > this.chunk_size) {
                    // If already exceeded chunk_size
                }
                if (currentDoc.length > 0) {
                    const docStr = currentDoc.join(separator);
                    if (docStr.trim())
                        docs.push(docStr);
                    // Calculate overlap
                    while (total > this.chunk_overlap ||
                        (total + len > this.chunk_size && total > 0)) {
                        const popped = currentDoc.shift();
                        if (!popped)
                            break;
                        total -= popped.length + (currentDoc.length > 0 ? separator.length : 0);
                    }
                }
            }
            currentDoc.push(d);
            total += d.length + (currentDoc.length > 1 ? separator.length : 0);
        }
        if (currentDoc.length > 0) {
            const docStr = currentDoc.join(separator);
            if (docStr.trim())
                docs.push(docStr);
        }
        return docs;
    }
    formatChunksSummary(chunkedDocs) {
        return chunkedDocs.map((doc) => {
            const pageVal = doc.metadata?.page;
            const pageNum = typeof pageVal === 'number'
                ? pageVal + 1
                : doc.metadata?.page_number || 1;
            return {
                chunk_id: doc.metadata?.chunk_id ?? 0,
                page: pageNum,
                character_count: doc.page_content.length,
                content: doc.page_content,
            };
        });
    }
}
exports.ChunkingService = ChunkingService;
exports.chunkingService = new ChunkingService(1000, 200);
