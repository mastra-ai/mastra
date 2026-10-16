import { Agent } from '@mastra/core/agent';
import { MockMemory } from '@mastra/core/memory';
import { ProcessorRunner } from '@mastra/core/processors';
import type { Processor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import type { ChunkType } from '@mastra/core/stream';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FactoryChannelSessionLinkProcessor,
  markNewChannelSession,
  NEW_CHANNEL_SESSION_KEY,
} from './channel-session-link-processor.js';

const LINK = 'https://mc.example.com/factories/fp-1/workspaces/us-42/threads/uuid-thread-1';
// Own paragraph, so it closes the message rather than tailing the last sentence.
const LINK_SUFFIX = `\n\n[Open session ↗](${LINK})`;

function newSessionContext({ factoryProjectId = 'fp-1' as string | null, sessionId = 'us-42', resourceId = 'fp-1' } = {}) {
  const requestContext = new RequestContext();
  requestContext.set('controller', {
    threadId: 'uuid-thread-1',
    sessionId,
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
const stepFinish = (): ChunkType => ({ type: 'step-finish', runId: 'r', from: 'AGENT', payload: {} }) as ChunkType;
const toolCall = (): ChunkType =>
  ({
    type: 'tool-call',
    runId: 'r',
    from: 'AGENT',
    payload: { toolCallId: 'c1', toolName: 'x', args: {} },
  }) as ChunkType;
const source = (): ChunkType =>
  ({
    type: 'source',
    runId: 'r',
    from: 'AGENT',
    payload: { id: 's1', sourceType: 'url', url: 'https://w.example' },
  }) as ChunkType;

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

/**
 * Drives the chunks through core's real ProcessorRunner, so the re-drive of
 * the stashed boundary chunk is the runner's own and not a re-implementation.
 * `downstream` receives whatever the link processor emits, in order.
 */
async function render(requestContext: RequestContext, chunks: ChunkType[], downstream: Processor[] = []) {
  const runner = new ProcessorRunner({
    inputProcessors: [],
    outputProcessors: [new FactoryChannelSessionLinkProcessor(), ...downstream],
    logger: silentLogger,
    agentName: 'factory',
  });
  const states = new Map();
  const out: ChunkType[] = [];
  for (const part of chunks) {
    const primary = await runner.processPart(part, states, undefined, requestContext);
    if (primary.part) out.push(primary.part);
    for (const r of await runner.drainReprocessParts(states, undefined, requestContext)) {
      if (r.part) out.push(r.part);
    }
  }
  return out;
}

/**
 * Collapses the rendered stream to the text of each post, in order — a post
 * ends where the channel drivers end it (tool-call / step-finish), not at
 * `text-end`, which only separates the text blocks of one reply.
 */
function texts(out: ChunkType[]): string[] {
  const posts: string[] = [];
  let current: string | undefined;
  for (const c of out) {
    if (c.type === 'text-delta') current = (current ?? '') + c.payload.text;
    if (c.type === 'tool-call' || c.type === 'step-finish') {
      if (current !== undefined) posts.push(current);
      current = undefined;
    }
  }
  if (current !== undefined) posts.push(current);
  return posts;
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

  it('ends the opener of a new session with an Open session ↗ link before the first tool runs, and only once', async () => {
    const out = await render(newSessionContext(), [
      ...textBlock('On it — ', 'checking.'),
      toolCall(),
      ...textBlock('Done.'),
      stepFinish(),
    ]);
    expect(texts(out)).toEqual([`On it — checking.${LINK_SUFFIX}`, 'Done.']);
  });

  it('ends a reply with no tools with the link at step-finish', async () => {
    const out = await render(newSessionContext(), [...textBlock('All good.'), stepFinish()]);
    expect(texts(out)).toEqual([`All good.${LINK_SUFFIX}`]);
  });

  it('keeps a cited reply (text → source → text) as one post with the link at its end', async () => {
    // Each citation boundary is its own text block with its own text-end;
    // the link must trail the whole reply, not the first fragment.
    const out = await render(newSessionContext(), [
      ...textBlock('Expect '),
      source(),
      ...textBlock('low clouds'),
      ...textBlock(', then sun.'),
      stepFinish(),
    ]);
    expect(texts(out)).toEqual([`Expect low clouds, then sun.${LINK_SUFFIX}`]);
  });

  it('emits the link as its own text part ahead of the boundary, and downstream processors see both in order', async () => {
    const seen: string[] = [];
    const spy: Processor = {
      id: 'spy',
      async processOutputStream({ part }) {
        seen.push(part.type);
        return part;
      },
    };
    const out = await render(newSessionContext(), [...textBlock('Hi'), stepFinish()], [spy]);
    expect(out.map(c => c.type)).toEqual(['text-delta', 'text-end', 'text-delta', 'step-finish']);
    // Its own part id, so the saved message carries the link as a separate
    // text part that processOutputStep can drop whole.
    expect((out[2] as any).payload).toEqual({ id: 'factory-session-link', text: LINK_SUFFIX });
    // The stashed boundary is re-driven through the whole chain, not just
    // emitted — guards the mirrored REPROCESS_PART_KEY against a core rename.
    expect(seen).toEqual(['text-delta', 'text-end', 'text-delta', 'step-finish']);
  });

  it('is marked by the channel handler under a stable key', () => {
    const requestContext = new RequestContext();
    markNewChannelSession(requestContext);
    expect(requestContext.get(NEW_CHANNEL_SESSION_KEY)).toBe(true);
  });

  it('a chat-only thread links with its resource in the query', async () => {
    const out = await render(newSessionContext({ sessionId: 'channel:slack:C-1:1700.42', resourceId: 'channel:slack:C-1:1700.42' }), [
      ...textBlock('Hi'),
      stepFinish(),
    ]);
    expect(texts(out)).toEqual([
      `Hi\n\n[Open session ↗](https://mc.example.com/factories/fp-1/workspaces/channel/threads/uuid-thread-1?resourceId=${encodeURIComponent('channel:slack:C-1:1700.42')})`,
    ]);
  });

  it('a session with no factory links to the factory-agnostic redirect', async () => {
    const out = await render(newSessionContext({ factoryProjectId: null }), [...textBlock('Hi'), stepFinish()]);
    expect(texts(out)).toEqual([
      'Hi\n\n[Open session ↗](https://mc.example.com/threads/uuid-thread-1?resourceId=us-42)',
    ]);
  });

  it('leaves follow-up runs and non-channel runs alone', async () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'uuid-thread-1', resourceId: 'us-42', getState: () => ({}) });
    const out = await render(requestContext, [...textBlock('Hi'), stepFinish()]);
    expect(texts(out)).toEqual(['Hi']);
    expect(out).toHaveLength(3);
  });

  it('passes text through untouched without a public origin', async () => {
    delete process.env.MASTRACODE_PUBLIC_URL;
    const out = await render(newSessionContext(), [...textBlock('Hi', ' there'), stepFinish()]);
    expect(texts(out)).toEqual(['Hi there']);
    expect(out).toHaveLength(4);
  });

  it('a tool-only step with no text before it is left alone; the link waits for the first reply', async () => {
    const first = toolCall();
    const out = await render(newSessionContext(), [first, stepFinish(), ...textBlock('Done'), stepFinish()]);
    expect(out[0]).toBe(first);
    expect(texts(out)).toEqual([`Done${LINK_SUFFIX}`]);
  });

  describe('through a real agent run', () => {
    async function runNewSession(requestContext: RequestContext) {
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'factory',
        name: 'factory',
        instructions: 'reply',
        model: createMockModel({ mockText: 'On it.' }),
        memory,
        outputProcessors: [new FactoryChannelSessionLinkProcessor()],
      });
      const stream = await agent.stream('go', {
        memory: { thread: 'uuid-thread-1', resource: 'us-42' },
        requestContext,
      });
      // What a channel renders: the text-delta chunks, in order.
      let streamed = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'text-delta') streamed += chunk.payload.text;
      }
      const { messages } = await memory.recall({ threadId: 'uuid-thread-1', resourceId: 'us-42' });
      const saved = messages.filter(m => m.role === 'assistant');
      return { streamed, saved };
    }

    it('streams the link to the channel but keeps it out of the saved message', async () => {
      const { streamed, saved } = await runNewSession(newSessionContext());
      expect(streamed).toBe(`On it.${LINK_SUFFIX}`);
      // The link is a Slack display detail. Persisted, the model would see
      // its own `[↗](…)` on every later turn and the web transcript would
      // show a self-link — so it must be gone before memory saves the reply.
      expect(saved).toHaveLength(1);
      // The link rode in as its own text part; the whole part is gone.
      const text = saved[0]!.content.parts.filter(p => p.type === 'text').map(p => p.text);
      expect(text).toEqual(['On it.']);
      expect(JSON.stringify(saved[0])).not.toContain('↗');
    });

    it('saves the reply untouched when no link was added', async () => {
      delete process.env.MASTRACODE_PUBLIC_URL;
      const { streamed, saved } = await runNewSession(newSessionContext());
      expect(streamed).toBe('On it.');
      expect(saved[0]!.content.parts.filter(p => p.type === 'text').map(p => p.text)).toEqual(['On it.']);
    });
  });
});
