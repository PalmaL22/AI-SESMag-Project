import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getOrCreatePDF, getPDFByFilename, initDatabase, saveMessage } from '@/lib/db';
import { openai } from '@/lib/openai';

const pdfParse = require('pdf-parse');

export const runtime = 'nodejs';

// Handle PDF upload
export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const contentType = request.headers.get('content-type') || '';

    // Check if it's a file upload (multipart/form-data) or JSON chat message
    if (action === 'upload' || contentType.includes('multipart/form-data')) {
      // Handle PDF upload
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

      const pdfData = await pdfParse(buffer);
      const text = pdfData.text;

      if (!text || text.trim().length === 0) {
        return NextResponse.json({ error: 'PDF appears to be empty or unreadable' }, { status: 400 });
      }

      const uploadsDir = join(process.cwd(), 'uploads');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const filePath = join(uploadsDir, file.name);
      await writeFile(filePath, buffer);

      const pdfId = await getOrCreatePDF(file.name, file.size);

      return NextResponse.json({
        success: true,
        pdfId,
        filename: file.name,
        message: 'PDF uploaded successfully.',
      });
    } else {
      // Handle chat message
      const { message, filename } = await request.json();

      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }

      let pdfId: number | null = null;
      if (filename) {
        const pdf = await getPDFByFilename(filename);
        if (pdf) {
          pdfId = pdf.id;
        }
      }

      await saveMessage('user', message, pdfId);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      await saveMessage('assistant', response, pdfId);

      return NextResponse.json({
        response,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Request failed' },
      { status: 500 }
    );
  }
}

