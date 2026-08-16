"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRouter = void 0;
const express_1 = require("express");
const memory_1 = require("../services/memory");
exports.sessionRouter = (0, express_1.Router)();
exports.sessionRouter.get('/sessions', async (req, res) => {
    try {
        const sessions = await memory_1.memoryService.listUserSessions();
        res.status(200).json({
            status: 'success',
            data: sessions,
        });
    }
    catch (err) {
        res.status(500).json({ detail: err.message || 'Failed to list sessions.' });
    }
});
exports.sessionRouter.get('/sessions/:session_id/messages', async (req, res) => {
    try {
        const sessionId = req.params.session_id;
        const messages = await memory_1.memoryService.getSessionMessages(sessionId);
        res.status(200).json({
            status: 'success',
            session_id: sessionId,
            data: messages,
        });
    }
    catch (err) {
        res.status(500).json({ detail: err.message || 'Failed to get messages.' });
    }
});
exports.sessionRouter.delete('/sessions/:session_id', async (req, res) => {
    try {
        const sessionId = req.params.session_id;
        const success = await memory_1.memoryService.deleteSession(sessionId);
        if (!success) {
            res.status(404).json({ detail: 'Session not found' });
            return;
        }
        res.status(200).json({
            status: 'success',
            message: `Session ${sessionId} deleted successfully.`,
        });
    }
    catch (err) {
        res.status(500).json({ detail: err.message || 'Failed to delete session.' });
    }
});
