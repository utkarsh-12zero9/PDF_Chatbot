"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, RefreshCw, AlertCircle, FileText, History, Clock, FileWarning, Plus, MessageSquare, Zap, UploadCloud, Loader2, Trash2 } from "lucide-react";
import { sendChatMessageStream, fetchSessionMessages, fetchUserSessions, deleteSession, uploadPdfFile, Message, PdfUploadResult, ChatSessionInfo } from "../lib/api";
import { PdfUploader } from "./PdfUploader";

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePdf, setActivePdf] = useState<PdfUploadResult | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<ChatSessionInfo[]>([]);
  const [isUploadingFooter, setIsUploadingFooter] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Processing...");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const footerFileInputRef = useRef<HTMLInputElement>(null);

  const formatClientTime = (rawTime?: string) => {
    if (!rawTime) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const parsedDate = new Date(rawTime);
    if (isNaN(parsedDate.getTime())) {
      return rawTime; // already formatted string
    }
    return parsedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  useEffect(() => {
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: "Welcome! Upload a PDF document using the workspace panel on the left or the upload bar below to start asking questions.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, []);

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
      setIsActionLoading(true);
      setLoadingText(`Loading Chat for ${session.filename}...`);
      
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
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setError(null);

    // Instant optimistic UI update
    setPastSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    if (activeSessionId === sessionId) {
      handleNewChat();
    }

    try {
      setIsActionLoading(true);
      setLoadingText("Deleting Conversation...");
      await deleteSession(sessionId);
      await loadSessions();
    } catch (err: any) {
      setError(err?.message || "Failed to delete session.");
      loadSessions();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePdfUploaded = (pdfData: PdfUploadResult | null) => {
    setActivePdf(pdfData);
    setError(null);
    if (pdfData && pdfData.session_id) {
      setActiveSessionId(pdfData.session_id);
      const timestamp = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        {
          id: `system-pdf-${Date.now()}`,
          role: "assistant",
          content: `I've successfully analyzed your document "${pdfData.filename}" (${pdfData.total_pages} ${pdfData.total_pages === 1 ? 'page' : 'pages'}). Feel free to ask me anything about it!`,
          timestamp,
        },
      ]);
      loadSessions();
    }
  };

  const handleFooterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a valid .pdf file.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("File size exceeds 15 MB limit.");
      return;
    }

    setError(null);
    setIsUploadingFooter(true);
    setIsActionLoading(true);
    setLoadingText("Processing Document & Building Vector Store...");

    try {
      const data = await uploadPdfFile(file);
      handlePdfUploaded(data);
    } catch (err: any) {
      setError(err?.message || "Failed to process PDF document.");
    } finally {
      setIsUploadingFooter(false);
      setIsActionLoading(false);
      if (footerFileInputRef.current) footerFileInputRef.current.value = "";
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
        content: "Welcome! Upload a PDF document using the workspace panel on the left or the upload bar below to start asking questions.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSendMessage = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();

    const queryToSend = customQuery || inputMessage.trim();
    if (!queryToSend || isStreaming) return;

    if (!activePdf) {
      setError("Please upload a PDF file first before asking questions. This chatbot answers questions exclusively from your uploaded documents.");
      return;
    }

    setError(null);
    setInputMessage("");

    const timestamp = new Date().toISOString();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: queryToSend,
      timestamp,
    };

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
      await sendChatMessageStream(queryToSend, activePdf.pdf_id, activeSessionId, (chunk: string) => {
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
          : "Welcome! Upload a PDF document using the workspace panel on the left or the upload bar below to start asking questions.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setError(null);
  };

  return (
    <div className="relative w-full max-w-7xl h-full max-h-full flex flex-col space-y-3 font-sans overflow-hidden">
      {/* Global Action Loading Modal Popup */}
      {isActionLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md">
          <div className="glass-panel p-6 rounded-xl border border-slate-700/80 shadow-2xl flex flex-col items-center justify-center space-y-3.5 max-w-xs w-full text-center">
            <div className="relative">
              <img
                src="/icon.png"
                alt="Loading..."
                className="w-12 h-12 rounded-lg object-cover border border-[#05b060]/50 shadow-lg shadow-[#05b060]/30 animate-pulse"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#05b060] rounded-full flex items-center justify-center text-white border-2 border-[#0B0F17]">
                <Loader2 className="w-3 h-3 animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-tight uppercase">
                PDF Intelligence
              </h3>
              <p className="text-xs text-slate-300 font-medium mt-1 leading-snug">
                {loadingText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ambient Glow Accents */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-slate-800/20 rounded-full blur-3xl opacity-40 pointer-events-none animate-glow-slow" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-[#05b060]/10 rounded-full blur-3xl opacity-40 pointer-events-none animate-glow-reverse" />

      {/* Floating Glass Header Bar */}
      <header className="glass-panel px-5 py-3 rounded-lg flex items-center justify-between shadow-xl z-20 border border-slate-800 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src="/icon.png"
              alt="PDF Intelligence Logo"
              className="w-9 h-9 rounded-md object-cover border border-[#05b060]/40 shadow-md shadow-[#05b060]/20"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#64DDC8] border-2 border-[#0B0F17] rounded-full"></span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                PDF Intelligence
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#05b060]/10 border border-[#05b060]/30 text-[#05b060] rounded-md">
                RAG Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {activePdf ? `Active Document: ${activePdf.filename}` : "Upload a PDF document to begin"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleNewChat}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-[#05b060] hover:bg-[#079251] transition-colors duration-200 shadow-md shadow-[#05b060]/20 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>

          <button
            onClick={handleClearChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset View</span>
          </button>
        </div>
      </header>

      {/* Bento Grid Body Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        
        {/* Left Column: Bento Cards (Workspace + Saved Sessions) */}
        <div className="lg:col-span-4 flex flex-col space-y-3 min-h-0 overflow-hidden">
          
          {/* Bento Card 1: Document Workspace */}
          <div className="glass-panel p-3.5 rounded-lg flex flex-col space-y-2.5 shrink-0 shadow-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center space-x-2">
                <FileText className="w-3.5 h-3.5 text-[#05b060]" />
                <span>Document Vault</span>
              </span>
              {activePdf && (
                <span className="text-[10px] text-[#64DDC8] bg-[#64DDC8]/10 px-2 py-0.5 rounded-md border border-[#64DDC8]/30 font-medium">
                  Indexed
                </span>
              )}
            </div>

            <PdfUploader onPdfUploaded={handlePdfUploaded} activePdf={activePdf} />
          </div>

          {/* Bento Card 2: Saved Sessions List */}
          <div className="glass-panel p-3.5 rounded-lg flex-1 flex flex-col min-h-0 space-y-2.5 shadow-lg border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">
              <span className="flex items-center space-x-2">
                <History className="w-3.5 h-3.5 text-[#05b060]" />
                <span>Saved Sessions</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                {pastSessions.length} total
              </span>
            </div>

            {pastSessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-5 text-slate-500 space-y-2">
                <MessageSquare className="w-7 h-7 text-slate-600" />
                <p className="text-xs">No saved sessions yet.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {pastSessions.map((s) => {
                  const isActive = activeSessionId === s.session_id;
                  return (
                    <div
                      key={s.session_id}
                      onClick={() => loadSessionHistory(s)}
                      className={`group p-2.5 rounded-md cursor-pointer transition-all duration-200 border flex items-center justify-between ${
                        isActive
                          ? "bg-[#05b060]/15 border-[#05b060]/60 text-white shadow-md shadow-[#05b060]/10"
                          : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate pr-2">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          isActive ? "bg-[#05b060] text-white" : "bg-slate-800 text-slate-400 group-hover:text-[#05b060]"
                        }`}>
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <p className={`text-xs font-medium truncate ${isActive ? "text-white" : "text-slate-200"}`}>
                            {s.filename}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">
                            {s.session_id}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={(e) => handleDeleteSession(e, s.session_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 hover:bg-red-950/50 rounded transition-all duration-150"
                          title="Delete Conversation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center space-x-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          <Clock className="w-3 h-3 text-[#05b060]" />
                          <span>{s.message_count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Bento Card 3 (Conversational Stage) */}
        <div className="lg:col-span-8 glass-panel rounded-lg flex flex-col min-h-0 overflow-hidden shadow-xl relative border border-slate-800">
          
          {/* Top Stage Notice when no PDF active (Vivid Red Warning) */}
          {!activePdf && (
            <div className="bg-red-950/40 border-b border-red-900/50 px-4 py-2.5 flex items-center space-x-2.5 text-xs text-red-300 shrink-0">
              <FileWarning className="w-4 h-4 text-red-400 shrink-0" />
              <span>Please upload a PDF document using the button below or the sidebar to begin asking questions.</span>
            </div>
          )}

          {/* Messages Scroll Area */}
          <main className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${
                  msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 shadow-md ${
                    msg.role === "user"
                      ? "bg-[#05b060] text-white"
                      : "bg-slate-900 border border-slate-800 text-[#05b060]"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[84%] rounded-lg px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#05b060] text-white shadow-md shadow-[#05b060]/15"
                      : "glass-panel text-slate-200 border border-slate-800 shadow-md"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-normal">
                    {msg.content || (
                      <span className="inline-flex items-center space-x-1 text-slate-400">
                        <span className="w-1.5 h-1.5 bg-[#05b060] rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-[#05b060] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-[#05b060] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-[10px] mt-1.5 text-right font-medium ${
                      msg.role === "user" ? "text-emerald-100" : "text-slate-500"
                    }`}
                    suppressHydrationWarning
                  >
                    {formatClientTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {/* System Error Warning Alert (Vivid Red) */}
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-950/60 border border-red-900/60 rounded-md text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </main>

          {/* Quick Prompt Suggestion Chips */}
          {activePdf && !isStreaming && (
            <div className="px-5 py-2 flex items-center space-x-2 overflow-x-auto scrollbar-none shrink-0 border-t border-slate-800/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0 flex items-center space-x-1">
                <Zap className="w-3 h-3 text-[#05b060]" />
                <span>Prompts:</span>
              </span>
              {[
                "Summarize main takeaways",
                "What are the key qualifications?",
                "List important dates & topics"
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(undefined, suggestion)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-[#05b060]/50 text-slate-300 hover:text-white transition-all duration-150 shrink-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Floating Glass Input Footer */}
          <footer className="p-3.5 bg-[#0B0F17]/90 backdrop-blur-md border-t border-slate-800 shrink-0">
            {!activePdf ? (
              <div
                onClick={() => footerFileInputRef.current?.click()}
                className={`group glass-panel p-3 rounded-md border border-dashed border-[#05b060]/50 hover:border-[#05b060] hover:bg-slate-900 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                  isUploadingFooter ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                <input
                  type="file"
                  ref={footerFileInputRef}
                  onChange={handleFooterFileUpload}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />

                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-md bg-[#05b060]/20 text-[#05b060] border border-[#05b060]/30 flex items-center justify-center group-hover:scale-105 transition">
                    {isUploadingFooter ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#05b060]" />
                    ) : (
                      <UploadCloud className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100 group-hover:text-emerald-200 transition">
                      {isUploadingFooter ? "Processing Document & Generating Vector Store..." : "Upload a PDF Document to Start Chatting"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Click here or drag a file to attach your PDF to this workspace
                    </p>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 bg-[#05b060] hover:bg-[#079251] text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-[#05b060]/20 transition-colors">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Attach PDF</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={`Ask anything about ${activePdf.filename}...`}
                    disabled={isStreaming}
                    className="w-full glass-input rounded-md px-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-40 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isStreaming}
                  className="px-4 py-3 bg-[#05b060] hover:bg-[#079251] disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-md text-xs sm:text-sm font-semibold transition-colors shadow-md shadow-[#05b060]/20 disabled:shadow-none flex items-center justify-center shrink-0 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </footer>
        </div>

      </div>
    </div>
  );
}
