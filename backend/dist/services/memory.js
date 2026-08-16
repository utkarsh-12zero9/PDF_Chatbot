"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = exports.MemoryService = exports.DEFAULT_USER_ID = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../database/db");
exports.DEFAULT_USER_ID = 'default_user';
class MemoryService {
    async ensureDefaultUser() {
        const user = await (0, db_1.dbGet)('SELECT * FROM users WHERE id = ?', [exports.DEFAULT_USER_ID]);
        if (!user) {
            await (0, db_1.dbRun)('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [
                exports.DEFAULT_USER_ID,
                'Default User',
                'user@local',
            ]);
            return { id: exports.DEFAULT_USER_ID, name: 'Default User', email: 'user@local' };
        }
        return user;
    }
    async recordPdf(pdfId, filename, vectorStorePath, userId = exports.DEFAULT_USER_ID) {
        await this.ensureDefaultUser();
        let pdf = await (0, db_1.dbGet)('SELECT * FROM pdfs WHERE id = ?', [pdfId]);
        if (!pdf) {
            await (0, db_1.dbRun)('INSERT INTO pdfs (id, user_id, filename, vector_store_path) VALUES (?, ?, ?, ?)', [pdfId, userId, filename, vectorStorePath]);
            pdf = { id: pdfId, user_id: userId, filename, vector_store_path: vectorStorePath };
        }
        return pdf;
    }
    async getOrCreateSession(pdfId, sessionId, userId = exports.DEFAULT_USER_ID) {
        await this.ensureDefaultUser();
        if (sessionId) {
            const existing = await (0, db_1.dbGet)('SELECT * FROM chat_sessions WHERE id = ?', [sessionId]);
            if (existing) {
                return existing;
            }
        }
        const newSessionId = sessionId || `session_${crypto_1.default.randomBytes(5).toString('hex')}`;
        await (0, db_1.dbRun)('INSERT INTO chat_sessions (id, user_id, pdf_id) VALUES (?, ?, ?)', [newSessionId, userId, pdfId]);
        return { id: newSessionId, user_id: userId, pdf_id: pdfId };
    }
    async saveMessage(sessionId, role, content) {
        const msgId = `msg_${crypto_1.default.randomBytes(5).toString('hex')}`;
        await (0, db_1.dbRun)('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)', [msgId, sessionId, role, content]);
        const saved = await (0, db_1.dbGet)('SELECT * FROM messages WHERE id = ?', [msgId]);
        return saved || { id: msgId, session_id: sessionId, role, content };
    }
    async getRecentHistoryContext(sessionId, limit = 6) {
        const rows = await (0, db_1.dbAll)('SELECT * FROM messages WHERE session_id = ? ORDER BY datetime(timestamp) DESC LIMIT ?', [sessionId, limit]);
        if (!rows || rows.length === 0)
            return '';
        rows.reverse();
        const historyBlocks = rows.map((msg) => {
            const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
            return `${roleLabel}: ${msg.content}`;
        });
        return historyBlocks.join('\n');
    }
    async getSessionMessages(sessionId) {
        const rows = await (0, db_1.dbAll)('SELECT * FROM messages WHERE session_id = ? ORDER BY datetime(timestamp) ASC', [sessionId]);
        return rows.map((msg) => {
            let isoString = '';
            if (msg.timestamp) {
                const d = new Date(msg.timestamp);
                isoString = isNaN(d.getTime()) ? msg.timestamp : d.toISOString();
            }
            else {
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
    async listUserSessions(userId = exports.DEFAULT_USER_ID) {
        const sessions = await (0, db_1.dbAll)('SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY id DESC', [userId]);
        const result = [];
        for (const s of sessions) {
            const pdf = await (0, db_1.dbGet)('SELECT * FROM pdfs WHERE id = ?', [s.pdf_id]);
            const msgCountRow = await (0, db_1.dbGet)('SELECT COUNT(*) as count FROM messages WHERE session_id = ?', [s.id]);
            result.push({
                session_id: s.id,
                pdf_id: s.pdf_id,
                filename: pdf ? pdf.filename : 'Unknown PDF',
                message_count: msgCountRow ? msgCountRow.count : 0,
            });
        }
        return result;
    }
    async deleteSession(sessionId) {
        const sessionObj = await (0, db_1.dbGet)('SELECT * FROM chat_sessions WHERE id = ?', [sessionId]);
        if (sessionObj) {
            await (0, db_1.dbRun)('DELETE FROM messages WHERE session_id = ?', [sessionId]);
            await (0, db_1.dbRun)('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);
        }
        return true;
    }
}
exports.MemoryService = MemoryService;
exports.memoryService = new MemoryService();
