import dotenv from 'dotenv';
import fs from 'fs';
import path from 'node:path';

export function getEnv() {
  const projectDir = process.cwd();
  const dotenvPath = path.join(projectDir, '.env');
  if (fs.existsSync(dotenvPath)) {
    dotenv.config({ path: dotenvPath });
  }
  const env = process.env.DB_URL || '';
  return env;
}
