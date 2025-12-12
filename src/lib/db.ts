import { Pool } from 'pg';
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export async function initDatabase() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pdfs (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_size BIGINT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        pdf_id INTEGER REFERENCES pdfs(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_history (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        pdf_id INTEGER REFERENCES pdfs(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pdf_chunks (
        id SERIAL PRIMARY KEY,
        pdf_id INTEGER NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pdf_id, chunk_index)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_pdf_id ON chat_sessions(pdf_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_history_session_id ON conversation_history(session_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at ON conversation_history(created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_history_pdf_id ON conversation_history(pdf_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_id ON pdf_chunks(pdf_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_id_index ON pdf_chunks(pdf_id, chunk_index);
    `);
  } finally {
    client.release();
  }
}

export async function getOrCreatePDF(filename: string, fileSize: number) {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'INSERT INTO pdfs (filename, file_size) VALUES ($1, $2) ON CONFLICT (filename) DO UPDATE SET file_size = $2 RETURNING id;',
      [filename, fileSize]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

export async function createSession(pdfId: number | null = null) {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'INSERT INTO chat_sessions (pdf_id) VALUES ($1) RETURNING id;',
      [pdfId]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

export async function updateSessionPDF(sessionId: number, pdfId: number | null) {
  const client = await getPool().connect();
  try {
    await client.query(
      'UPDATE chat_sessions SET pdf_id = $1 WHERE id = $2;',
      [pdfId, sessionId]
    );
  } finally {
    client.release();
  }
}

export async function saveMessage(role: 'user' | 'assistant', content: string, sessionId: number, pdfId: number | null = null) {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'INSERT INTO conversation_history (session_id, role, content, pdf_id) VALUES ($1, $2, $3, $4) RETURNING id, role, content, pdf_id, created_at;',
      [sessionId, role, content, pdfId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getConversationHistory(sessionId: number | null = null, limit: number = 100) {
  const client = await getPool().connect();
  try {
    const query = sessionId
      ? 'SELECT id, role, content, pdf_id, created_at FROM conversation_history WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2;'
      : 'SELECT id, role, content, pdf_id, created_at FROM conversation_history ORDER BY created_at DESC LIMIT $1;';
    
    const params = sessionId ? [sessionId, limit] : [limit];
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getSessionsByPDF(pdfId: number) {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'SELECT id, pdf_id, created_at FROM chat_sessions WHERE pdf_id = $1 ORDER BY created_at DESC;',
      [pdfId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getAllSessions() {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'SELECT id, pdf_id, created_at FROM chat_sessions ORDER BY created_at DESC;'
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function deleteSession(sessionId: number) {
  const client = await getPool().connect();
  try {
    await client.query('DELETE FROM chat_sessions WHERE id = $1;', [sessionId]);
  } finally {
    client.release();
  }
}

export async function getAllPDFs() {
  const client = await getPool().connect();
  try {
    const result = await client.query('SELECT id, filename, file_size FROM pdfs ORDER BY uploaded_at DESC;');
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getPDFByFilename(filename: string) {
  const client = await getPool().connect();
  try {
    const result = await client.query('SELECT id, filename, file_size FROM pdfs WHERE filename = $1;', [filename]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function savePDFChunks(pdfId: number, chunks: string[]) {
  const client = await getPool().connect();
  try {
    await client.query('DELETE FROM pdf_chunks WHERE pdf_id = $1;', [pdfId]);

    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        'INSERT INTO pdf_chunks (pdf_id, chunk_text, chunk_index) VALUES ($1, $2, $3);',
        [pdfId, chunks[i], i]
      );
    }
  } finally {
    client.release();
  }
}

export async function getPDFChunks(pdfId: number) {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'SELECT id, pdf_id, chunk_text, chunk_index FROM pdf_chunks WHERE pdf_id = $1 ORDER BY chunk_index ASC;',
      [pdfId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function searchPDFChunks(pdfId: number, searchTerm: string, limit: number = 5) {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'SELECT id, pdf_id, chunk_text, chunk_index FROM pdf_chunks WHERE pdf_id = $1 AND chunk_text ILIKE $2 ORDER BY chunk_index ASC LIMIT $3;',
      [pdfId, `%${searchTerm}%`, limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export default getPool;
