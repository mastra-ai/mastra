import { join } from 'path';
import { MastraError } from '@mastra/core/error';
import { FileService } from '@mastra/deployer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MASTRA_DIRECTORY } from './constants.js';
import { getMastraEntryFile } from './file.js';

vi.mock('@mastra/deployer');
vi.mock('./constants.js', () => ({
  MASTRA_DIRECTORY: 'src/mastra',
}));

describe('getMastraEntryFile', () => {
  let mockFileService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileService = {
      getFirstExistingFile: vi.fn(),
    };
    vi.mocked(FileService).mockImplementation(() => mockFileService);
  });

  it('should return the first existing mastra entry file', () => {
    const mastraDir = '/test/project';
    const expectedFile = join(mastraDir, MASTRA_DIRECTORY, 'index.ts');

    mockFileService.getFirstExistingFile.mockReturnValue(expectedFile);

    const result = getMastraEntryFile(mastraDir);

    expect(result).toBe(expectedFile);
    expect(mockFileService.getFirstExistingFile).toHaveBeenCalledWith([
      join(mastraDir, MASTRA_DIRECTORY, 'index.ts'),
      join(mastraDir, MASTRA_DIRECTORY, 'index.js'),
    ]);
  });

  it('should throw MastraError when no entry file is found', () => {
    const mastraDir = '/test/project';
    const originalError = new Error('No files found');

    mockFileService.getFirstExistingFile.mockImplementation(() => {
      throw originalError;
    });

    expect(() => getMastraEntryFile(mastraDir)).toThrow(MastraError);

    try {
      getMastraEntryFile(mastraDir);
    } catch (error) {
      expect(error).toBeInstanceOf(MastraError);
      expect((error as MastraError).id).toBe('MASTRA_ENTRY_FILE_NOT_FOUND');
      expect((error as MastraError).domain).toBe('DEPLOYER');
      expect((error as MastraError).category).toBe('USER');
      expect((error as MastraError).cause).toBe(originalError);
    }
  });

  it('should check for both .ts and .js files', () => {
    const mastraDir = '/custom/path';
    mockFileService.getFirstExistingFile.mockReturnValue(join(mastraDir, MASTRA_DIRECTORY, 'index.js'));

    getMastraEntryFile(mastraDir);

    const calledPaths = mockFileService.getFirstExistingFile.mock.calls[0][0];
    expect(calledPaths).toHaveLength(2);
    expect(calledPaths[0]).toContain('index.ts');
    expect(calledPaths[1]).toContain('index.js');
  });

  it('should use the MASTRA_DIRECTORY constant correctly', () => {
    const mastraDir = '/test/project';
    mockFileService.getFirstExistingFile.mockReturnValue('some/path');

    getMastraEntryFile(mastraDir);

    const calledPaths = mockFileService.getFirstExistingFile.mock.calls[0][0];
    expect(calledPaths[0]).toContain(MASTRA_DIRECTORY);
    expect(calledPaths[1]).toContain(MASTRA_DIRECTORY);
  });
});
