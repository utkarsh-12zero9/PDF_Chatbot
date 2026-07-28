"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { uploadPdfFile, PdfUploadResult } from "../lib/api";

interface PdfUploaderProps {
  onPdfUploaded: (data: PdfUploadResult | null) => void;
  activePdf: PdfUploadResult | null;
}

export function PdfUploader({ onPdfUploaded, activePdf }: PdfUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear upload/OCR warnings automatically whenever activePdf changes or chat session switches
  useEffect(() => {
    setError(null);
  }, [activePdf?.pdf_id, activePdf?.filename]);

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
      setError(err?.message || "Failed to process PDF file.");
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
              {isUploading ? "Processing Document..." : "Click or Drag PDF to Upload"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Upload a PDF document (up to 15 MB)
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
                  <span className="text-emerald-400 font-medium">Ready</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
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

          {showPreview && activePdf.preview_text && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                Document Preview
              </span>
              <p className="text-slate-300 leading-relaxed font-sans whitespace-pre-wrap max-h-36 overflow-y-auto pr-2 scrollbar-thin">
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
