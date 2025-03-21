import { z } from 'zod';
import { createTool } from '@mastra/core';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

function getExtension(language: string): string {
  const extensionMap: Record<string, string> = {
    javascript: '.js',
    typescript: '.ts',
    python: '.py',
    java: '.java',
    html: '.html',
    css: '.css',
    json: '.json',
    // Add more mappings as needed
  };

  return extensionMap[language.toLowerCase()] || '.txt';
}

export const codeFileTool = createTool({
  id: 'code-file-tool',
  description: 'Creates a temporary file with code content and returns the file path',
  inputSchema: z.object({
    code: z.string(),
    language: z.string(),
    filename: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { code, language, filename = 'code' } = context;

    // Check if filename already has the correct extension
    const extension = getExtension(language);
    const hasCorrectExtension = filename.endsWith(extension);

    // Create a flattened filename by replacing path separators
    const baseFilename = hasCorrectExtension ? filename : `${filename}${extension}`;
    const flatFilename = baseFilename.replace(/[\/\\]/g, '_');
    const filepath = join(tmpdir(), flatFilename);

    try {
      await writeFile(filepath, code);
      return filepath;
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  },
});
