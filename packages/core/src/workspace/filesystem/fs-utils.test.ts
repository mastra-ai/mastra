/**
 * Tests for packages/core/src/workspace/filesystem/fs-utils.ts
 *
 * Six of the eight exported helpers are pure functions with no I/O —
 * they are tested directly. The two async helpers (fsExists, fsStat)
 * depend on the real filesystem and are tested with a temporary directory
 * created by Vitest's built-in `os.tmpdir()` support.
 *
 * No mocking is needed for the pure helpers; the async helpers use real
 * filesystem calls against a `tmp` directory so the tests remain simple
 * and do not carry mock-related false positives.
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileNotFoundError } from '../errors';
import {
  expandTilde,
  fsExists,
  fsStat,
  getMimeType,
  isEexistError,
  isEnoentError,
  isTextFile,
  resolveToBasePath,
} from './fs-utils';

// ---------------------------------------------------------------------------
// expandTilde
// ---------------------------------------------------------------------------

describe('expandTilde', () => {
  const home = os.homedir();

  it('expands "~" alone to the home directory', () => {
    expect(expandTilde('~')).toBe(home);
  });

  it('expands "~/" prefix to home + rest', () => {
    expect(expandTilde('~/Documents/file.txt')).toBe(path.join(home, 'Documents/file.txt'));
  });

  it('expands "~\\\\" prefix on Windows-style paths', () => {
    const result = expandTilde('~\\Documents\\file.txt');
    expect(result).toBe(path.join(home, 'Documents\\file.txt'));
  });

  it('returns an absolute path unchanged', () => {
    const abs = '/usr/local/bin/node';
    expect(expandTilde(abs)).toBe(abs);
  });

  it('returns a relative path unchanged', () => {
    expect(expandTilde('relative/path')).toBe('relative/path');
  });

  it('returns an empty string unchanged', () => {
    expect(expandTilde('')).toBe('');
  });

  it('does not expand a tilde that is not at the start', () => {
    expect(expandTilde('/home/~user')).toBe('/home/~user');
  });
});

// ---------------------------------------------------------------------------
// isEnoentError
// ---------------------------------------------------------------------------

describe('isEnoentError', () => {
  it('returns true for an object with code ENOENT', () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    expect(isEnoentError(err)).toBe(true);
  });

  it('returns false for an object with a different code', () => {
    const err = Object.assign(new Error('exists'), { code: 'EEXIST' });
    expect(isEnoentError(err)).toBe(false);
  });

  it('returns false for a plain Error without code', () => {
    expect(isEnoentError(new Error('oops'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isEnoentError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isEnoentError(undefined)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isEnoentError('ENOENT')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isEnoentError(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isEexistError
// ---------------------------------------------------------------------------

describe('isEexistError', () => {
  it('returns true for an object with code EEXIST', () => {
    const err = Object.assign(new Error('exists'), { code: 'EEXIST' });
    expect(isEexistError(err)).toBe(true);
  });

  it('returns false for an object with a different code', () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    expect(isEexistError(err)).toBe(false);
  });

  it('returns false for a plain Error without code', () => {
    expect(isEexistError(new Error('oops'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isEexistError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isEexistError(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getMimeType
// ---------------------------------------------------------------------------

describe('getMimeType', () => {
  // Text
  it('returns text/plain for .txt', () => expect(getMimeType('readme.txt')).toBe('text/plain'));
  it('returns text/html for .html', () => expect(getMimeType('index.html')).toBe('text/html'));
  it('returns text/html for .htm', () => expect(getMimeType('index.htm')).toBe('text/html'));
  it('returns text/css for .css', () => expect(getMimeType('style.css')).toBe('text/css'));
  it('returns text/markdown for .md', () => expect(getMimeType('README.md')).toBe('text/markdown'));

  // Code
  it('returns application/javascript for .js', () => expect(getMimeType('app.js')).toBe('application/javascript'));
  it('returns application/javascript for .mjs', () => expect(getMimeType('module.mjs')).toBe('application/javascript'));
  it('returns application/typescript for .ts', () => expect(getMimeType('index.ts')).toBe('application/typescript'));
  it('returns application/typescript for .tsx', () =>
    expect(getMimeType('Component.tsx')).toBe('application/typescript'));
  it('returns application/json for .json', () => expect(getMimeType('package.json')).toBe('application/json'));

  // Images
  it('returns image/png for .png', () => expect(getMimeType('logo.png')).toBe('image/png'));
  it('returns image/jpeg for .jpg', () => expect(getMimeType('photo.jpg')).toBe('image/jpeg'));
  it('returns image/jpeg for .jpeg', () => expect(getMimeType('photo.jpeg')).toBe('image/jpeg'));
  it('returns image/svg+xml for .svg', () => expect(getMimeType('icon.svg')).toBe('image/svg+xml'));
  it('returns image/webp for .webp', () => expect(getMimeType('image.webp')).toBe('image/webp'));

  // Documents
  it('returns application/pdf for .pdf', () => expect(getMimeType('doc.pdf')).toBe('application/pdf'));

  // Audio / Video
  it('returns audio/mpeg for .mp3', () => expect(getMimeType('song.mp3')).toBe('audio/mpeg'));
  it('returns video/mp4 for .mp4', () => expect(getMimeType('video.mp4')).toBe('video/mp4'));

  // Archives
  it('returns application/zip for .zip', () => expect(getMimeType('archive.zip')).toBe('application/zip'));

  // Fallback
  it('returns application/octet-stream for unknown extension', () =>
    expect(getMimeType('binary.xyz')).toBe('application/octet-stream'));

  it('returns application/octet-stream for a file with no extension', () =>
    expect(getMimeType('Makefile')).toBe('application/octet-stream'));

  it('is case-insensitive for extensions', () => expect(getMimeType('IMAGE.PNG')).toBe('image/png'));

  it('handles a filename with multiple dots correctly', () =>
    expect(getMimeType('archive.tar.gz')).toBe('application/gzip'));
});

// ---------------------------------------------------------------------------
// isTextFile
// ---------------------------------------------------------------------------

describe('isTextFile', () => {
  it('returns true for .md', () => expect(isTextFile('README.md')).toBe(true));
  it('returns true for .ts', () => expect(isTextFile('index.ts')).toBe(true));
  it('returns true for .tsx', () => expect(isTextFile('App.tsx')).toBe(true));
  it('returns true for .js', () => expect(isTextFile('app.js')).toBe(true));
  it('returns true for .json', () => expect(isTextFile('package.json')).toBe(true));
  it('returns true for .yaml', () => expect(isTextFile('config.yaml')).toBe(true));
  it('returns true for .yml', () => expect(isTextFile('config.yml')).toBe(true));
  it('returns true for .py', () => expect(isTextFile('script.py')).toBe(true));
  it('returns true for .html', () => expect(isTextFile('index.html')).toBe(true));
  it('returns true for .css', () => expect(isTextFile('style.css')).toBe(true));
  it('returns true for .svg', () => expect(isTextFile('icon.svg')).toBe(true));
  it('returns true for .sh', () => expect(isTextFile('run.sh')).toBe(true));

  it('returns false for .png', () => expect(isTextFile('image.png')).toBe(false));
  it('returns false for .pdf', () => expect(isTextFile('doc.pdf')).toBe(false));
  it('returns false for .mp3', () => expect(isTextFile('song.mp3')).toBe(false));
  it('returns false for .zip', () => expect(isTextFile('archive.zip')).toBe(false));
  it('returns false for .exe', () => expect(isTextFile('app.exe')).toBe(false));
  it('returns false for a file with no extension', () => expect(isTextFile('Makefile')).toBe(false));

  it('is case-insensitive', () => expect(isTextFile('README.MD')).toBe(true));

  // Extensions added in this PR
  it('returns true for .mdx', () => expect(isTextFile('page.mdx')).toBe(true));
  it('returns true for .scss', () => expect(isTextFile('styles.scss')).toBe(true));
  it('returns true for .sass', () => expect(isTextFile('styles.sass')).toBe(true));
  it('returns true for .less', () => expect(isTextFile('styles.less')).toBe(true));
  it('returns true for .svelte', () => expect(isTextFile('App.svelte')).toBe(true));
  it('returns true for .php', () => expect(isTextFile('index.php')).toBe(true));
  it('returns true for .kt', () => expect(isTextFile('Main.kt')).toBe(true));
  it('returns true for .tf', () => expect(isTextFile('main.tf')).toBe(true));
  it('returns true for .dart', () => expect(isTextFile('main.dart')).toBe(true));
});

// ---------------------------------------------------------------------------
// resolveToBasePath
// ---------------------------------------------------------------------------

describe('resolveToBasePath', () => {
  const base = '/workspace/project';

  it('resolves a relative path against basePath', () => {
    expect(resolveToBasePath(base, 'src/index.ts')).toBe('/workspace/project/src/index.ts');
  });

  it('resolves "../" traversal relative to basePath', () => {
    expect(resolveToBasePath(base, '../other/file.ts')).toBe('/workspace/other/file.ts');
  });

  it('returns an absolute path normalized, ignoring basePath', () => {
    expect(resolveToBasePath(base, '/absolute/path/file.ts')).toBe('/absolute/path/file.ts');
  });

  it('normalizes double slashes in an absolute path', () => {
    expect(resolveToBasePath(base, '/absolute//path')).toBe('/absolute/path');
  });

  it('expands ~ to home directory', () => {
    const result = resolveToBasePath(base, '~/Documents/file.ts');
    expect(result).toBe(path.join(os.homedir(), 'Documents/file.ts'));
  });

  it('expands ~ alone to home directory', () => {
    expect(resolveToBasePath(base, '~')).toBe(os.homedir());
  });

  it('resolves an empty relative path to basePath itself', () => {
    expect(resolveToBasePath(base, '')).toBe(base);
  });

  it('resolves "." to basePath', () => {
    expect(resolveToBasePath(base, '.')).toBe(base);
  });
});

// ---------------------------------------------------------------------------
// fsExists (async, uses real filesystem)
// ---------------------------------------------------------------------------

describe('fsExists', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-fs-utils-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns true for an existing file', async () => {
    const file = path.join(tmpDir, 'exists.txt');
    await fs.writeFile(file, 'hello');
    expect(await fsExists(file)).toBe(true);
  });

  it('returns true for an existing directory', async () => {
    expect(await fsExists(tmpDir)).toBe(true);
  });

  it('returns false for a non-existent path', async () => {
    expect(await fsExists(path.join(tmpDir, 'ghost.txt'))).toBe(false);
  });

  it('never throws — returns false on any access error', async () => {
    await expect(fsExists('/no/such/path/anywhere')).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fsStat (async, uses real filesystem)
// ---------------------------------------------------------------------------

describe('fsStat', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-fs-utils-stat-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns stat for an existing file', async () => {
    const file = path.join(tmpDir, 'test.ts');
    await fs.writeFile(file, 'export {}');

    const stat = await fsStat(file, 'test.ts');

    expect(stat.name).toBe('test.ts');
    expect(stat.type).toBe('file');
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.mimeType).toBe('application/typescript');
    expect(stat.createdAt).toBeInstanceOf(Date);
    expect(stat.modifiedAt).toBeInstanceOf(Date);
  });

  it('returns stat for a directory with mimeType undefined', async () => {
    const dir = path.join(tmpDir, 'subdir');
    await fs.mkdir(dir);

    const stat = await fsStat(dir, 'subdir');

    expect(stat.type).toBe('directory');
    // Directory size is the filesystem block size, which varies by platform
    // (e.g. 0 on some filesystems, 64 on macOS, 4096 on Linux), so only assert
    // it is a non-negative number rather than a specific value.
    expect(typeof stat.size).toBe('number');
    expect(stat.size).toBeGreaterThanOrEqual(0);
    expect(stat.mimeType).toBeUndefined();
  });

  it('throws FileNotFoundError for a non-existent path', async () => {
    await expect(fsStat(path.join(tmpDir, 'missing.txt'), 'missing.txt')).rejects.toThrow(FileNotFoundError);
  });

  it('includes the correct MIME type for a .json file', async () => {
    const file = path.join(tmpDir, 'data.json');
    await fs.writeFile(file, '{}');

    const stat = await fsStat(file, 'data.json');
    expect(stat.mimeType).toBe('application/json');
  });

  it('returns name = basename of the path', async () => {
    const file = path.join(tmpDir, 'nested.md');
    await fs.writeFile(file, '# hello');

    const stat = await fsStat(file, 'nested.md');
    expect(stat.name).toBe('nested.md');
  });
});
