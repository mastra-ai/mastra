import { RequestContext } from '@mastra/core/request-context';
import type { ChunkType } from '@mastra/core/stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FactoryChannelSessionLinkProcessor,
  markNewChannelSession,
  NEW_CHANNEL_SESSION_KEY,
} from './channel-session-link-processor.js';

const LINK = 'https://mc.example.com/factories/fp-1/workspaces/us-42/threads/uuid-thread-1';

function newSessionContext({ factoryProjectId = 'fp-1' as string | null, resourceId = 'us-42' } = {}) {
  const requestContext = new RequestContext();
  requestContext.set('controller', {
    threadId: 'uuid-thread-1',
    resourceId,
    getState: () => (factoryProjectId === null ? {} : { factoryProjectId }),
  });
  markNewChannelSession(requestContext);
  return requestContext;
}

const textDelta = (text: string, id = 't1'): ChunkType =>
  ({ type: 'text-delta', runId: 'r', from: 'AGENT', payload: { id, text } }) as ChunkType;

/** Drives the chunks through one processor instance with shared per-run state. */
async function render(requestContext: RequestContext, chunks: ChunkType[]) {
  const processor = new FactoryChannelSessionLinkProcessor();
  const state: Record<string, unknown> = {};
  const out: ChunkType[] = [];
  for (const part of chunks) {
    const result = await processor.processOutputStream({
      part,
      state,
      requestContext,
      streamParts: [],
      abort: () => {
        throw new Error('abort');
      },
    } as any);
    if (result) out.push(result);
  }
  return out;
}

describe('FactoryChannelSessionLinkProcessor', () => {
  const originalPublicUrl = process.env.MASTRACODE_PUBLIC_URL;
  beforeEach(() => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
  });
  afterEach(() => {
    if (originalPublicUrl === undefined) delete process.env.MASTRACODE_PUBLIC_URL;
    else process.env.MASTRACODE_PUBLIC_URL = originalPublicUrl;
  });

  it('folds a bare ↗ link into the first text of a new session, and only the first', async () => {
    const out = await render(newSessionContext(), [textDelta('Yep, '), textDelta("I'm here.")]);
    expect(out.map(c => (c as any).payload.text)).toEqual([`[↗](${LINK}) Yep, `, "I'm here."]);
  });

  it('is marked by the channel handler under a stable key', () => {
    const requestContext = new RequestContext();
    markNewChannelSession(requestContext);
    expect(requestContext.get(NEW_CHANNEL_SESSION_KEY)).toBe(true);
  });

  it('a chat-only thread links with its resource in the query', async () => {
    const out = await render(newSessionContext({ resourceId: 'channel:slack:C-1:1700.42' }), [textDelta('Hi')]);
    expect((out[0] as any).payload.text).toBe(
      `[↗](https://mc.example.com/factories/fp-1/workspaces/channel/threads/uuid-thread-1?resourceId=${encodeURIComponent('channel:slack:C-1:1700.42')}) Hi`,
    );
  });

  it('a session with no factory links to the factory-agnostic redirect', async () => {
    const out = await render(newSessionContext({ factoryProjectId: null }), [textDelta('Hi')]);
    expect((out[0] as any).payload.text).toBe('[↗](https://mc.example.com/threads/uuid-thread-1?resourceId=us-42) Hi');
  });

  it('leaves follow-up runs and non-channel runs alone', async () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'uuid-thread-1', resourceId: 'us-42', getState: () => ({}) });
    const out = await render(requestContext, [textDelta('Hi')]);
    expect((out[0] as any).payload.text).toBe('Hi');
  });

  it('passes text through untouched without a public origin', async () => {
    delete process.env.MASTRACODE_PUBLIC_URL;
    const out = await render(newSessionContext(), [textDelta('Hi'), textDelta(' there')]);
    expect(out.map(c => (c as any).payload.text)).toEqual(['Hi', ' there']);
  });

  it('does not touch non-text chunks', async () => {
    const toolCall = {
      type: 'tool-call',
      runId: 'r',
      from: 'AGENT',
      payload: { toolCallId: 'c1', toolName: 'x', args: {} },
    } as ChunkType;
    const out = await render(newSessionContext(), [toolCall, textDelta('Done')]);
    expect(out[0]).toBe(toolCall);
    expect((out[1] as any).payload.text).toBe(`[↗](${LINK}) Done`);
  });
});
