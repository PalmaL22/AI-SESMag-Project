"use client";

import { useState, useRef, DragEvent } from "react";

interface PDFUploadProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadedFileName?: string | null;
}

export default function PDFUpload({
  onFileSelect,
  isUploading = false,
  uploadedFileName,
}: PDFUploadProps) {

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
    <div className="w-full h-full flex flex-col">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">Upload PDF Document</h2>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all duration-300 ease-in-out flex-1 flex flex-col items-center justify-center
          ${
            isDragging
              ? "border-blue-500 bg-blue-500/10 scale-[1.01] shadow-2xl shadow-blue-500/20"
              : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30"
          }
          ${isUploading ? "opacity-60 cursor-not-allowed" : ""}
          bg-zinc-900/40 backdrop-blur-sm
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-6">
          {isUploading ? (
            <>
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse shadow-xl">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="space-y-3 w-full max-w-xs">
                <p className="text-lg font-semibold text-zinc-100">
                  Uploading PDF...
                </p>
                <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse w-3/4 rounded-full" />
                </div>
                <p className="text-sm text-zinc-400">
                  Please wait while I read over the PDF
                </p>
              </div>
            </>
          ) : uploadedFileName ? (
            <>
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="space-y-2 text-center">
                <p className="text-lg font-semibold text-zinc-100 break-words px-4">
                  {uploadedFileName}
                </p>
                <p className="text-sm text-zinc-400">
                  PDF uploaded
                </p>
                <p className="text-xs text-zinc-500 mt-4">
                  Click here to upload a different PDF
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-dashed border-zinc-600 flex items-center justify-center transition-colors group-hover:border-blue-500">
                <svg
                  className="w-12 h-12 text-zinc-400 group-hover:text-blue-400 transition-colors"
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
              </div>
              <div className="space-y-3 text-center">
                <p className="text-xl font-semibold text-zinc-100">
                  {isDragging ? "Drop your PDF here" : "Upload a PDF Document"}
                </p>
                <p className="text-sm text-zinc-400">
                  Drag and drop your PDF file here, or click to browse
                </p>
                <p className="text-xs text-zinc-500 mt-6">
                  Supported format: PDF files only
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



