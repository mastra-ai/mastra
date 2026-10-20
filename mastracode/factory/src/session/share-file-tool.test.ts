import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createShareFileTool, SHARE_FILE_MAX_BYTES } from './share-file-tool.js';

function setup({
  size = 12,
  type = 'file' as 'file' | 'directory',
  mimeType = 'application/pdf',
  contents = Buffer.from('hello report'),
} = {}) {
  const post = vi.fn(async () => ({}));
  const fs = {
    stat: vi.fn(async (path: string) => ({ name: path.split('/').pop(), path, type, size, mimeType })),
    readFile: vi.fn(async () => contents),
  };
  const requestContext = new RequestContext();
  requestContext.set('channel', { platform: 'slack', isDM: true });
  requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { chatThread: { post } });
  requestContext.set('controller', { workspace: { filesystem: fs } });
  const tool = createShareFileTool(requestContext).share_file as {
    execute: (input: { path: string }, ctx: Record<string, unknown>) => Promise<unknown>;
  };
  return { tool, post, fs };
}

describe('share_file', () => {
  it('is not offered without a chat thread to post to', () => {
    const requestContext = new RequestContext();
    requestContext.set('channel', { platform: 'slack', isDM: true });
    expect(createShareFileTool(requestContext)).toEqual({});
  });

  it('reads the file through the workspace filesystem and posts it as an attachment', async () => {
    const { tool, post, fs } = setup();

    await expect(tool.execute({ path: '/workspace/report.pdf' }, {})).resolves.toEqual({
      shared: true,
      filename: 'report.pdf',
      bytes: 12,
    });

    expect(fs.readFile).toHaveBeenCalledWith('/workspace/report.pdf');
    // Empty body: any text here would post as a separate Slack message after the upload.
    expect(post).toHaveBeenCalledWith({
      markdown: '',
      files: [{ data: Buffer.from('hello report'), filename: 'report.pdf', mimeType: 'application/pdf' }],
    });
  });

  it('refuses directories and oversized files before reading them', async () => {
    const dir = setup({ type: 'directory' });
    await expect(dir.tool.execute({ path: '/workspace' }, {})).rejects.toThrow(/is a directory/);
    expect(dir.fs.readFile).not.toHaveBeenCalled();

    const big = setup({ size: SHARE_FILE_MAX_BYTES + 1 });
    await expect(big.tool.execute({ path: '/workspace/huge.bin' }, {})).rejects.toThrow(/limit/);
    expect(big.fs.readFile).not.toHaveBeenCalled();
  });

  it('bounds the upload by the bytes actually read, not the earlier stat', async () => {
    // The file grew between stat and read; the stale size must not let it through.
    const grown = setup({ size: 12, contents: Buffer.alloc(SHARE_FILE_MAX_BYTES + 1) });
    await expect(grown.tool.execute({ path: '/workspace/grew.bin' }, {})).rejects.toThrow(/limit/);
    expect(grown.post).not.toHaveBeenCalled();

    // And the reported size is what was uploaded, not what stat claimed.
    const shrunk = setup({ size: 999, contents: Buffer.from('tiny') });
    await expect(shrunk.tool.execute({ path: '/workspace/shrunk.txt' }, {})).resolves.toMatchObject({ bytes: 4 });
  });

  it('fails clearly when the session has no workspace', async () => {
    const post = vi.fn();
    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { chatThread: { post } });
    const tool = createShareFileTool(requestContext).share_file as {
      execute: (input: { path: string }, ctx: Record<string, unknown>) => Promise<unknown>;
    };
    await expect(tool.execute({ path: '/x' }, {})).rejects.toThrow(/No workspace filesystem/);
    expect(post).not.toHaveBeenCalled();
  });
});
