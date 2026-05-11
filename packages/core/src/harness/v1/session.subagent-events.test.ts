/**
 * Harness v1 — subagent event surface (§10.2 / §10.6).
 *
 * The five `subagent_*` event shapes (start / text_delta / tool_start /
 * tool_end / end) get published on the *parent* session's subscriber when
 * a child subagent session makes progress. This file pins the event shape
 * and the `_emitSubagentEvent` stamping behavior (parentId, queuedItemId
 * correlation) before the spawn-subagent tool slice that produces them
 * end-to-end.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';

import type { HarnessEvent } from './events';
import { Harness } from './harness';

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };

  constructor(name: string) {
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  async stream(_messages: any, _options?: any): Promise<any> {
    const chunks = this.chunks;
    const fullOutput = this.fullOutput;
    const fullStream = (async function* () {
      for (const chunk of chunks) yield chunk;
    })();
    return {
      getFullOutput: async () => fullOutput,
      fullStream,
      text: Promise.resolve(fullOutput.text),
      finishReason: Promise.resolve(fullOutput.finishReason),
      usage: Promise.resolve(fullOutput.usage),
      runId: fullOutput.runId,
    } as unknown as MastraModelOutput;
  }

  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }

  async resumeStream(_resumeData: any, _opts?: any): Promise<any> {
    return this.stream(undefined);
  }
}

function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent, storage };
}

describe('Session._emitSubagentEvent', () => {
  it('emits subagent_start with parentId stamped to the parent session id', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    session._emitSubagentEvent({
      type: 'subagent_start',
      toolCallId: 'tool-call-1',
      subagentSessionId: 'child-1',
      agentType: 'explore',
      task: 'find usages of X',
      modelId: 'openai/gpt-4o',
      depth: 1,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'subagent_start',
      toolCallId: 'tool-call-1',
      subagentSessionId: 'child-1',
      agentType: 'explore',
      task: 'find usages of X',
      modelId: 'openai/gpt-4o',
      depth: 1,
      parentId: session.id,
      sessionId: session.id,
    });
    expect(typeof events[0]!.id).toBe('string');
    expect(typeof events[0]!.timestamp).toBe('number');
  });

  it('emits subagent_text_delta with parentId + depth', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    session._emitSubagentEvent({
      type: 'subagent_text_delta',
      toolCallId: 'tool-call-1',
      subagentSessionId: 'child-1',
      agentType: 'explore',
      delta: 'hello',
      depth: 1,
    });

    expect(events[0]).toMatchObject({
      type: 'subagent_text_delta',
      delta: 'hello',
      depth: 1,
      parentId: session.id,
    });
  });

  it('emits subagent_tool_start with innerToolCallId + toolName', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    session._emitSubagentEvent({
      type: 'subagent_tool_start',
      toolCallId: 'tool-call-1',
      subagentSessionId: 'child-1',
      agentType: 'explore',
      innerToolCallId: 'inner-tc-1',
      toolName: 'searchContent',
      depth: 1,
    });

    expect(events[0]).toMatchObject({
      type: 'subagent_tool_start',
      innerToolCallId: 'inner-tc-1',
      toolName: 'searchContent',
      parentId: session.id,
    });
  });

  it('emits subagent_tool_end with output + isError', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    session._emitSubagentEvent({
      type: 'subagent_tool_end',
      toolCallId: 'tool-call-1',
      subagentSessionId: 'child-1',
      agentType: 'explore',
      innerToolCallId: 'inner-tc-1',
      toolName: 'searchContent',
      output: { matches: 3 },
      isError: false,
      depth: 1,
    });

    expect(events[0]).toMatchObject({
      type: 'subagent_tool_end',
      innerToolCallId: 'inner-tc-1',
      toolName: 'searchContent',
      output: { matches: 3 },
      isError: false,
      parentId: session.id,
    });
  });

  it('emits subagent_end with output + isError + durationMs', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    session._emitSubagentEvent({
      type: 'subagent_end',
      toolCallId: 'tool-call-1',
      subagentSessionId: 'child-1',
      agentType: 'explore',
      output: { summary: 'done' },
      isError: false,
      durationMs: 1234,
      depth: 1,
    });

    expect(events[0]).toMatchObject({
      type: 'subagent_end',
      output: { summary: 'done' },
      isError: false,
      durationMs: 1234,
      parentId: session.id,
    });
  });

  it('stamps queuedItemId when emitted during a queued turn', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    // Drive a turn that, while running, emits a subagent event. Use a fake
    // chunk that triggers the drain loop; we synchronously emit a subagent
    // event from a subscriber that sees `agent_start`, so it lands inside
    // the turn's `_currentQueuedItemId` window.
    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      if (e.type === 'agent_start') {
        session._emitSubagentEvent({
          type: 'subagent_start',
          toolCallId: 'tool-call-1',
          subagentSessionId: 'child-1',
          agentType: 'explore',
          task: 't',
          modelId: 'm',
          depth: 1,
        });
      }
      events.push(e);
    });

    agent.chunks = [];
    await session.queue({ content: 'hi' });
    // Drain the queue by awaiting the side-effect-free promise resolves.
    await new Promise<void>(resolve => {
      setTimeout(resolve, 10);
    });

    const sub = events.find(e => e.type === 'subagent_start');
    expect(sub).toBeDefined();
    // Queued turns auto-stamp queuedItemId on every event emitted during
    // their window, including subagent events.
    expect((sub as any).queuedItemId).toBeTypeOf('string');
  });
});
