import { join } from 'path';
import { MastraError } from '@mastra/core/error';
import { FileService } from '@mastra/deployer';

import { MASTRA_DIRECTORY } from './constants.js';

export function getMastraEntryFile(mastraDir: string) {
  try {
    const fileService = new FileService();
    return fileService.getFirstExistingFile([
      join(mastraDir, MASTRA_DIRECTORY, 'index.ts'),
      join(mastraDir, MASTRA_DIRECTORY, 'index.js'),
    ]);
  } catch (error) {
    throw new MastraError(
      {
        id: 'MASTRA_ENTRY_FILE_NOT_FOUND',
        category: 'USER',
        domain: 'DEPLOYER',
      },
      error,
    );
  }
}
