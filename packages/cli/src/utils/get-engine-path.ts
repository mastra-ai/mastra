import { cwd } from 'node:process';
import path from 'path';

import { FileService } from '../services/service.file';

export function getEnginePath() {
  const possibleEnginePaths = [
    path.resolve(cwd(), 'node_modules', '@mastra/engine'),
    path.resolve(cwd(), '..', 'node_modules', '@mastra/engine'),
    path.resolve(cwd(), '..', '..', 'node_modules', '@mastra/engine'),
    path.resolve(cwd(), './packages/engine'), // For CI
  ];

  const fileService = new FileService();
  return fileService.getFirstExistingFile(possibleEnginePaths);
}
