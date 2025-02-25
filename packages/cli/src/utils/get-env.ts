import fs from 'fs';
import path from 'node:path';
import { config } from 'dotenv';

export function getEnv() {
  const projectDir = process.cwd();
  const dotenvPath = path.join(projectDir, '.env.development');
  if (fs.existsSync(dotenvPath)) {
    config({ path: dotenvPath });
  }
  const dbUrl = process.env.DB_URL || '';
  return dbUrl;
}
