import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendCrashLog } from '../crash-log.js';

describe('appendCrashLog', () => {
  let tmpDir: string;
  let logFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crash-log-test-'));
    logFile = path.join(tmpDir, 'mastra-crash.log');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('keeps the file within the size limit after appending a crash record', () => {
    fs.writeFileSync(logFile, Buffer.alloc(5 * 1024 * 1024, 'a'));

    appendCrashLog('\nlatest crash\n', logFile);

    expect(fs.statSync(logFile).size).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(fs.readFileSync(logFile, 'utf8')).toContain('latest crash\n');
  });
});
