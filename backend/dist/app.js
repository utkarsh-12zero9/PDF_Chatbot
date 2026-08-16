"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./database/db");
const upload_1 = require("./routers/upload");
const session_1 = require("./routers/session");
const chat_1 = require("./routers/chat");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8000;
// CORS setup matching FastAPI backend
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', '*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Mount API routers under /api prefix
app.use('/api', upload_1.uploadRouter);
app.use('/api', session_1.sessionRouter);
app.use('/api', chat_1.chatRouter);
// Health check endpoints
app.get(['/', '/health'], (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'PDF Chatbot API (Node.js)',
        version: '0.9.0',
    });
});
// Application startup
async function startServer() {
    try {
        await (0, db_1.initDb)();
        console.log('Database initialized successfully.');
        app.listen(PORT, () => {
            console.log(`Node.js PDF Chatbot Server running on http://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error('Failed to initialize database or start server:', err);
        process.exit(1);
    }
}
startServer();
