import { Router, Request, Response } from 'express';
import { memoryService } from '../services/memory';

export const sessionRouter = Router();

sessionRouter.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await memoryService.listUserSessions();
    res.status(200).json({
      status: 'success',
      data: sessions,
    });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to list sessions.' });
  }
});

sessionRouter.get(
  '/sessions/:session_id/messages',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.params.session_id;
      const messages = await memoryService.getSessionMessages(sessionId);
      res.status(200).json({
        status: 'success',
        session_id: sessionId,
        data: messages,
      });
    } catch (err: any) {
      res.status(500).json({ detail: err.message || 'Failed to get messages.' });
    }
  }
);

sessionRouter.delete(
  '/sessions/:session_id',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.params.session_id;
      const success = await memoryService.deleteSession(sessionId);
      if (!success) {
        res.status(404).json({ detail: 'Session not found' });
        return;
      }
      res.status(200).json({
        status: 'success',
        message: `Session ${sessionId} deleted successfully.`,
      });
    } catch (err: any) {
      res.status(500).json({ detail: err.message || 'Failed to delete session.' });
    }
  }
);
