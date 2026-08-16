"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
const express_1 = require("express");
const memory_1 = require("../services/memory");
const retriever_1 = require("../services/retriever");
const llm_1 = require("../services/llm");
exports.chatRouter = (0, express_1.Router)();
exports.chatRouter.post('/chat', async (req, res) => {
    try {
        const { message, pdf_id, session_id } = req.body;
        const query = (message || '').trim();
        if (!query) {
            res.status(400).json({ detail: 'Message content cannot be empty.' });
            return;
        }
        let activePdfId = pdf_id || null;
        let activeSessionId = session_id || null;
        if (activePdfId) {
            const sessionObj = await memory_1.memoryService.getOrCreateSession(activePdfId, activeSessionId);
            activeSessionId = sessionObj.id;
        }
        // 2. Retrieve recent conversation history
        let chatHistoryStr = '';
        if (activeSessionId) {
            chatHistoryStr = await memory_1.memoryService.getRecentHistoryContext(activeSessionId, 6);
        }
        // 3. Save user message to database
        if (activeSessionId) {
            await memory_1.memoryService.saveMessage(activeSessionId, 'user', query);
        }
        // 4. Vector similarity search if PDF active
        let contextStr = null;
        if (activePdfId) {
            const retrievedDocs = await retriever_1.retrieverService.getTopKChunks(query, activePdfId, 4);
            if (retrievedDocs && retrievedDocs.length > 0) {
                const contextBlocks = retrievedDocs.map((doc) => {
                    const pageVal = doc.metadata?.page;
                    const pageNum = typeof pageVal === 'number'
                        ? pageVal + 1
                        : doc.metadata?.page_number || 1;
                    return `[Excerpt from Page ${pageNum}]:\n${doc.page_content}`;
                });
                contextStr = contextBlocks.join('\n\n');
            }
        }
        // Combine conversational history + document excerpts
        let fullContext = '';
        if (chatHistoryStr) {
            fullContext += `CONVERSATION HISTORY (Previous Turns):\n${chatHistoryStr}\n\n`;
        }
        if (contextStr) {
            fullContext += `CURRENT DOCUMENT EXCERPTS:\n${contextStr}`;
        }
        fullContext = fullContext.trim() || '';
        // 5. Setup streaming HTTP response
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        const fullResponseAcc = [];
        const stream = llm_1.llmService.streamRagResponse(query, fullContext ? fullContext : undefined);
        for await (const chunk of stream) {
            fullResponseAcc.push(chunk);
            res.write(chunk);
        }
        res.end();
        // 6. Asynchronously save assistant message to DB
        const fullAnswer = fullResponseAcc.join('').trim();
        if (activeSessionId && fullAnswer) {
            await memory_1.memoryService.saveMessage(activeSessionId, 'assistant', fullAnswer);
        }
    }
    catch (err) {
        console.error('Chat endpoint error:', err);
        if (!res.headersSent) {
            res.status(500).json({ detail: err.message || 'Internal server error in chat RAG pipeline.' });
        }
        else {
            res.end();
        }
    }
});
