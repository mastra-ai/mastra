import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_read_file', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it.each([25, 100])('returns well-formed Unicode with a %s-token budget', async maxOutputTokens => {
    const content = 'a'.repeat(100) + '😀' + 'b'.repeat(100);
    await fs.writeFile(path.join(tempDir, 'unicode.txt'), content, 'utf8');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { maxOutputTokens } },
    });
    const tools = await createWorkspaceTools(workspace);
    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'unicode.txt', showLineNumbers: false },
      { workspace },
    );

    expect(typeof result).toBe('string');
    if (typeof result !== 'string') throw new Error('Expected text output');
    expect(() => encodeURIComponent(result)).not.toThrow();
    if (maxOutputTokens === 25) {
      expect(result).toContain('a'.repeat(100) + '\uFFFD');
      expect(result).toContain('[output truncated:');
    } else {
      expect(result).toContain(content);
      expect(result).not.toContain('[output truncated:');
    }
  });

  it('should read file content with line numbers by default', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'test.txt' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('test.txt');
    expect(result).toContain('11 bytes');
    expect(result).toContain('1→Hello World');
  });

  it('should read file content without line numbers when showLineNumbers is false', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      {
        path: 'test.txt',
        showLineNumbers: false,
      },
      { workspace },
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('Hello World');
    expect(result).not.toContain('→Hello World');
  });

  it('should read file with offset and limit', async () => {
    const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    await fs.writeFile(path.join(tempDir, 'test.txt'), content);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      {
        path: 'test.txt',
        offset: 2,
        limit: 2,
        showLineNumbers: false,
      },
      { workspace },
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('lines 2-3 of 5');
    expect(result).toContain('Line 2\nLine 3');
  });

  it('should report an empty range when offset is past the end of the file', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Line 1\nLine 2\nLine 3');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      {
        path: 'test.txt',
        offset: 10,
        limit: 5,
      },
      { workspace },
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('lines 0-0 of 3');
    expect(result).not.toContain('lines 10-3 of 3');
    expect(result).not.toContain('10→');
  });

  it('should preserve line numbers for real blank lines', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Line 1\n\nLine 3');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      {
        path: 'test.txt',
        offset: 2,
        limit: 1,
      },
      { workspace },
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('lines 2-2 of 3');
    expect(result).toContain('2→');
  });

  it('should handle binary content', async () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
    await fs.writeFile(path.join(tempDir, 'binary.bin'), buffer);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'binary.bin' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('binary.bin');
    expect(result).toContain('4 bytes');
  });

  it('should return a media tool result for image files with no explicit encoding', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'pixel.png' },
      { workspace },
    )) as any;

    expect(result).toMatchObject({
      __workspaceMedia: true,
      mediaType: 'image/png',
      data: png.toString('base64'),
    });
    expect(result.text).toContain('pixel.png');
    expect(result.text).toContain('image/png');

    const tool = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
    const modelOutput = tool.toModelOutput?.(result);
    expect(modelOutput).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: result.text },
        { type: 'media', data: png.toString('base64'), mediaType: 'image/png' },
      ],
    });
  });

  it('should return a media tool result for PDFs with no explicit encoding', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 test', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'doc.pdf'), pdfBytes);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'doc.pdf' },
      { workspace },
    )) as any;

    expect(result).toMatchObject({
      __workspaceMedia: true,
      mediaType: 'application/pdf',
      data: pdfBytes.toString('base64'),
    });
  });

  it('should not return a media tool result when mediaTypes is false', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { mediaTypes: false },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'pixel.png' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('pixel.png');
  });

  it('should not inline PDFs when mediaTypes is restricted to images', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 test', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'doc.pdf'), pdfBytes);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { mediaTypes: ['image/*'] },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'doc.pdf' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('doc.pdf');
  });

  it('should still inline images when mediaTypes is restricted to images', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { mediaTypes: ['image/*'] },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'pixel.png' },
      { workspace },
    )) as any;

    expect(result).toMatchObject({
      __workspaceMedia: true,
      mediaType: 'image/png',
    });
  });

  it('should support a custom mediaTypes predicate function', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    await fs.writeFile(path.join(tempDir, 'doc.pdf'), Buffer.from('%PDF-1.4 test'));
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        // Only inline PDFs via custom predicate; skip images.
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
          mediaTypes: (mime: string) => mime === 'application/pdf',
        },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const pngResult = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'pixel.png' }, { workspace });
    expect(typeof pngResult).toBe('string');

    const pdfResult = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'doc.pdf' },
      { workspace },
    )) as any;
    expect(pdfResult).toMatchObject({ __workspaceMedia: true, mediaType: 'application/pdf' });
  });

  it('should surface configured media even when an explicit encoding is provided (strict-schema providers)', async () => {
    // Strict-schema providers always populate the optional `encoding` arg, so a
    // configured media type must still surface as a media part regardless.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'pixel.png', encoding: 'base64' },
      { workspace },
    );

    expect(result).toMatchObject({ __workspaceMedia: true, mediaType: 'image/png' });
  });

  it('should not return media result when mediaTypes is disabled via config', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { mediaTypes: false } },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'pixel.png' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).not.toMatchObject({ __workspaceMedia: true });
  });

  it('should respect a custom mediaTypes mime pattern list', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const pdf = Buffer.from('%PDF-1.4', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    await fs.writeFile(path.join(tempDir, 'doc.pdf'), pdf);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { mediaTypes: ['image/*'] } },
    });
    const tools = await createWorkspaceTools(workspace);

    const pngResult = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'pixel.png' },
      { workspace },
    )) as any;
    expect(pngResult).toMatchObject({ __workspaceMedia: true, mediaType: 'image/png' });

    const pdfResult = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'doc.pdf' }, { workspace });
    expect(typeof pdfResult).toBe('string');
  });

  it('toModelOutput returns undefined for string results so they are not duplicated on providerMetadata', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'test.txt' }, { workspace });
    const tool = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];
    const modelOutput = tool.toModelOutput?.(result);

    expect(modelOutput).toBeUndefined();
  });

  it('should return metadata only for binary files that are not in mediaTypes and not text-readable', async () => {
    // PNG isn't text-readable; with mediaTypes disabled it should fall through to metadata.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { mediaTypes: false } },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'pixel.png' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain('pixel.png');
    expect(result).toContain('image/png');
    expect(result).toContain('binary file not readable as text');
    // Should NOT dump the base64 contents.
    expect(result).not.toContain(png.toString('base64'));
  });

  it('should return metadata only for PDFs when mediaTypes is restricted to images', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 test', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'doc.pdf'), pdfBytes);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { mediaTypes: ['image/*'] } },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'doc.pdf' },
      { workspace },
    )) as string;

    expect(result).toContain('doc.pdf');
    expect(result).toContain('application/pdf');
    expect(result).toContain('binary file not readable as text');
    expect(result).not.toContain(pdfBytes.toString('base64'));
  });

  it('should still read text-like files as text', async () => {
    await fs.writeFile(path.join(tempDir, 'data.json'), '{"hello":"world"}');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'data.json' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain('{"hello":"world"}');
    expect(result).not.toContain('binary file not readable as text');
  });

  it.each([
    ['events.jsonl', '{"a":1}'],
    ['index.php', '<?php echo "hi";'],
    ['main.dart', 'void main() => print("hi");'],
  ])('should read %s as text although its mime type is application/*', async (name, content) => {
    await fs.writeFile(path.join(tempDir, name), content);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: name }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain(content);
    expect(result).not.toContain('binary file not readable as text');
  });

  it.each([
    'application/jsonl',
    'application/x-jsonl',
    'application/ndjson',
    'application/x-ndjson',
    'application/jsonlines',
    'application/json-lines',
    'application/x-jsonlines',
    'Application/X-NDJSON; charset=utf-8',
    'application/jsonl; charset=UTF-8',
    'application/x-ndjson; profile="https://example.test/a;charset=v1"; charset=utf-8',
  ])('reads line-delimited JSON with MIME type %s as paginated text', async mimeType => {
    await fs.writeFile(path.join(tempDir, 'events.ndjson'), '{"a":1}\n{"a":2}\n{"a":3}');
    class NDJSONFilesystem extends LocalFilesystem {
      override async stat(filePath: string) {
        return { ...(await super.stat(filePath)), mimeType };
      }
    }
    const workspace = new Workspace({ filesystem: new NDJSONFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'events.ndjson', offset: 2, limit: 1, showLineNumbers: false },
      { workspace },
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('lines 2-2 of 3');
    expect(result).toContain('{"a":2}');
    expect(result).not.toContain('{"a":1}');
    expect(result).not.toContain('{"a":3}');
    expect(result).not.toContain('binary file not readable as text');
  });

  it.each([
    'application/x-ndjson; charset=utf-16le',
    'text/plain; charset="UTF-16"',
    'application/json; charset=latin1',
    'application/json; profile="https://example.test/a;charset=utf-8"; charset=utf-16le',
  ])('returns binary metadata for MIME type %s instead of decoding it as utf-8', async mimeType => {
    await fs.writeFile(path.join(tempDir, 'events.ndjson'), Buffer.from('{"a":1}\n', 'utf16le'));
    class CharsetFilesystem extends LocalFilesystem {
      override async stat(filePath: string) {
        return { ...(await super.stat(filePath)), mimeType };
      }
    }
    const workspace = new Workspace({ filesystem: new CharsetFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'events.ndjson' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('binary file not readable as text');
    expect(result).toContain(mimeType);
  });

  it('should read files with unknown extensions as text (octet-stream fallback)', async () => {
    // An unknown extension maps to application/octet-stream but is likely text.
    await fs.writeFile(path.join(tempDir, 'app.log'), 'INFO server started\nWARN slow query');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'app.log' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain('INFO server started');
    expect(result).not.toContain('binary file not readable as text');
  });

  it('should read files whose extension matches an Object.prototype member as text', async () => {
    // Extensions like .constructor / .__proto__ must not resolve to inherited object
    // properties; they should fall back to application/octet-stream and read as text.
    await fs.writeFile(path.join(tempDir, 'file.constructor'), 'plain text contents');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'file.constructor' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain('plain text contents');
  });

  it('should read extensionless files as text', async () => {
    // Files like Makefile, Dockerfile, LICENSE etc. have no extension.
    await fs.writeFile(path.join(tempDir, 'Dockerfile'), 'FROM node:20\nWORKDIR /app');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'Dockerfile' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain('FROM node:20');
    expect(result).not.toContain('binary file not readable as text');
  });

  it('should return metadata only for known binary extensions (zip, exe, etc.)', async () => {
    // Zip files have a known binary mime, so should hit the metadata branch.
    const zipBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    await fs.writeFile(path.join(tempDir, 'archive.zip'), zipBytes);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'archive.zip' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain('archive.zip');
    expect(result).toContain('application/zip');
    expect(result).toContain('binary file not readable as text');
    expect(result).not.toContain(zipBytes.toString('base64'));
  });

  it('should return metadata only for .bin / .dat files', async () => {
    const bytes = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    await fs.writeFile(path.join(tempDir, 'data.bin'), bytes);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'data.bin' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain('data.bin');
    expect(result).toContain('binary file not readable as text');
  });

  it('should still read non-media binary files as base64 when encoding is explicit', async () => {
    // A zip isn't a configured media type, so an explicit encoding still lets
    // the caller dump its raw bytes as base64.
    const zipBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0xff]);
    await fs.writeFile(path.join(tempDir, 'archive.zip'), zipBytes);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'archive.zip', encoding: 'base64' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain(zipBytes.toString('base64'));
  });

  it('should not surface SVG as a media part by default', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'icon.svg'), svg);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'icon.svg' }, { workspace });

    // SVG is not in the default cross-provider-safe set. It's also a text
    // format, so it should be returned as text rather than a media part.
    expect(typeof result).toBe('string');
    expect(result).not.toMatchObject({ __workspaceMedia: true });
    expect(result).toContain('<svg');
  });

  it('should surface SVG as media when mediaTypes is broadened to image/*', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf-8');
    await fs.writeFile(path.join(tempDir, 'icon.svg'), svg);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
          mediaTypes: ['image/*'],
        },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'icon.svg' },
      { workspace },
    )) as any;

    expect(result).toMatchObject({
      __workspaceMedia: true,
      mediaType: 'image/svg+xml',
    });
  });

  it('should fall back to metadata when media file exceeds maxMediaBytes', async () => {
    // 2 KiB PNG-like blob (header valid; bytes are fine for size check)
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2048)]);
    await fs.writeFile(path.join(tempDir, 'big.png'), png);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
          maxMediaBytes: 1024,
        },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'big.png' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).not.toMatchObject({ __workspaceMedia: true });
    expect(result).toContain('exceeds maxMediaBytes');
    expect(result).toContain('big.png');
    expect(result).toContain('image/png');
  });

  it('should read oversized media as raw bytes when an explicit encoding is provided', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2048)]);
    await fs.writeFile(path.join(tempDir, 'big.png'), png);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
          maxMediaBytes: 1024,
        },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'big.png', encoding: 'base64' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).not.toMatchObject({ __workspaceMedia: true });
    expect(result).toContain(png.toString('base64'));
  });

  it('should still inline media within the maxMediaBytes cap', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(tempDir, 'small.png'), png);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
          maxMediaBytes: 1024,
        },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'small.png' },
      { workspace },
    )) as any;

    expect(result).toMatchObject({
      __workspaceMedia: true,
      mediaType: 'image/png',
    });
  });

  it('should reject offset that is not a positive integer', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);
    const tool = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];

    const parsed = tool.inputSchema.safeParse({ path: 'test.txt', offset: 0 });
    expect(parsed.success).toBe(false);

    const negative = tool.inputSchema.safeParse({ path: 'test.txt', offset: -1 });
    expect(negative.success).toBe(false);

    const fractional = tool.inputSchema.safeParse({ path: 'test.txt', offset: 1.5 });
    expect(fractional.success).toBe(false);
  });

  it('should reject limit that is not a positive integer', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);
    const tool = tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE];

    const zero = tool.inputSchema.safeParse({ path: 'test.txt', limit: 0 });
    expect(zero.success).toBe(false);

    const negative = tool.inputSchema.safeParse({ path: 'test.txt', limit: -5 });
    expect(negative.success).toBe(false);

    const fractional = tool.inputSchema.safeParse({ path: 'test.txt', limit: 2.5 });
    expect(fractional.success).toBe(false);
  });

  it('should throw a descriptive error for invalid mediaTypes patterns', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
          mediaTypes: ['image/png', 'not-a-mime-type'],
        },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    await expect(
      tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'test.txt' }, { workspace }),
    ).rejects.toThrow(/Invalid `mediaTypes` pattern.*not-a-mime-type/);
  });

  it('should accept mime types with suffixes like application/vnd.api+json', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
          mediaTypes: ['application/vnd.api+json', 'image/*'],
        },
      },
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'test.txt' }, { workspace });
    expect(typeof result).toBe('string');
  });

  it('should apply token limit to large files', async () => {
    // Create a file with many words that will exceed default token limit (~3k tokens)
    const lines = Array.from({ length: 2000 }, (_, i) => `line ${i + 1} with some words here`);
    const content = lines.join('\n');
    await fs.writeFile(path.join(tempDir, 'huge.txt'), content);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'huge.txt' },
      { workspace },
    )) as string;

    expect(result).toContain('[output truncated');
  });

  describe('media content check', () => {
    // A download that got a rate-limit page instead of the PDF, saved as `.pdf`. Sent as
    // application/pdf, the provider answers 400 `invalid_file` and the run ends.
    const RATE_LIMIT_PAGE =
      '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>429 Too Many Requests</title></head>\n' +
      '<body><h1>429 Too Many Requests</h1><p>You have sent too many requests. Please wait a few minutes and try again.</p></body>\n</html>\n';
    // 1x1 transparent PNG.
    const PNG_1X1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    // 1x1 lossless WebP (RIFF....WEBPVP8L) and 1x1 greyscale JFIF JPEG; both decode with ffprobe.
    const WEBP_1X1 = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
    const JPEG_1X1 = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      'base64',
    );
    // A complete one-page PDF 1.4 (catalog, page tree, page, xref, trailer).
    const MINIMAL_PDF = Buffer.from(
      [
        '%PDF-1.4',
        '%\xe2\xe3\xcf\xd3',
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj',
        'xref',
        '0 4',
        '0000000000 65535 f ',
        '0000000015 00000 n ',
        '0000000064 00000 n ',
        '0000000121 00000 n ',
        'trailer << /Size 4 /Root 1 0 R >>',
        'startxref',
        '192',
        '%%EOF',
        '',
      ].join('\n'),
      'latin1',
    );

    async function read(name: string, content: Buffer | string, input: Record<string, unknown> = {}) {
      await fs.writeFile(path.join(tempDir, name), content);
      const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
      const tools = await createWorkspaceTools(workspace);
      return (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
        { path: name, ...input },
        { workspace },
      )) as any;
    }

    it('reads an HTML page named .pdf as text instead of sending it as a PDF', async () => {
      const result = await read('report.pdf', RATE_LIMIT_PAGE);

      expect(typeof result).toBe('string');
      expect(result).toContain(`${Buffer.byteLength(RATE_LIMIT_PAGE)} bytes`);
      expect(result).toContain('the extension says application/pdf, but the content is not a valid file of that type');
      expect(result).toContain('<h1>429 Too Many Requests</h1>');
    });

    it('reads a text file that mentions %PDF- as text, since it has no PDF version header', async () => {
      const result = await read('notes.pdf', 'PDF files start with %PDF- and a version number.\n');

      expect(typeof result).toBe('string');
      expect(result).toContain('showing it as text');
      expect(result).toContain('PDF files start with %PDF-');
    });

    it('returns metadata only when binary content follows a first KiB of text', async () => {
      const content = Buffer.concat([Buffer.from('a'.repeat(1100)), Buffer.from([0x00, 0xff, 0xfe, 0x00])]);

      const result = await read('report.pdf', content);

      expect(typeof result).toBe('string');
      expect(result).toContain('not sent as media');
      expect(result).not.toContain('a'.repeat(100));
    });

    it('returns metadata only for binary content named .png that is not a PNG', async () => {
      const result = await read('broken.png', Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00]));

      expect(typeof result).toBe('string');
      expect(result).toContain('broken.png (6 bytes)');
      expect(result).toContain('not sent as media');
    });

    it('returns raw bytes for mislabeled binary content when an encoding is given', async () => {
      const result = await read('broken.png', Buffer.from([0x00, 0x01, 0x02]), { encoding: 'hex' });

      expect(typeof result).toBe('string');
      expect(result).toContain('000102');
    });

    it('still sends a real PDF as media', async () => {
      const result = await read('real.pdf', MINIMAL_PDF);

      expect(result).toMatchObject({
        __workspaceMedia: true,
        mediaType: 'application/pdf',
        data: MINIMAL_PDF.toString('base64'),
      });
    });

    it('still sends a real PNG as media', async () => {
      const result = await read('real.png', PNG_1X1);

      expect(result).toMatchObject({
        __workspaceMedia: true,
        mediaType: 'image/png',
        data: PNG_1X1.toString('base64'),
      });
    });

    // Screenshots saved as `.png` that are really WebP. Sent as image/png, the provider answers 400
    // ("specified using the image/png media type, but the image appears to be a image/webp image"),
    // and the retry carries the same part.
    it.each([
      ['a WebP named .png', 'screenshot.png', WEBP_1X1, 'image/webp'],
      ['a PNG named .jpg', 'photo.jpg', PNG_1X1, 'image/png'],
      ['a JPEG named .png', 'photo.png', JPEG_1X1, 'image/jpeg'],
    ])('sends %s under the type its bytes show', async (_label, name, bytes, mediaType) => {
      const result = await read(name, bytes);

      expect(result).toMatchObject({ __workspaceMedia: true, mediaType, data: bytes.toString('base64') });
      expect(result.text).toContain(mediaType);
      // The part the provider receives carries the sniffed type, not the extension's.
      const tools = await createWorkspaceTools(
        new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) }),
      );
      expect(tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].toModelOutput?.(result)).toEqual({
        type: 'content',
        value: [
          { type: 'text', text: result.text },
          { type: 'media', data: bytes.toString('base64'), mediaType },
        ],
      });
    });
  });
});
