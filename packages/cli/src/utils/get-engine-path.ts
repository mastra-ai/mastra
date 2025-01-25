import path from 'path';

import { FileService } from '../services/service.file';

export function getEnginePath() {
  const possibleEnginePaths = [
    path.resolve(process.cwd(), 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), '..', 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), '..', '..', 'node_modules', '@mastra/engine'),
    path.resolve(process.cwd(), './packages/engine'), // For CI
  ];

  const fileService = new FileService();
  return fileService.getFirstExistingFile(possibleEnginePaths);
}
