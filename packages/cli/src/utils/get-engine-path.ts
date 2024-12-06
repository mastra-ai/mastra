import path from 'path';

import { getFirstExistingFile } from './get-first-existing-file.js';

export function getEnginePath() {
  const possibleEnginePaths = [
    path.resolve(process.cwd(), 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), '..', 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), '..', '..', 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), './packages/engine'), // For CI
  ];

  return getFirstExistingFile(possibleEnginePaths);
}
