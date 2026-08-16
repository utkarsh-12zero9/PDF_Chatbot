import crypto from 'crypto';
import { dbAll, dbGet, dbRun } from '../database/db';

export const DEFAULT_USER_ID = 'default_user';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
}

export interface PdfRecord {
  id: string;
  user_id: string;
  filename: string;
  vector_store_path: string;
}

export interface ChatSessionRecord {
  id: string;
  user_id: string;
  pdf_id: string;
}

export interface MessageRecord {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp?: string;
}

export class MemoryService {
  public async ensureDefaultUser(): Promise<UserRecord> {
    const user = await dbGet<UserRecord>('SELECT * FROM users WHERE id = ?', [DEFAULT_USER_ID]);
    if (!user) {
      await dbRun('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [
        DEFAULT_USER_ID,
        'Default User',
        'user@local',
      ]);
      return { id: DEFAULT_USER_ID, name: 'Default User', email: 'user@local' };
    }
    return user;
  }

  public async recordPdf(
    pdfId: string,
    filename: string,
    vectorStorePath: string,
    userId: string = DEFAULT_USER_ID
  ): Promise<PdfRecord> {
    await this.ensureDefaultUser();
    let pdf = await dbGet<PdfRecord>('SELECT * FROM pdfs WHERE id = ?', [pdfId]);
    if (!pdf) {
      await dbRun(
        'INSERT INTO pdfs (id, user_id, filename, vector_store_path) VALUES (?, ?, ?, ?)',
        [pdfId, userId, filename, vectorStorePath]
      );
      pdf = { id: pdfId, user_id: userId, filename, vector_store_path: vectorStorePath };
    }
    return pdf;
  }

  public async getOrCreateSession(
    pdfId: string,
    sessionId?: string | null,
    userId: string = DEFAULT_USER_ID
  ): Promise<ChatSessionRecord> {
    await this.ensureDefaultUser();

    if (sessionId) {
      const existing = await dbGet<ChatSessionRecord>(
        'SELECT * FROM chat_sessions WHERE id = ?',
        [sessionId]
      );
      if (existing) {
        return existing;
      }
    }

    const newSessionId = sessionId || `session_${crypto.randomBytes(5).toString('hex')}`;
    await dbRun(
      'INSERT INTO chat_sessions (id, user_id, pdf_id) VALUES (?, ?, ?)',
      [newSessionId, userId, pdfId]
    );

    return { id: newSessionId, user_id: userId, pdf_id: pdfId };
  }

  public async saveMessage(
    sessionId: string,
    role: string,
    content: string
  ): Promise<MessageRecord> {
    const msgId = `msg_${crypto.randomBytes(5).toString('hex')}`;
    await dbRun(
      'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
      [msgId, sessionId, role, content]
    );
    const saved = await dbGet<MessageRecord>('SELECT * FROM messages WHERE id = ?', [msgId]);
    return saved || { id: msgId, session_id: sessionId, role, content };
  }

  public async getRecentHistoryContext(
    sessionId: string,
    limit: number = 6
  ): Promise<string> {
    const rows = await dbAll<MessageRecord>(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY datetime(timestamp) DESC LIMIT ?',
      [sessionId, limit]
    );

    if (!rows || rows.length === 0) return '';

    rows.reverse();

    const historyBlocks = rows.map((msg) => {
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
      return `${roleLabel}: ${msg.content}`;
    });

    return historyBlocks.join('\n');
  }

  public async getSessionMessages(
    sessionId: string
  ): Promise<Array<{ id: string; role: string; content: string; timestamp: string }>> {
    const rows = await dbAll<MessageRecord>(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY datetime(timestamp) ASC',
      [sessionId]
    );

    return rows.map((msg) => {
      let isoString = '';
      if (msg.timestamp) {
        const d = new Date(msg.timestamp);
        isoString = isNaN(d.getTime()) ? msg.timestamp : d.toISOString();
      } else {
        isoString = new Date().toISOString();
      }

      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: isoString,
      };
    });
  }

  public async listUserSessions(
    userId: string = DEFAULT_USER_ID
  ): Promise<Array<{ session_id: string; pdf_id: string; filename: string; message_count: number }>> {
    const sessions = await dbAll<ChatSessionRecord>(
      'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );

    const result: Array<{ session_id: string; pdf_id: string; filename: string; message_count: number }> = [];

    for (const s of sessions) {
      const pdf = await dbGet<PdfRecord>('SELECT * FROM pdfs WHERE id = ?', [s.pdf_id]);
      const msgCountRow = await dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM messages WHERE session_id = ?',
        [s.id]
      );

      result.push({
        session_id: s.id,
        pdf_id: s.pdf_id,
        filename: pdf ? pdf.filename : 'Unknown PDF',
        message_count: msgCountRow ? msgCountRow.count : 0,
      });
    }

    return result;
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    const sessionObj = await dbGet<ChatSessionRecord>(
      'SELECT * FROM chat_sessions WHERE id = ?',
      [sessionId]
    );

    if (sessionObj) {
      await dbRun('DELETE FROM messages WHERE session_id = ?', [sessionId]);
      await dbRun('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);
    }
    return true;
  }
}

export const memoryService = new MemoryService();
