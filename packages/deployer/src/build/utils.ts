import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export function upsertMastraDir({ dir = process.cwd() }: { dir?: string }) {
  const dirPath = join(dir, '.mastra');

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    execSync(`echo ".mastra" >> .gitignore`);
  }
}
