import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getOrCreatePDF, getPDFByFilename, initDatabase, saveMessage, savePDFChunks, 
getPDFChunks, searchPDFChunks, getConversationHistory, createSession, getSessionsByPDF, getAllSessions, getAllPDFs, 
deleteSession, updateSessionPDF } from '@/lib/db';

import { openai, splitTextIntoChunks } from '@/lib/openai';
import { SYSTEM_PROMPTS, formatPDFUserMessage } from '@/lib/prompts';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'sessions') {
      const pdfIdParam = searchParams.get('pdfId');
      const sessions = pdfIdParam 
        ? await getSessionsByPDF(parseInt(pdfIdParam, 10))
        : await getAllSessions();

      const allPDFs = await getAllPDFs();
      const pdfMap = new Map(allPDFs.map((p) => [p.id, p.filename]));
      
      const sessionsWithPDFs = sessions.map((session) => ({
        id: session.id,
        pdfId: session.pdf_id,
        pdfName: session.pdf_id ? pdfMap.get(session.pdf_id) || null : null,
        createdAt: session.created_at,
      }));

      return NextResponse.json({ sessions: sessionsWithPDFs });
    }

    const sessionId = searchParams.get('sessionId');
    const filename = searchParams.get('filename');

    let sessionIdNum: number | null = null;
    
    if (sessionId) {
      sessionIdNum = parseInt(sessionId, 10);
    } else if (filename) {
      const pdf = await getPDFByFilename(filename);
      if (pdf) {
        const sessions = await getSessionsByPDF(pdf.id);
        sessionIdNum = sessions[0]?.id || null;
      }
    }

    if (!sessionIdNum) {
      return NextResponse.json({ messages: [], sessionId: null });
    }

    const history = await getConversationHistory(sessionIdNum, 100);
    const messages = history.map(msg => ({
      id: msg.id.toString(),
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at),
    }));

    return NextResponse.json({ messages, sessionId: sessionIdNum });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Request failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {}
    static fromMatrix() { return new DOMMatrix(); }
  } as typeof DOMMatrix;
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
  } as typeof ImageData;
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {} as typeof Path2D;
}

async function parsePDF(buffer: Buffer | Uint8Array) {
  // eslint hates this for some reason fix later
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
  const bufferData = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return await pdfParse(bufferData);
}

export async function DELETE(request: NextRequest) {
  try {
    await initDatabase();

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const sessionIdNum = parseInt(sessionId, 10);
    await deleteSession(sessionIdNum);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Request failed';
    return NextResponse.json( { error: errorMessage }, { status: 500 } );
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const contentType = request.headers.get('content-type') || '';

    if (action === 'upload' || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
      }



      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uint8Array = new Uint8Array(bytes);
      
      let pdfData;
      try {
        pdfData = await parsePDF(uint8Array);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        return NextResponse.json({ 
          error: `Failed to parse PDF: ${errorMessage}` 
        }, { status: 500 });
      }
      
      const text = pdfData?.text || '';

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json({ error: 'PDF appears to be empty or unreadable' }, { status: 400 });
      }




      const uploadsDir = join(process.cwd(), 'uploads');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const filePath = join(uploadsDir, file.name);
      await writeFile(filePath, buffer);

      const pdfId = await getOrCreatePDF(file.name, file.size);
      
      try {
        const chunks = splitTextIntoChunks(text, 1000, 200);
        if (!Array.isArray(chunks) || chunks.length === 0) {
          throw new Error('Failed to create text chunks');
        }
        await savePDFChunks(pdfId, chunks);
      } catch (chunkError) {
        const errorMessage = chunkError instanceof Error ? chunkError.message : 'Unknown chunking error';
        return NextResponse.json({ 
          error: `Failed to process PDF text: ${errorMessage}` 
        }, { status: 500 });
      }
      
      const existingSessionId = searchParams.get('sessionId');
      let sessionId: number;
      
      if (existingSessionId) {
        const sessionIdNum = parseInt(existingSessionId, 10);

        if (!isNaN(sessionIdNum)) {
          await updateSessionPDF(sessionIdNum, pdfId);
          sessionId = sessionIdNum;
        } else {
          sessionId = await createSession(pdfId);
        }

      } else {
        sessionId = await createSession(pdfId);
      }

      return NextResponse.json({success: true, pdfId, sessionId, filename: file.name, message: 'PDF uploaded successfully.'});
    } else {
      const { message, filename, sessionId } = await request.json();

      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }

      let pdfId: number | null = null;
      let currentSessionId: number;
      
      if (sessionId) {
        currentSessionId = sessionId;
        const pdf = await getPDFByFilename(filename);
        if (pdf) {
          pdfId = pdf.id;
        }
      } else {
        if (filename) {
          const pdf = await getPDFByFilename(filename);
          if (pdf) {
            pdfId = pdf.id;
          }
        }
        currentSessionId = await createSession(pdfId);
      }

      const conversationHistory = await getConversationHistory(currentSessionId, 50);
      const historyMessages = conversationHistory
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

      await saveMessage('user', message, currentSessionId, pdfId);

      let systemMessage = SYSTEM_PROMPTS.default;
      let userMessage = message;

      if (pdfId) {
        const allChunks = await getPDFChunks(pdfId);
        if (allChunks.length > 0) {
          let relevantChunks = allChunks;
          
          if (allChunks.length > 10) {
            const searchTerms = message.toLowerCase().split(/\s+/).filter(word => word.length > 3).slice(0, 3);
            if (searchTerms.length > 0) {
              const searchResults = await Promise.all(
                searchTerms.map(term => searchPDFChunks(pdfId, term, 3))
              );
              const uniqueChunks = new Map();
              searchResults.flat().forEach(chunk => {
                uniqueChunks.set(chunk.id, chunk);
              });
              relevantChunks = Array.from(uniqueChunks.values()).slice(0, 10);
            } else {
              relevantChunks = allChunks.slice(0, 10);
            }
          }

          const pdfContext = relevantChunks.map(chunk => chunk.chunk_text).join('\n\n');
          systemMessage = SYSTEM_PROMPTS.pdfAssistant;
          userMessage = formatPDFUserMessage(pdfContext, message);
        }
      }

      const messages = [
        { role: 'system' as const, content: systemMessage },
        ...historyMessages,
        { role: 'user' as const, content: userMessage },
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      await saveMessage('assistant', response, currentSessionId, pdfId);

      return NextResponse.json({
        response,
        sessionId: currentSessionId,
      });
    }



  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Request failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


