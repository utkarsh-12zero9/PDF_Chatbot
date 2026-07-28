"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X, ChevronDown, ChevronUp, Layers, Database } from "lucide-react";
import { uploadPdfFile, PdfUploadResult } from "../lib/api";

interface PdfUploaderProps {
  onPdfUploaded: (data: PdfUploadResult | null) => void;
  activePdf: PdfUploadResult | null;
}

export function PdfUploader({ onPdfUploaded, activePdf }: PdfUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showChunks, setShowChunks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setIsUploading(true);

    try {
      const data = await uploadPdfFile(file);
      onPdfUploaded(data);
    } catch (err: any) {
      setError(err?.message || "Failed to upload, embed, and index PDF.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearPdf = () => {
    onPdfUploaded(null);
    setError(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        className="hidden"
      />

      {!activePdf ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-950/20 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
            isUploading ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8 text-indigo-400 transition-transform" />
          )}

          <div>
            <p className="text-sm font-semibold text-slate-200">
              {isUploading ? "Generating Vector Embeddings & Indexing..." : "Click or Drag PDF to Upload"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Embeds & indexes vectors in FAISS database
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="truncate">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-medium text-slate-100 truncate">
                    {activePdf.filename}
                  </h4>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                  <span>{activePdf.total_pages} {activePdf.total_pages === 1 ? "page" : "pages"}</span>
                  <span>•</span>
                  <span className="text-indigo-300 font-medium">{activePdf.total_chunks} chunks</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={() => setShowChunks(!showChunks)}
                className={`p-1.5 rounded-lg transition ${
                  showChunks ? "bg-indigo-600/30 text-indigo-300" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
                title="View Text Chunks"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                title="Toggle Text Preview"
              >
                {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={handleClearPdf}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
                title="Remove PDF"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Vector Store Status Badge */}
          <div className="flex items-center justify-between text-[11px] bg-slate-950 border border-emerald-900/40 px-3 py-1.5 rounded-lg text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vector Store: <strong className="text-emerald-300 uppercase">{activePdf.vector_db || "FAISS"}</strong></span>
            </span>
            <span className="text-slate-300 font-mono text-[10px]">{activePdf.indexed_vectors} vectors indexed</span>
          </div>

          {/* Chunking Config Badge */}
          <div className="flex items-center justify-between text-[11px] bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
            <span>Chunk Size: <strong className="text-slate-200">{activePdf.chunk_size}</strong></span>
            <span>Overlap: <strong className="text-slate-200">{activePdf.chunk_overlap}</strong></span>
            <span>Chunks: <strong className="text-indigo-400">{activePdf.total_chunks}</strong></span>
          </div>

          {showChunks && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] flex items-center justify-between">
                <span>FAISS Vector Chunks</span>
                <span>({activePdf.chunks.length} total)</span>
              </span>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {activePdf.chunks.map((chunk) => (
                  <div key={chunk.chunk_id} className="bg-slate-900 border border-slate-800 p-2 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-indigo-400">Chunk #{chunk.chunk_id + 1}</span>
                      <span>Page {chunk.page} • {chunk.character_count} chars</span>
                    </div>
                    <p className="text-slate-300 font-mono text-[11px] line-clamp-3 leading-relaxed">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPreview && !showChunks && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                Full Extracted Text Preview
              </span>
              <p className="text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-36 overflow-y-auto pr-2 scrollbar-thin">
                {activePdf.preview_text}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 mt-3 p-2.5 bg-red-950/40 border border-red-900/50 rounded-lg text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
