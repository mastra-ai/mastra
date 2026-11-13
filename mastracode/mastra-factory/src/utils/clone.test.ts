import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canScaffoldInto } from './clone.js';

describe('canScaffoldInto', () => {
  let workDir: string;

  beforeEach(() => {
    // macOS reports /var/folders/... for os.tmpdir(), so resolve the real path first.
    workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'create-factory-clone-')));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('accepts a target that does not exist yet', () => {
    expect(canScaffoldInto(path.join(workDir, 'missing'))).toBe(true);
  });

  it('accepts an existing empty directory', () => {
    const target = path.join(workDir, 'empty');
    fs.mkdirSync(target);

    expect(canScaffoldInto(target)).toBe(true);
  });

  it('accepts a directory that only contains .DS_Store', () => {
    const target = path.join(workDir, 'visited-by-finder');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, '.DS_Store'), '');

    expect(canScaffoldInto(target)).toBe(true);
  });

  it('rejects a directory that contains anything else', () => {
    const target = path.join(workDir, 'occupied');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, '.DS_Store'), '');
    fs.writeFileSync(path.join(target, 'package.json'), '{}');

    expect(canScaffoldInto(target)).toBe(false);
  });

  it('rejects a target that is a file', () => {
    const target = path.join(workDir, 'file.txt');
    fs.writeFileSync(target, '');

    expect(canScaffoldInto(target)).toBe(false);
  });
});
