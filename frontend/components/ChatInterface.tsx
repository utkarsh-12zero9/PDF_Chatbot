"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, RefreshCw, AlertCircle, FileText, History, Clock, FileWarning, Plus } from "lucide-react";
import { sendChatMessageStream, fetchSessionMessages, fetchUserSessions, Message, PdfUploadResult, ChatSessionInfo } from "../lib/api";
import { PdfUploader } from "./PdfUploader";

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content: "Welcome! Please upload a PDF document using the workspace panel on the left to start asking questions.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePdf, setActivePdf] = useState<PdfUploadResult | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<ChatSessionInfo[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const sessions = await fetchUserSessions();
      setPastSessions(sessions);
    } catch (err) {
      console.error("Could not load sessions:", err);
    }
  };

  const loadSessionHistory = async (session: ChatSessionInfo) => {
    try {
      setError(null);
      const history = await fetchSessionMessages(session.session_id);
      
      if (history && history.length > 0) {
        setMessages(history);
      } else {
        setMessages([
          {
            id: "welcome-msg",
            role: "assistant",
            content: `Switched to chat session for **${session.filename}**. What would you like to ask about this document?`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }

      // Update Active Session & Document Active status
      setActiveSessionId(session.session_id);
      setActivePdf({
        pdf_id: session.pdf_id,
        session_id: session.session_id,
        filename: session.filename,
        file_path: "",
        total_pages: 1,
        total_characters: 0,
        total_chunks: 0,
        chunk_size: 1000,
        chunk_overlap: 200,
        vector_db: "FAISS",
        indexed_vectors: 0,
        preview_text: "",
        chunks: [],
        pages: [],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load session history.");
    }
  };

  const handlePdfUploaded = (pdfData: PdfUploadResult | null) => {
    setActivePdf(pdfData);
    setError(null);
    if (pdfData && pdfData.session_id) {
      setActiveSessionId(pdfData.session_id);
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [
        ...prev,
        {
          id: `system-pdf-${Date.now()}`,
          role: "assistant",
          content: `📄 **Document Attached!**\n\n**File:** ${pdfData.filename}\n**Total Pages:** ${pdfData.total_pages}\n\nYou can now ask any question about this document.`,
          timestamp,
        },
      ]);
      loadSessions();
    }
  };

  const handleNewChat = () => {
    setActivePdf(null);
    setActiveSessionId(null);
    setError(null);
    setInputMessage("");
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: "Welcome! Please upload a PDF document using the workspace panel on the left to start asking questions.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = inputMessage.trim();
    if (!trimmed || isStreaming) return;

    // GUARD: Require PDF upload first before allowing chat
    if (!activePdf) {
      setError("Please upload a PDF file first before asking questions. This chatbot answers questions exclusively from your uploaded documents.");
      return;
    }

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
      await sendChatMessageStream(trimmed, activePdf.pdf_id, activeSessionId, (chunk: string) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      });
      loadSessions();
    } catch (err: any) {
      setError(err?.message || "Failed to communicate with backend server.");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId && msg.content === ""
            ? {
                ...msg,
                content:
                  "⚠️ Could not connect to server. Please check your network connection.",
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
        content: activePdf
          ? `Chat display reset for ${activePdf.filename}. What would you like to ask next?`
          : "Welcome! Please upload a PDF document using the workspace panel on the left to start asking questions.",
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
              PDF Chatbot
            </h1>
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${activePdf ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
              <span>{activePdf ? `Document Active: ${activePdf.filename}` : "Awaiting PDF Upload"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleNewChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
            title="Start a New Chat Session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          <button
            onClick={handleClearChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Reset Chat Display"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Chat</span>
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-800 p-4 bg-slate-950 shrink-0 flex flex-col h-full overflow-hidden space-y-4">
          <div className="space-y-3 shrink-0">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Document Workspace</span>
            </div>

            <PdfUploader onPdfUploaded={handlePdfUploaded} activePdf={activePdf} />
          </div>

          {/* Past Sessions List expanding to bottom of sidebar */}
          {pastSessions.length > 0 && (
            <div className="flex-1 flex flex-col min-h-0 pt-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                <span className="flex items-center space-x-1.5">
                  <History className="w-3.5 h-3.5 text-purple-400" />
                  <span>Chat History</span>
                </span>
                <span className="text-[10px] text-slate-500">{pastSessions.length} sessions</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {pastSessions.map((s) => (
                  <div
                    key={s.session_id}
                    onClick={() => loadSessionHistory(s)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      activeSessionId === s.session_id
                        ? "bg-indigo-950/60 border-indigo-500/50 text-indigo-200"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="font-medium truncate text-[11px] text-slate-200">
                        {s.filename}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 text-[10px] bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{s.message_count} msgs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          {/* PDF Required Alert Banner when no PDF is attached */}
          {!activePdf && (
            <div className="bg-amber-950/40 border-b border-amber-900/50 px-4 py-2.5 flex items-center space-x-2 text-xs text-amber-300">
              <FileWarning className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Please upload a PDF document in the workspace sidebar before asking questions.</span>
            </div>
          )}

          {/* Messages Scroll Area */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
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
                    ? `Ask anything about ${activePdf.filename}...`
                    : "Please upload a PDF document first to start chatting..."
                }
                disabled={isStreaming || !activePdf}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || isStreaming || !activePdf}
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
