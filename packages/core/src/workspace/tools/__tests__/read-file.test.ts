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

  it('should respect explicit encoding for media files (opt out of media result)', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'pixel.png', encoding: 'base64' },
      { workspace },
    );

    expect(typeof result).toBe('string');
    expect(result).toContain('pixel.png');
    expect(result).toContain('base64');
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

  it('should still read binary files as base64 when encoding is explicit', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(tempDir, 'pixel.png'), png);
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'pixel.png', encoding: 'base64' },
      { workspace },
    )) as string;

    expect(typeof result).toBe('string');
    expect(result).toContain(png.toString('base64'));
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
});
