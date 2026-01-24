import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load test environment variables
config({ path: path.resolve(__dirname, '../../.env.test') });

// Ensure test environment
if (!process.env.DATABASE_URL?.includes('test')) {
  throw new Error('Integration tests must run against a test database!');
}
