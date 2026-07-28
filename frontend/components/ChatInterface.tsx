"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, RefreshCw, AlertCircle, FileText } from "lucide-react";
import { sendChatMessageStream, Message, PdfUploadResult } from "../lib/api";
import { PdfUploader } from "./PdfUploader";

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content: "Hello! Upload a PDF file to enable RAG-based context answering, or type any question to get started.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePdf, setActivePdf] = useState<PdfUploadResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handlePdfUploaded = (pdfData: PdfUploadResult | null) => {
    setActivePdf(pdfData);
    if (pdfData) {
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [
        ...prev,
        {
          id: `system-pdf-${Date.now()}`,
          role: "assistant",
          content: `📄 **PDF Attached & FAISS Vector Store Ready!**\n\n**File:** ${pdfData.filename}\n**Total Pages:** ${pdfData.total_pages}\n**FAISS Chunks:** ${pdfData.total_chunks}\n\n*All future questions will now query vector similarity search over this document.*`,
          timestamp,
        },
      ]);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = inputMessage.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setInputMessage("");

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // 1. Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp,
    };

    // 2. Add empty assistant message placeholder
    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setIsStreaming(true);

    try {
      await sendChatMessageStream(trimmed, activePdf?.pdf_id, (chunk: string) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      });
    } catch (err: any) {
      setError(err?.message || "Failed to communicate with FastAPI backend.");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId && msg.content === ""
            ? {
                ...msg,
                content:
                  "⚠️ Could not connect to FastAPI server. Please ensure `backend/app.py` is running on port 8000.",
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: "Chat history cleared. What would you like to discuss next?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[90vh] max-w-5xl mx-auto bg-slate-950 text-slate-100 shadow-2xl rounded-2xl border border-slate-800 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              PDF Chatbot - RAG AI
            </h1>
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>FastAPI + FAISS RAG Pipeline (Phase 7: RAG System)</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Clear Conversation"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Chat</span>
        </button>
      </header>

      {/* Main Body Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* PDF Uploader Sidebar */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 p-4 bg-slate-950 shrink-0 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Document Workspace</span>
          </div>

          <PdfUploader onPdfUploaded={handlePdfUploaded} activePdf={activePdf} />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          {/* Messages Scroll Area */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${
                  msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 border border-slate-700 text-purple-400"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-5 h-5" />
                  ) : (
                    <Bot className="w-5 h-5" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-md text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-normal">
                    {msg.content || (
                      <span className="inline-flex items-center space-x-1.5 text-slate-400">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-[10px] mt-1.5 text-right ${
                      msg.role === "user" ? "text-indigo-200" : "text-slate-500"
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-950/50 border border-red-900/60 rounded-xl text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </main>

          {/* Input Footer */}
          <footer className="p-4 bg-slate-900/60 border-t border-slate-800">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  activePdf
                    ? `Ask anything about ${activePdf.filename} (RAG Mode)...`
                    : "Type a question or message..."
                }
                disabled={isStreaming}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || isStreaming}
                className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </footer>
        </div>
      </div>
    </div>
  );
}
