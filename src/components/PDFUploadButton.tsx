"use client";

import { useRef, useState, DragEvent } from "react";

interface PDFUploadButtonProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadedFileName?: string | null;
}

export default function PDFUploadButton({
  onFileSelect,
  isUploading = false,
  uploadedFileName,
}: PDFUploadButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === "application/pdf") {
      onFileSelect(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && files[0].type === "application/pdf") {
      onFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileInput}
        className="hidden"
        disabled={isUploading}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        className={`
          relative p-3 rounded-full transition-all duration-200
          ${isUploading 
            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
            : uploadedFileName
            ? "bg-gradient-to-br from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white"
            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
          }
          ${isDragging ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900" : ""}
          disabled:opacity-50
        `}
        title={uploadedFileName ? `PDF: ${uploadedFileName}` : "Upload PDF"}
      >
        {isUploading ? (
          <svg
            className="w-5 h-5 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        ) : uploadedFileName ? (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        )}
      </button>
      {isDragging && (
        <div className="absolute inset-0 -z-10 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
      )}
    </div>
  );
}
