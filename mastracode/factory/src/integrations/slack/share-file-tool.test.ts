import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createShareFileTool, SHARE_FILE_MAX_BYTES } from './share-file-tool.js';

type AttachFile = {
  execute: (input: { path: string }, ctx: Record<string, unknown>) => Promise<unknown>;
};

async function setup({
  size = 12,
  type = 'file' as 'file' | 'directory',
  mimeType = 'application/pdf',
  contents = Buffer.from('hello report'),
  post = vi.fn(async () => ({})),
} = {}) {
  const fs = {
    stat: vi.fn(async (path: string) => ({ name: path.split('/').pop(), path, type, size, mimeType })),
    readFile: vi.fn(async () => contents),
  };
  const requestContext = new RequestContext();
  requestContext.set('channel', { platform: 'slack', isDM: true });
  requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { platform: 'slack', chatThread: { post } });
  requestContext.set('controller', { workspace: { filesystem: fs } });
  const tool = (await createShareFileTool(requestContext)).attach_file as AttachFile;
  return { tool, post, fs };
}

/** What `@slack/web-api` throws when the app lacks a scope: the API body is on `data`. */
function slackPlatformError(data: Record<string, unknown>) {
  return Object.assign(new Error('An API error occurred: missing_scope'), {
    code: 'slack_webapi_platform_error',
    data,
  });
}

describe('attach_file', () => {
  it('reads the file through the workspace filesystem and posts it as an attachment', async () => {
    const { tool, post, fs } = await setup();

    await expect(tool.execute({ path: '/workspace/report.pdf' }, {})).resolves.toEqual({
      attached: true,
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
    const dir = await setup({ type: 'directory' });
    await expect(dir.tool.execute({ path: '/workspace' }, {})).rejects.toThrow(/is a directory/);
    expect(dir.fs.readFile).not.toHaveBeenCalled();

    const big = await setup({ size: SHARE_FILE_MAX_BYTES + 1 });
    await expect(big.tool.execute({ path: '/workspace/huge.bin' }, {})).rejects.toThrow(/limit/);
    expect(big.fs.readFile).not.toHaveBeenCalled();
  });

  it('bounds the upload by the bytes actually read, not the earlier stat', async () => {
    // The file grew between stat and read; the stale size must not let it through.
    const grown = await setup({ size: 12, contents: Buffer.alloc(SHARE_FILE_MAX_BYTES + 1) });
    await expect(grown.tool.execute({ path: '/workspace/grew.bin' }, {})).rejects.toThrow(/limit/);
    expect(grown.post).not.toHaveBeenCalled();

    // And the reported size is what was uploaded, not what stat claimed.
    const shrunk = await setup({ size: 999, contents: Buffer.from('tiny') });
    await expect(shrunk.tool.execute({ path: '/workspace/shrunk.txt' }, {})).resolves.toMatchObject({ bytes: 4 });
  });

  it('names the missing scope when the Slack app cannot upload files', async () => {
    const { tool } = await setup({
      post: vi.fn(async () => {
        throw slackPlatformError({ ok: false, error: 'missing_scope', needed: 'files:write', provided: 'files:read' });
      }),
    });

    await expect(tool.execute({ path: '/workspace/report.pdf' }, {})).rejects.toThrow(
      'The slack app is missing the `files:write` scope',
    );
  });

  it('passes other upload failures through untouched', async () => {
    const boom = slackPlatformError({ ok: false, error: 'ratelimited' });
    const { tool } = await setup({
      post: vi.fn(async () => {
        throw boom;
      }),
    });

    await expect(tool.execute({ path: '/workspace/report.pdf' }, {})).rejects.toBe(boom);
  });

  it('fails clearly when the session has no workspace', async () => {
    const post = vi.fn();
    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { chatThread: { post } });
    const tool = (await createShareFileTool(requestContext)).attach_file as AttachFile;
    await expect(tool.execute({ path: '/x' }, {})).rejects.toThrow(/No workspace filesystem/);
    expect(post).not.toHaveBeenCalled();
  });
});
