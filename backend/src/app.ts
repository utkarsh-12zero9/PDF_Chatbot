import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './database/db';
import { uploadRouter } from './routers/upload';
import { sessionRouter } from './routers/session';
import { chatRouter } from './routers/chat';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// CORS setup matching FastAPI backend
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', '*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API routers under /api prefix
app.use('/api', uploadRouter);
app.use('/api', sessionRouter);
app.use('/api', chatRouter);

// Health check endpoints
app.get(['/', '/health'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'PDF Chatbot API (Node.js)',
    version: '0.9.0',
  });
});

// Application startup
async function startServer() {
  try {
    await initDb();
    console.log('Database initialized successfully.');

    app.listen(PORT, () => {
      console.log(`Node.js PDF Chatbot Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database or start server:', err);
    process.exit(1);
  }
}

startServer();
