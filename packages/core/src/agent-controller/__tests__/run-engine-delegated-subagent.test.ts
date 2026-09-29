import { describe, expect, it, vi } from 'vitest';

import { RequestContext } from '../../request-context';
import { Workspace } from '../../workspace';
import { LocalFilesystem } from '../../workspace/filesystem/local-filesystem';
import type { SessionMachinery } from '../session';
import { Session } from '../session';
import { SessionRunEngine } from '../session-run-engine';
import type { AgentControllerEvent } from '../types';

type StreamChunk = Parameters<SessionRunEngine['processStreamChunk']>[1];

function createHarness() {
  const events: AgentControllerEvent[] = [];
  let idCounter = 0;
  const session = new Session({
    resourceId: 'resource-1',
    id: 'session-1',
    ownerId: 'owner-1',
    workspace: new Workspace({
      id: 'workspace-1',
      filesystem: new LocalFilesystem({ basePath: '/tmp' }),
    }),
  });
  session.thread.set({ threadId: 'thread-1' });
  session.subscribe(event => {
    events.push(event);
  });

  const machinery: SessionMachinery = {
    getAgent: () => ({ id: 'agent-stub' }) as unknown as ReturnType<SessionMachinery['getAgent']>,
    getRunScope: () => undefined,
    subscribeToThread: async () => {
      throw new Error('subscribeToThread is not used by these stream-folding tests');
    },
    buildStreamOptions: async () => ({}),
    buildSharedRunOptions: () => ({}),
    buildToolsets: async () => ({}),
    buildRequestContext: async requestContext => requestContext ?? new RequestContext(),
    persistTokenUsage: vi.fn(async () => {}),
    generateId: () => `msg-${++idCounter}`,
    resolveTransitionModeId: () => undefined,
    saveSystemReminder: vi.fn(async () => null),
  };

  return { engine: new SessionRunEngine(session, machinery), events, session };
}

/** A chunk streamed by a delegated subagent, as it reaches the parent stream. */
function agentOutput(
  toolCallId: string,
  type: string,
  payload: Record<string, unknown> = {},
  toolName = 'agent-helper',
): StreamChunk {
  return {
    type: 'tool-output',
    payload: { toolCallId, toolName, output: { type, payload, from: 'AGENT', runId: 'helper-run' } },
  } as StreamChunk;
}

function subagentEvents(events: AgentControllerEvent[]) {
  return events.filter(event => event.type.startsWith('subagent_'));
}

describe('SessionRunEngine — subagents delegated through Agent.agents', () => {
  it('emits subagent events for an agent-<key> delegation and tracks it in activeSubagents', async () => {
    const { engine, events, session } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    const toolCallId = 'delegate-1';
    const chunks: StreamChunk[] = [
      { type: 'tool-call', payload: { toolCallId, toolName: 'agent-helper', args: { prompt: 'Research streams' } } },
      agentOutput(toolCallId, 'start'),
      agentOutput(toolCallId, 'tool-call', { toolCallId: 'h-1', toolName: 'searchDocs', args: { query: 'streams' } }),
      agentOutput(toolCallId, 'tool-result', { toolCallId: 'h-1', toolName: 'searchDocs', result: { hits: 3 } }),
      agentOutput(toolCallId, 'text-delta', { id: 't', text: 'Found ' }),
      agentOutput(toolCallId, 'text-delta', { id: 't', text: '3 results.' }),
      agentOutput(toolCallId, 'finish'),
      {
        type: 'tool-result',
        payload: { toolCallId, toolName: 'agent-helper', result: { text: 'Found 3 results.' } },
      },
    ];
    for (const item of chunks) await engine.processStreamChunk(state, item, context);

    expect(subagentEvents(events)).toMatchObject([
      { type: 'subagent_start', toolCallId, agentType: 'helper', task: 'Research streams' },
      { type: 'subagent_tool_start', toolCallId, subToolName: 'searchDocs', subToolArgs: { query: 'streams' } },
      { type: 'subagent_tool_end', toolCallId, subToolName: 'searchDocs', subToolResult: { hits: 3 }, isError: false },
      { type: 'subagent_text_delta', toolCallId, textDelta: 'Found ' },
      { type: 'subagent_text_delta', toolCallId, textDelta: '3 results.' },
      { type: 'subagent_end', toolCallId, agentType: 'helper', result: 'Found 3 results.', isError: false },
    ]);

    // subagent_end is emitted before the parent's tool_end, matching the built-in subagent tool.
    const order = events.map(event => event.type);
    expect(order.indexOf('subagent_end')).toBeLessThan(order.indexOf('tool_end'));

    expect(session.displayState.get().activeSubagents.get(toolCallId)).toMatchObject({
      agentType: 'helper',
      task: 'Research streams',
      toolCalls: [{ name: 'searchDocs', isError: false }],
      textDelta: 'Found 3 results.',
      status: 'completed',
      result: 'Found 3 results.',
    });
  });

  it('opens the subagent on the first chunk even when the helper never sends a start chunk', async () => {
    const { engine, events, session } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    // A delegation rejected by onDelegationStart only forwards a single text-delta.
    const toolCallId = 'delegate-rejected';
    const chunks: StreamChunk[] = [
      { type: 'tool-call', payload: { toolCallId, toolName: 'agent-helper', args: { prompt: 'Research streams' } } },
      agentOutput(toolCallId, 'text-delta', { id: 'r', text: '[Delegation Rejected] Helper is offline' }),
      {
        type: 'tool-result',
        payload: { toolCallId, toolName: 'agent-helper', result: { text: 'Delegation rejected' } },
      },
    ];
    for (const item of chunks) await engine.processStreamChunk(state, item, context);

    expect(subagentEvents(events).map(event => event.type)).toEqual([
      'subagent_start',
      'subagent_text_delta',
      'subagent_end',
    ]);
    expect(session.displayState.get().activeSubagents.get(toolCallId)).toMatchObject({
      textDelta: '[Delegation Rejected] Helper is offline',
      status: 'completed',
    });
  });

  it('marks the subagent as errored when the delegation tool call fails', async () => {
    const { engine, events, session } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    const toolCallId = 'delegate-failed';
    const chunks: StreamChunk[] = [
      { type: 'tool-call', payload: { toolCallId, toolName: 'agent-helper', args: { prompt: 'Research streams' } } },
      agentOutput(toolCallId, 'tool-call', { toolCallId: 'h-1', toolName: 'searchDocs', args: {} }),
      agentOutput(toolCallId, 'tool-error', { toolCallId: 'h-1', toolName: 'searchDocs', error: 'index offline' }),
      {
        type: 'tool-error',
        payload: { toolCallId, toolName: 'agent-helper', error: new Error('helper crashed') },
      },
    ];
    for (const item of chunks) await engine.processStreamChunk(state, item, context);

    expect(subagentEvents(events)).toMatchObject([
      { type: 'subagent_start' },
      { type: 'subagent_tool_start', subToolName: 'searchDocs' },
      { type: 'subagent_tool_end', subToolName: 'searchDocs', subToolResult: 'index offline', isError: true },
      { type: 'subagent_end', isError: true },
    ]);
    expect(session.displayState.get().activeSubagents.get(toolCallId)).toMatchObject({
      toolCalls: [{ name: 'searchDocs', isError: true }],
      status: 'error',
    });
  });

  it('picks the subagent back up after the run pauses for approval and resumes', async () => {
    const { engine, events, session } = createHarness();
    const context = new RequestContext();
    const toolCallId = 'delegate-approval';

    // First run: the helper starts, then asks for approval, which pauses the parent run.
    const firstRun = engine.createStreamState();
    const beforePause: StreamChunk[] = [
      { type: 'tool-call', payload: { toolCallId, toolName: 'agent-helper', args: { prompt: 'Research streams' } } },
      agentOutput(toolCallId, 'tool-call', { toolCallId: 'h-1', toolName: 'searchDocs', args: {} }),
      agentOutput(toolCallId, 'tool-result', { toolCallId: 'h-1', toolName: 'searchDocs', result: 'ok' }),
    ];
    for (const item of beforePause) await engine.processStreamChunk(firstRun, item, context);
    session.emit({ type: 'agent_end', reason: 'suspended' });

    // Resumed run: a fresh stream state, and the parent's tool-call is not replayed.
    const resumedRun = engine.createStreamState();
    const afterResume: StreamChunk[] = [
      agentOutput(toolCallId, 'tool-call', { toolCallId: 'h-2', toolName: 'deleteDocs', args: {} }),
      agentOutput(toolCallId, 'tool-result', { toolCallId: 'h-2', toolName: 'deleteDocs', result: 'ok' }),
      agentOutput(toolCallId, 'text-delta', { id: 't', text: 'Done.' }),
      { type: 'tool-result', payload: { toolCallId, toolName: 'agent-helper', result: { text: 'Done.' } } },
    ];
    for (const item of afterResume) await engine.processStreamChunk(resumedRun, item, context);

    // agent_end clears activeSubagents, so the resumed run opens a fresh entry for the same call.
    expect(subagentEvents(events).map(event => event.type)).toEqual([
      'subagent_start',
      'subagent_tool_start',
      'subagent_tool_end',
      'subagent_start',
      'subagent_tool_start',
      'subagent_tool_end',
      'subagent_text_delta',
      'subagent_end',
    ]);
    expect(session.displayState.get().activeSubagents.get(toolCallId)).toMatchObject({
      agentType: 'helper',
      toolCalls: [{ name: 'deleteDocs', isError: false }],
      textDelta: 'Done.',
      status: 'completed',
      result: 'Done.',
    });
  });

  it('reports an empty result when the delegation returns nothing', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    const toolCallId = 'delegate-empty';
    const chunks: StreamChunk[] = [
      { type: 'tool-call', payload: { toolCallId, toolName: 'agent-helper', args: { prompt: 'Research streams' } } },
      agentOutput(toolCallId, 'start'),
      { type: 'tool-result', payload: { toolCallId, toolName: 'agent-helper', result: undefined } },
    ];
    for (const item of chunks) await engine.processStreamChunk(state, item, context);

    expect(subagentEvents(events).find(event => event.type === 'subagent_end')).toMatchObject({ result: '' });
  });

  it('ignores tool-output that is not from an agent-<key> delegation', async () => {
    const { engine, events, session } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    const toolCallId = 'plain-tool';
    const chunks: StreamChunk[] = [
      { type: 'tool-call', payload: { toolCallId, toolName: 'searchDocs', args: {} } },
      agentOutput(toolCallId, 'text-delta', { id: 't', text: 'not a subagent' }, 'searchDocs'),
      { type: 'tool-result', payload: { toolCallId, toolName: 'searchDocs', result: 'done' } },
    ];
    for (const item of chunks) await engine.processStreamChunk(state, item, context);

    expect(subagentEvents(events)).toEqual([]);
    expect(session.displayState.get().activeSubagents.size).toBe(0);
  });

  it('does not emit a second subagent_end for the built-in subagent tool', async () => {
    const { engine, events, session } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    // The built-in tool emits its own subagent events directly on the session.
    const toolCallId = 'builtin-1';
    await engine.processStreamChunk(
      state,
      { type: 'tool-call', payload: { toolCallId, toolName: 'subagent', args: { agentType: 'explore', task: 't' } } },
      context,
    );
    session.emit({ type: 'subagent_start', toolCallId, agentType: 'explore', task: 't', modelId: 'm' });
    session.emit({
      type: 'subagent_end',
      toolCallId,
      agentType: 'explore',
      result: 'r',
      isError: false,
      durationMs: 1,
    });
    await engine.processStreamChunk(
      state,
      { type: 'tool-result', payload: { toolCallId, toolName: 'subagent', result: { content: 'r', isError: false } } },
      context,
    );

    expect(subagentEvents(events).filter(event => event.type === 'subagent_end')).toHaveLength(1);
  });
});
