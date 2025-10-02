import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';

const DEFAULT_SCORERS_DIR = 'src/mastra/scorers';

export function writeScorer(filename: string, content: string, customPath?: string): { ok: true; message: string } {
  const rootDir = process.cwd();
  const scorersPath = customPath || DEFAULT_SCORERS_DIR;
  const fullPath = path.join(rootDir, scorersPath);

  if (!fs.existsSync(fullPath)) {
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      p.log.success(`Created scorers directory at ${scorersPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create directory: ${errorMessage}`);
    }
  }

  const filePath = path.join(fullPath, filename);

  if (fs.existsSync(filePath)) {
    throw new Error(`Skipped: Scorer ${filename} already exists at ${scorersPath}`);
  }

  try {
    fs.writeFileSync(filePath, content);

    return { ok: true, message: `Created scorer at ${path.relative(rootDir, filePath)}` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write scorer: ${errorMessage}`);
  }
}
