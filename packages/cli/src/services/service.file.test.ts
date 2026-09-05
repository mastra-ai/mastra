import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FileService } from './service.file';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('FileService.replaceValuesInFile', () => {
  it.each(['$&', '$$', '$`', "$'"])('writes %s replacement tokens literally', replacement => {
    const directory = mkdtempSync(join(tmpdir(), 'mastra-file-service-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'template.txt');
    writeFileSync(filePath, 'before-TOKEN-after');

    new FileService().replaceValuesInFile({
      filePath,
      replacements: [{ search: 'TOKEN', replace: `${replacement}-literal` }],
    });

    expect(readFileSync(filePath, 'utf8')).toBe(`before-${replacement}-literal-after`);
  });
});
