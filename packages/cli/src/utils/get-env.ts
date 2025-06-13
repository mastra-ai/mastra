import fs from 'fs';
import path from 'node:path';
import { env, cwd } from 'node:process';
import { config } from 'dotenv';

export function getEnv() {
  const projectDir = cwd();
  const dotenvPath = path.join(projectDir, '.env.development');
  if (fs.existsSync(dotenvPath)) {
    config({ path: dotenvPath });
  }
  const dbUrl = env.DB_URL || '';
  return dbUrl;
}
