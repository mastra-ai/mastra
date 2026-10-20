import { AgentControllerChannels, CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
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
  it('is not offered without a chat thread to post to', async () => {
    const requestContext = new RequestContext();
    requestContext.set('channel', { platform: 'slack', isDM: true });
    await expect(createShareFileTool(requestContext)).resolves.toEqual({});
  });

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

  /**
   * A run woken by a signal (a subagent finishing, a schedule firing) starts
   * with no render context on `requestContext`: only inbound platform messages
   * stash one. That is the run that ends a long job with a file to hand back,
   * so the tool must find the thread the same way the output processor does —
   * from the channel coordinates persisted on the Mastra thread.
   */
  describe('on a signal-woken run', () => {
    async function wokenRun({ threadMetadata }: { threadMetadata?: Record<string, unknown> } = {}) {
      const storage = new InMemoryStore();
      const memory = await storage.getStore('memory');
      await memory!.saveThread({
        thread: {
          id: 'thread-1',
          resourceId: 'resource-1',
          title: 'slack dm',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: threadMetadata ?? { channel_platform: 'slack', channel_externalThreadId: 'slack:C1:171.1' },
        },
      });

      const post = vi.fn(async () => ({}));
      const adapter = { name: 'slack', startTyping: vi.fn() };
      const channels = new AgentControllerChannels({
        adapters: { slack: { adapter, streaming: false } as any },
      });
      // Bind the bits of a controller that `buildRenderContextForThread` reads:
      // storage via Mastra, and the Chat instance that hands out live threads.
      channels.__setController({ id: 'mastra-code', getMastra: () => ({ getStorage: () => storage }) } as any);
      (channels as any).chat = {
        thread: (id: string) => {
          expect(id).toBe('slack:C1:171.1');
          return { id, adapter, post };
        },
      };

      const requestContext = new RequestContext();
      requestContext.set('controller', {
        threadId: 'thread-1',
        workspace: {
          filesystem: {
            stat: vi.fn(async () => ({ type: 'file', size: 4, mimeType: 'application/pdf' })),
            readFile: vi.fn(async () => Buffer.from('data')),
          },
        },
      });
      return { requestContext, channels, post };
    }

    it('is offered and posts into the thread recorded on the Mastra thread', async () => {
      const { requestContext, channels, post } = await wokenRun();
      expect(requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY)).toBeUndefined();

      const tools = await createShareFileTool(requestContext, { channels: () => channels });
      expect(tools).toHaveProperty('attach_file');

      await (tools.attach_file as AttachFile).execute({ path: '/workspace/report.pdf' }, {});
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({ files: [expect.objectContaining({ filename: 'report.pdf' })] }),
      );
    });

    it('stays off a thread that was never channel-backed, such as a subagent fork', async () => {
      const { requestContext, channels } = await wokenRun({ threadMetadata: { forkedSubagent: true } });
      await expect(createShareFileTool(requestContext, { channels: () => channels })).resolves.toEqual({});
    });

    it('stays off when the controller has no channels', async () => {
      const { requestContext } = await wokenRun();
      await expect(createShareFileTool(requestContext, { channels: () => null })).resolves.toEqual({});
      await expect(createShareFileTool(requestContext)).resolves.toEqual({});
    });
  });
});
