import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileService } from './service.file';

describe('FileService', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mastra-file-service-'));
    filePath = path.join(tempDir, 'template.txt');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(['$&-literal', '$$', '$`', "$'"])('writes the replacement value %s literally', replacement => {
    fs.writeFileSync(filePath, 'before-TOKEN-after');

    new FileService().replaceValuesInFile({
      filePath,
      replacements: [{ search: 'TOKEN', replace: replacement }],
    });

    expect(fs.readFileSync(filePath, 'utf8')).toBe(`before-${replacement}-after`);
  });
});
