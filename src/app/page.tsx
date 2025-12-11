"use client";

import { useState } from "react";
import ChatInterface from "@/components/ChatInterface";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api?action=upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload PDF');
      }

      const data = await response.json();
      setIsUploading(false);

      // Add a welcome message after upload
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Great! I've processed your PDF "${file.name}". I'm ready to answer questions about it! What would you like to know?`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, welcomeMessage]);
    } catch (error: any) {
      setIsUploading(false);
      setUploadedFileName(null);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Sorry, I encountered an error uploading your PDF: ${error.message}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api?action=chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          filename: uploadedFileName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950">
      <div className="flex flex-col w-full max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <header className="border-b border-zinc-800/50 bg-zinc-900/30 backdrop-blur-xl px-6 py-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Sesmag AI
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Intelligent PDF chat assistant
              </p>
            </div>
          </div>
        </header>

        {/* Chat Section */}
        <div className="flex-1 flex flex-col bg-zinc-900/40 backdrop-blur-xl rounded-2xl border border-zinc-800/50 shadow-2xl min-h-[calc(100vh-200px)] overflow-hidden my-6">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            onFileSelect={handleFileSelect}
            isLoading={isLoading}
            isUploading={isUploading}
            uploadedFileName={uploadedFileName}
          />
        </div>
      </div>
    </div>
  );
}
