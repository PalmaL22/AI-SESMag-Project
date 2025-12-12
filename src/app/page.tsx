"use client";

import { useState, useEffect } from "react";
import ChatInterface from "@/components/ChatInterface";
import SessionSelector from "@/components/SessionSelector";
import PDFUpload from "@/components/PDFUpload";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Session {
  id: number;
  pdfId: number | null;
  pdfName: string | null;
  createdAt: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const loadConversationHistory = async (sessionIdParam: number | null = null, filename: string | null = null) => {
    try {
      const params = new URLSearchParams();
      if (sessionIdParam) params.set('sessionId', sessionIdParam.toString());
      if (filename) params.set('filename', filename);
      
      const response = await fetch(`/api?${params}`);
      if (!response.ok) return;
      
      const data = await response.json() as { messages?: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>; sessionId?: number };
      const messages: Message[] = (data.messages || []).map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(messages);
      if (data.sessionId) setSessionId(data.sessionId);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch('/api?action=sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleSelectSession = async (selectedSessionId: number) => {
    const selectedSession = sessions.find(s => s.id === selectedSessionId);
    setSessionId(selectedSessionId);
    setUploadedFileName(selectedSession?.pdfName || null);
    await loadConversationHistory(selectedSessionId, null);
  };

  const handleCreateNewSession = () => {
    setSessionId(null);
    setUploadedFileName(null);
    setMessages([]);
  };

  const handleDeleteSession = async (sessionIdToDelete: number) => {
    try {
      const response = await fetch(`/api?sessionId=${sessionIdToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      if (sessionId === sessionIdToDelete) {
        setSessionId(null);
        setMessages([]);
        setUploadedFileName(null);
      }

      await loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    loadSessions();
  }, [uploadedFileName, sessionId]);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const url = new URL('/api', window.location.origin);
      url.searchParams.set('action', 'upload');
      if (sessionId) {
        url.searchParams.set('sessionId', sessionId.toString());
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload PDF');
      }

      const data = await response.json();
      setIsUploading(false);
      setUploadedFileName(file.name);
      if (data.sessionId) {
        setSessionId(data.sessionId);
        await loadConversationHistory(data.sessionId, null);
      }
      await loadSessions();
    } catch (error) {
      setIsUploading(false);
      setUploadedFileName(null);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Sorry, I encountered an error uploading your PDF: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content,
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
          sessionId: sessionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();
      const newSessionId = data.sessionId || sessionId;
      if (newSessionId) {
        setSessionId(newSessionId);
        await loadConversationHistory(newSessionId, null);
      } else {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || 'Sorry, I could not generate a response.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
      await loadSessions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950">
      <header className="fixed top-0 left-0 right-0 border-b border-zinc-800/50 bg-zinc-900/30 backdrop-blur-xl px-6 py-4 z-10">
        <div className="flex items-center justify-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            Fee AI
          </h1>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row w-full pt-20">
        {/* Left Sidebar - This is gonna be the PDF Upload */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-zinc-800/50 bg-zinc-900/20 backdrop-blur-xl p-4 lg:p-6 flex flex-col lg:h-[calc(100vh-5rem)]">
          <SessionSelector
            sessions={sessions}
            currentSessionId={sessionId}
            onSelectSession={handleSelectSession}
            onCreateNew={handleCreateNewSession}
            onDeleteSession={handleDeleteSession}
          />
          <div className="mt-4 lg:mt-6 flex-1 min-h-[300px] lg:min-h-0">
            <PDFUpload
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              uploadedFileName={uploadedFileName}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:h-[calc(100vh-5rem)]">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            uploadedFileName={uploadedFileName}
          />
        </div>
      </div>
    </div>
  );
}
