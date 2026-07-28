"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { uploadPdfFile, PdfUploadResult } from "../lib/api";

interface PdfUploaderProps {
  onPdfUploaded: (data: PdfUploadResult | null) => void;
  activePdf: PdfUploadResult | null;
}

export function PdfUploader({ onPdfUploaded, activePdf }: PdfUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setError(err?.message || "Failed to process PDF document.");
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
    <div className="w-full font-sans">
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
          className={`group relative overflow-hidden rounded-lg border border-dashed border-slate-700/80 bg-slate-900/40 p-5 text-center cursor-pointer transition-all duration-200 hover:border-[#05b060]/80 hover:bg-slate-900/80 ${
            isUploading ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <div className="relative z-10 flex flex-col items-center justify-center space-y-2.5">
            <div className="w-10 h-10 rounded-md bg-[#05b060]/10 border border-[#05b060]/20 flex items-center justify-center text-[#05b060] group-hover:scale-105 group-hover:bg-[#05b060]/20 transition-all duration-200 shadow-sm shadow-[#05b060]/20">
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#05b060]" />
              ) : (
                <UploadCloud className="w-5 h-5" />
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-100 group-hover:text-white transition-colors">
                {isUploading ? "Processing Document..." : "Drop PDF or Click to Upload"}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Maximum file size: 15 MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-3 rounded-lg flex items-center justify-between border border-slate-800">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-md bg-[#05b060]/20 border border-[#05b060]/30 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#05b060]" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-semibold text-slate-100 truncate">
                  {activePdf.filename}
                </h4>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#64DDC8] shrink-0" />
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                <span>{activePdf.total_pages} {activePdf.total_pages === 1 ? "page" : "pages"}</span>
                <span>•</span>
                <span className="text-[#64DDC8] font-medium">Ready</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={handleClearPdf}
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-md transition"
              title="Remove Document"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 mt-2.5 p-2.5 bg-red-950/60 border border-red-800/60 rounded-md text-red-300 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
