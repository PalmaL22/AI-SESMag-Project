import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'node:fs';
import { initDatabase } from '@/lib/db';

const envPath = resolve(process.cwd(), '.env.local');

if (!existsSync(envPath)) {
  console.error('Error: .env.local file not found');
  process.exit(1);
}

const result = config({ path: envPath });
if (result.error) {
  console.error('Error loading .env.local:', result.error.message);
  process.exit(1);

}

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL not found');
    process.exit(1);
  }

  try {
    await initDatabase();
    console.log('Database tables created');
    process.exit(0);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    process.exit(1);
  }

   //
  //
}

setupDatabase();
