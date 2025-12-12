import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getOrCreatePDF, getPDFByFilename, initDatabase, saveMessage, savePDFChunks, getPDFChunks, searchPDFChunks, getConversationHistory, createSession, getSessionsByPDF, getAllSessions, getAllPDFs, deleteSession, updateSessionPDF } from '@/lib/db';
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
      const pdfMap = new Map(allPDFs.map((p: any) => [p.id, p.filename]));
      
      const sessionsWithPDFs = sessions.map((session: any) => ({
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

    const history = await getConversationHistory(sessionIdNum, 100);
    const messages = history.map(msg => ({
      id: msg.id.toString(),
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at),
    }));

    return NextResponse.json({ messages, sessionId: sessionIdNum });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Request failed' },
      { status: 500 }
    );
  }
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {}
    static fromMatrix() { return new DOMMatrix(); }
  } as any;
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
  } as any;
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {} as any;
}

async function parsePDF(buffer: Buffer | Uint8Array) {
  const pdfParse = require('pdf-parse');
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Request failed' },
      { status: 500 }
    );
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
        console.log('PDF Parse Result:', {
          hasText: !!pdfData?.text,
          textLength: pdfData?.text?.length,
          keys: Object.keys(pdfData || {}).slice(0, 10),
          type: typeof pdfData,
          docType: typeof pdfData?.doc,
          docValue: pdfData?.doc,
          docKeys: pdfData?.doc ? Object.keys(pdfData.doc).slice(0, 10) : null,
          docHasText: !!pdfData?.doc?.text,
          docTextLength: pdfData?.doc?.text?.length,
          progress: pdfData?.progress
        });
      } catch (parseError: any) {
        console.error('PDF Parse Error:', parseError);
        return NextResponse.json({ 
          error: `Failed to parse PDF: ${parseError.message}` 
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
      } catch (chunkError: any) {
        console.error('Chunking error:', chunkError);
        return NextResponse.json({ 
          error: `Failed to process PDF text: ${chunkError.message}` 
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

      return NextResponse.json({
        success: true,
        pdfId,
        sessionId,
        filename: file.name,
        message: 'PDF uploaded successfully.',
      });
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

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Request failed' },
      { status: 500 }
    );
  }
}
