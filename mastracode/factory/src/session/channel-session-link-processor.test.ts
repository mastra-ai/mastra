import { REPROCESS_PART_KEY } from '@mastra/core/processors';
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
const textEnd = (id = 't1'): ChunkType =>
  ({ type: 'text-end', runId: 'r', from: 'AGENT', payload: { id } }) as ChunkType;
const textBlock = (...texts: string[]): ChunkType[] => [...texts.map(t => textDelta(t)), textEnd()];

/**
 * Drives the chunks through one processor instance with shared per-run
 * state, re-driving anything stashed under REPROCESS_PART_KEY the way the
 * ProcessorRunner does after each emitted part.
 */
async function render(requestContext: RequestContext, chunks: ChunkType[]) {
  const processor = new FactoryChannelSessionLinkProcessor();
  const state: Record<string, unknown> = {};
  const out: ChunkType[] = [];
  const drive = async (part: ChunkType) => {
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
    const stashed = state[REPROCESS_PART_KEY] as ChunkType | undefined;
    if (stashed) {
      delete state[REPROCESS_PART_KEY];
      await drive(stashed);
    }
  };
  for (const part of chunks) await drive(part);
  return out;
}

/** Collapses the rendered stream to the text of each block, in order. */
function texts(out: ChunkType[]): string[] {
  const blocks: string[] = [];
  let current: string | undefined;
  for (const c of out) {
    if (c.type === 'text-delta') current = (current ?? '') + c.payload.text;
    if (c.type === 'text-end') {
      blocks.push(current ?? '');
      current = undefined;
    }
  }
  return blocks;
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

  it('ends the first text block of a new session with a bare ↗ link, and only the first', async () => {
    const out = await render(newSessionContext(), [...textBlock('On it — ', 'checking.'), ...textBlock('Done.')]);
    expect(texts(out)).toEqual([`On it — checking. [↗](${LINK})`, 'Done.']);
  });

  it('emits the link as a delta ahead of the text-end so the block closes after it', async () => {
    const out = await render(newSessionContext(), textBlock('Hi'));
    expect(out.map(c => c.type)).toEqual(['text-delta', 'text-delta', 'text-end']);
    expect((out[1] as any).payload).toEqual({ id: 't1', text: ` [↗](${LINK})` });
  });

  it('is marked by the channel handler under a stable key', () => {
    const requestContext = new RequestContext();
    markNewChannelSession(requestContext);
    expect(requestContext.get(NEW_CHANNEL_SESSION_KEY)).toBe(true);
  });

  it('a chat-only thread links with its resource in the query', async () => {
    const out = await render(newSessionContext({ resourceId: 'channel:slack:C-1:1700.42' }), textBlock('Hi'));
    expect(texts(out)).toEqual([
      `Hi [↗](https://mc.example.com/factories/fp-1/workspaces/channel/threads/uuid-thread-1?resourceId=${encodeURIComponent('channel:slack:C-1:1700.42')})`,
    ]);
  });

  it('a session with no factory links to the factory-agnostic redirect', async () => {
    const out = await render(newSessionContext({ factoryProjectId: null }), textBlock('Hi'));
    expect(texts(out)).toEqual(['Hi [↗](https://mc.example.com/threads/uuid-thread-1?resourceId=us-42)']);
  });

  it('leaves follow-up runs and non-channel runs alone', async () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'uuid-thread-1', resourceId: 'us-42', getState: () => ({}) });
    const out = await render(requestContext, textBlock('Hi'));
    expect(texts(out)).toEqual(['Hi']);
    expect(out).toHaveLength(2);
  });

  it('passes text through untouched without a public origin', async () => {
    delete process.env.MASTRACODE_PUBLIC_URL;
    const out = await render(newSessionContext(), textBlock('Hi', ' there'));
    expect(texts(out)).toEqual(['Hi there']);
    expect(out).toHaveLength(3);
  });

  it('ignores a text-end with no text before it and waits for the first real block', async () => {
    const out = await render(newSessionContext(), [textEnd('t0'), ...textBlock('Done')]);
    expect(out[0]).toMatchObject({ type: 'text-end', payload: { id: 't0' } });
    expect(texts(out)).toEqual(['', `Done [↗](${LINK})`]);
  });

  it('does not touch non-text chunks', async () => {
    const toolCall = {
      type: 'tool-call',
      runId: 'r',
      from: 'AGENT',
      payload: { toolCallId: 'c1', toolName: 'x', args: {} },
    } as ChunkType;
    const out = await render(newSessionContext(), [toolCall, ...textBlock('Done')]);
    expect(out[0]).toBe(toolCall);
    expect(texts(out)).toEqual([`Done [↗](${LINK})`]);
  });
});
