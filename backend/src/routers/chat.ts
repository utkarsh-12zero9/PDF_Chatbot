import { Router, Request, Response } from 'express';
import { memoryService } from '../services/memory';
import { retrieverService } from '../services/retriever';
import { llmService } from '../services/llm';

export const chatRouter = Router();

export interface ChatRequestBody {
  message: string;
  pdf_id?: string | null;
  session_id?: string | null;
}

chatRouter.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, pdf_id, session_id } = req.body as ChatRequestBody;

    const query = (message || '').trim();
    if (!query) {
      res.status(400).json({ detail: 'Message content cannot be empty.' });
      return;
    }

    let activePdfId = pdf_id || null;
    let activeSessionId = session_id || null;

    if (activePdfId) {
      const sessionObj = await memoryService.getOrCreateSession(
        activePdfId,
        activeSessionId
      );
      activeSessionId = sessionObj.id;
    }

    // 2. Retrieve recent conversation history
    let chatHistoryStr = '';
    if (activeSessionId) {
      chatHistoryStr = await memoryService.getRecentHistoryContext(
        activeSessionId,
        6
      );
    }

    // 3. Save user message to database
    if (activeSessionId) {
      await memoryService.saveMessage(activeSessionId, 'user', query);
    }

    // 4. Vector similarity search if PDF active
    let contextStr: string | null = null;
    if (activePdfId) {
      const retrievedDocs = await retrieverService.getTopKChunks(query, activePdfId, 4);
      if (retrievedDocs && retrievedDocs.length > 0) {
        const contextBlocks = retrievedDocs.map((doc) => {
          const pageVal = doc.metadata?.page;
          const pageNum =
            typeof pageVal === 'number'
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

    const fullResponseAcc: string[] = [];

    const stream = llmService.streamRagResponse(
      query,
      fullContext ? fullContext : undefined
    );

    for await (const chunk of stream) {
      fullResponseAcc.push(chunk);
      res.write(chunk);
    }

    res.end();

    // 6. Asynchronously save assistant message to DB
    const fullAnswer = fullResponseAcc.join('').trim();
    if (activeSessionId && fullAnswer) {
      await memoryService.saveMessage(activeSessionId, 'assistant', fullAnswer);
    }
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    if (!res.headersSent) {
      res.status(500).json({ detail: err.message || 'Internal server error in chat RAG pipeline.' });
    } else {
      res.end();
    }
  }
});
