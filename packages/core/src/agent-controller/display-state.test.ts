import { describe, it, expect, beforeEach } from 'vitest';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { ChunkFrom } from '../stream/types';
import type { Session } from './session';
import { createTestSession } from './test-utils';
import type { AgentControllerEvent, AgentControllerSubagent, AgentControllerSubagentHistoryEntry } from './types';
import { createEmptyTokenUsage, defaultDisplayState } from './types';

function createSession(storage?: InMemoryStore, opts?: { subagents?: AgentControllerSubagent[] }) {
  return createTestSession({ storage: storage ?? new InMemoryStore(), subagents: opts?.subagents });
}

// Helper to emit an event on a session bus.
function emit(session: Session, event: AgentControllerEvent) {
  session.emit(event);
}

describe('defaultDisplayState', () => {
  it('returns a fresh display state with correct defaults', () => {
    const ds = defaultDisplayState();
    expect(ds.isRunning).toBe(false);
    expect(ds.currentMessage).toBeNull();
    expect(ds.queuedFollowUps).toBe(0);
    expect(ds.tokenUsage).toEqual(createEmptyTokenUsage());
    expect(ds.activeTools).toBeInstanceOf(Map);
    expect(ds.activeTools.size).toBe(0);
    expect(ds.toolInputBuffers).toBeInstanceOf(Map);
    expect(ds.toolInputBuffers.size).toBe(0);
    expect(ds.pendingApproval).toBeNull();
    expect(ds.activeSubagents).toBeInstanceOf(Map);
    expect(ds.activeSubagents.size).toBe(0);
    expect(ds.omProgress.status).toBe('idle');
    expect(ds.omProgress.pendingTokens).toBe(0);
    expect(ds.omProgress.threshold).toBe(30000);
    expect(ds.modifiedFiles).toBeInstanceOf(Map);
    expect(ds.modifiedFiles.size).toBe(0);
    expect(ds.tasks).toEqual([]);
    expect(ds.previousTasks).toEqual([]);
    expect(ds.bufferingMessages).toBe(false);
    expect(ds.bufferingObservations).toBe(false);
  });

  it('returns independent instances', () => {
    const ds1 = defaultDisplayState();
    const ds2 = defaultDisplayState();
    ds1.tasks.push({ id: 'test', content: 'test', status: 'pending', activeForm: 'Testing' });
    expect(ds2.tasks).toEqual([]);
  });
});

describe('session.displayState.get()', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('returns display state with correct initial values', () => {
    const ds = session.displayState.get();
    expect(ds.isRunning).toBe(false);
    expect(ds.currentMessage).toBeNull();
    expect(ds.tokenUsage).toEqual(createEmptyTokenUsage());
    expect(ds.activeTools.size).toBe(0);
    expect(ds.pendingApproval).toBeNull();
    expect(ds.activeSubagents.size).toBe(0);
    expect(ds.modifiedFiles.size).toBe(0);
    expect(ds.tasks).toEqual([]);
    expect(ds.previousTasks).toEqual([]);
  });

  it('returns the same reference (not a copy)', () => {
    const ds1 = session.displayState.get();
    const ds2 = session.displayState.get();
    expect(ds1).toBe(ds2);
  });
});

// ===========================================================================
// Agent lifecycle
// ===========================================================================

describe('agent lifecycle', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('sets isRunning to true on agent_start', () => {
    emit(session, { type: 'agent_start' });
    expect(session.displayState.get().isRunning).toBe(true);
  });

  it('clears activeTools on agent_start', () => {
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: {} });
    expect(session.displayState.get().activeTools.size).toBe(1);

    emit(session, { type: 'agent_start' });
    expect(session.displayState.get().activeTools.size).toBe(0);
  });

  it('clears toolInputBuffers on agent_start', () => {
    emit(session, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
    expect(session.displayState.get().toolInputBuffers.size).toBe(1);

    emit(session, { type: 'agent_start' });
    expect(session.displayState.get().toolInputBuffers.size).toBe(0);
  });

  it('clears pendingApproval on agent_start', () => {
    emit(session, { type: 'tool_approval_required', toolCallId: 't1', toolName: 'write_file', args: {} });
    expect(session.displayState.get().pendingApproval).not.toBeNull();

    emit(session, { type: 'agent_start' });
    expect(session.displayState.get().pendingApproval).toBeNull();
  });

  it('sets isRunning to false on agent_end', () => {
    emit(session, { type: 'agent_start' });
    expect(session.displayState.get().isRunning).toBe(true);

    emit(session, { type: 'agent_end', reason: 'complete' });
    expect(session.displayState.get().isRunning).toBe(false);
  });

  it('marks running tools as error on agent_end', () => {
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'test.ts' } });
    expect(session.displayState.get().activeTools.get('t1')?.status).toBe('running');

    emit(session, { type: 'agent_end', reason: 'aborted' });
    expect(session.displayState.get().activeTools.get('t1')?.status).toBe('error');
  });

  it('marks streaming_input tools as error on agent_end', () => {
    emit(session, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
    expect(session.displayState.get().activeTools.get('t1')?.status).toBe('streaming_input');

    emit(session, { type: 'agent_end', reason: 'aborted' });
    expect(session.displayState.get().activeTools.get('t1')?.status).toBe('error');
  });

  it('does not change completed tools on agent_end', () => {
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'test.ts' } });
    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });
    expect(session.displayState.get().activeTools.get('t1')?.status).toBe('completed');

    emit(session, { type: 'agent_end', reason: 'complete' });
    expect(session.displayState.get().activeTools.get('t1')?.status).toBe('completed');
  });

  it('clears activeSubagents on agent_end', () => {
    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 'find', modelId: 'gpt-4o' });
    expect(session.displayState.get().activeSubagents.size).toBe(1);

    emit(session, { type: 'agent_end', reason: 'complete' });
    expect(session.displayState.get().activeSubagents.size).toBe(0);
  });
});

// ===========================================================================
// Message streaming
// ===========================================================================

describe('message streaming', () => {
  let session: Session;
  const msg1 = {
    id: 'm1',
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text: 'hello' }],
    createdAt: new Date(),
  };
  const msg2 = {
    id: 'm1',
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text: 'hello world' }],
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('tracks currentMessage on message_start', () => {
    emit(session, { type: 'message_start', message: msg1 as any });
    expect(session.displayState.get().currentMessage).toBe(msg1);
  });

  it('updates currentMessage on message_update', () => {
    emit(session, { type: 'message_start', message: msg1 as any });
    emit(session, { type: 'message_update', message: msg2 as any });
    expect(session.displayState.get().currentMessage).toBe(msg2);
  });

  it('keeps currentMessage reference on message_end', () => {
    emit(session, { type: 'message_start', message: msg1 as any });
    emit(session, { type: 'message_end', message: msg2 as any });
    expect(session.displayState.get().currentMessage).toBe(msg2);
  });
});

// ===========================================================================
// Tool lifecycle
// ===========================================================================

describe('tool lifecycle', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  describe('tool_start / tool_end', () => {
    it('creates tool entry on tool_start', () => {
      emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'foo.ts' } });
      const tool = session.displayState.get().activeTools.get('t1');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('read_file');
      expect(tool!.args).toEqual({ path: 'foo.ts' });
      expect(tool!.status).toBe('running');
    });

    it('updates existing tool entry on tool_start (after tool_input_start)', () => {
      emit(session, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      emit(session, {
        type: 'tool_start',
        toolCallId: 't1',
        toolName: 'write_file',
        args: { path: 'x', content: 'y' },
      });
      const tool = session.displayState.get().activeTools.get('t1');
      expect(tool!.status).toBe('running');
      expect(tool!.args).toEqual({ path: 'x', content: 'y' });
    });

    it('marks tool as completed on successful tool_end', () => {
      emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: {} });
      emit(session, { type: 'tool_end', toolCallId: 't1', result: 'file contents', isError: false });
      const tool = session.displayState.get().activeTools.get('t1');
      expect(tool!.status).toBe('completed');
      expect(tool!.result).toBe('file contents');
      expect(tool!.isError).toBe(false);
    });

    it('marks tool as error on failed tool_end', () => {
      emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: {} });
      emit(session, { type: 'tool_end', toolCallId: 't1', result: 'not found', isError: true });
      const tool = session.displayState.get().activeTools.get('t1');
      expect(tool!.status).toBe('error');
      expect(tool!.isError).toBe(true);
    });
  });

  describe('tool_update', () => {
    it('sets partialResult on existing tool', () => {
      emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: {} });
      emit(session, { type: 'tool_update', toolCallId: 't1', partialResult: 'partial output' });
      expect(session.displayState.get().activeTools.get('t1')!.partialResult).toBe('partial output');
    });

    it('stringifies non-string partialResult', () => {
      emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: {} });
      emit(session, { type: 'tool_update', toolCallId: 't1', partialResult: { key: 'value' } });
      expect(session.displayState.get().activeTools.get('t1')!.partialResult).toBe('{"key":"value"}');
    });

    it('ignores update for unknown toolCallId', () => {
      emit(session, { type: 'tool_update', toolCallId: 'unknown', partialResult: 'x' });
      expect(session.displayState.get().activeTools.has('unknown')).toBe(false);
    });
  });

  describe('shell_output', () => {
    it('appends shell output to tool', () => {
      emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: {} });
      emit(session, { type: 'shell_output', toolCallId: 't1', output: 'line1\n', stream: 'stdout' });
      emit(session, { type: 'shell_output', toolCallId: 't1', output: 'line2\n', stream: 'stderr' });
      expect(session.displayState.get().activeTools.get('t1')!.shellOutput).toBe('line1\nline2\n');
    });
  });

  describe('tool_input_start / tool_input_delta / tool_input_end', () => {
    it('creates buffer on tool_input_start', () => {
      emit(session, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      const buf = session.displayState.get().toolInputBuffers.get('t1');
      expect(buf).toBeDefined();
      expect(buf!.text).toBe('');
      expect(buf!.toolName).toBe('write_file');
    });

    it('creates tool entry with streaming_input status on tool_input_start', () => {
      emit(session, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      const tool = session.displayState.get().activeTools.get('t1');
      expect(tool).toBeDefined();
      expect(tool!.status).toBe('streaming_input');
    });

    it('accumulates text on tool_input_delta', () => {
      emit(session, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      emit(session, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '{"path":' });
      emit(session, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '"test.ts"}' });
      expect(session.displayState.get().toolInputBuffers.get('t1')!.text).toBe('{"path":"test.ts"}');
    });

    it('removes buffer on tool_input_end', () => {
      emit(session, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      emit(session, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '{}' });
      emit(session, { type: 'tool_input_end', toolCallId: 't1' });
      expect(session.displayState.get().toolInputBuffers.has('t1')).toBe(false);
    });

    it('ignores delta for unknown toolCallId', () => {
      emit(session, { type: 'tool_input_delta', toolCallId: 'unknown', argsTextDelta: 'x' });
      expect(session.displayState.get().toolInputBuffers.has('unknown')).toBe(false);
    });
  });

  it('maps Mastra Code tool progress data chunks to tool updates', async () => {
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await (session as any).processStream(
      {
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'plugin_tool',
                args: {},
              },
            });
            controller.enqueue({
              type: 'data-mastracode-tool-progress',
              runId: 'run-1',
              from: ChunkFrom.USER,
              data: {
                toolCallId: 'call-1',
                progress: { status: 'thinking', detail: 'Agent is answering…' },
              },
              transient: true,
            });
            controller.close();
          },
        }),
      },
      new RequestContext(),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool_update',
        toolCallId: 'call-1',
        partialResult: { status: 'thinking', detail: 'Agent is answering…' },
      }),
    );
    expect(session.displayState.get().activeTools.get('call-1')!.partialResult).toBe(
      '{"status":"thinking","detail":"Agent is answering…"}',
    );
  });

  it('uses display transforms while processing tool stream chunks', async () => {
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    const result = await (session as any).processStream(
      {
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'lookupCustomer',
                args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
              },
              metadata: {
                mastra: {
                  toolPayloadTransform: {
                    display: {
                      'input-available': { transformed: { customerId: 'cus_123' } },
                    },
                  },
                },
              },
            });
            controller.enqueue({
              type: 'tool-result',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'lookupCustomer',
                result: { displayName: 'Acme', apiKey: 'secret-output' },
              },
              metadata: {
                mastra: {
                  toolPayloadTransform: {
                    display: {
                      'output-available': { transformed: { displayName: 'Acme' } },
                    },
                  },
                },
              },
            });
            controller.close();
          },
        }),
      },
      new RequestContext(),
    );

    expect(result.message.content).toEqual([
      { type: 'tool_call', id: 'call-1', name: 'lookupCustomer', args: { customerId: 'cus_123' } },
      { type: 'tool_result', id: 'call-1', name: 'lookupCustomer', result: { displayName: 'Acme' }, isError: false },
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool_start',
        args: { customerId: 'cus_123' },
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool_end',
        result: { displayName: 'Acme' },
      }),
    );
  });

  it('preserves explicit null display transforms', async () => {
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    const result = await (session as any).processStream(
      {
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call-delta',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'lookupCustomer',
                argsTextDelta: '{"internalPath":"/workspace/private',
              },
              metadata: {
                mastra: {
                  toolPayloadTransform: {
                    display: {
                      'input-delta': { transformed: null },
                    },
                  },
                },
              },
            });
            controller.enqueue({
              type: 'tool-call',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'lookupCustomer',
                args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
              },
              metadata: {
                mastra: {
                  toolPayloadTransform: {
                    display: {
                      'input-available': { transformed: null },
                    },
                  },
                },
              },
            });
            controller.enqueue({
              type: 'tool-result',
              runId: 'run-1',
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: 'call-1',
                toolName: 'lookupCustomer',
                result: { displayName: 'Acme', apiKey: 'secret-output' },
              },
              metadata: {
                mastra: {
                  toolPayloadTransform: {
                    display: {
                      'output-available': { transformed: null },
                    },
                  },
                },
              },
            });
            controller.close();
          },
        }),
      },
      new RequestContext(),
    );

    expect(result.message.content).toEqual([
      { type: 'tool_call', id: 'call-1', name: 'lookupCustomer', args: null },
      { type: 'tool_result', id: 'call-1', name: 'lookupCustomer', result: null, isError: false },
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool_input_delta',
        argsTextDelta: null,
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool_start',
        args: null,
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool_end',
        result: null,
      }),
    );
  });

  describe('tool_approval_required', () => {
    it('sets pendingApproval', () => {
      emit(session, {
        type: 'tool_approval_required',
        toolCallId: 't1',
        toolName: 'execute_command',
        args: { command: 'rm -rf /' },
      });
      const approval = session.displayState.get().pendingApproval;
      expect(approval).not.toBeNull();
      expect(approval!.toolCallId).toBe('t1');
      expect(approval!.toolName).toBe('execute_command');
      expect(approval!.args).toEqual({ command: 'rm -rf /' });
    });
  });

  describe('tool_suspended', () => {
    it('sets a pendingSuspensions entry', () => {
      emit(session, {
        type: 'tool_suspended',
        toolCallId: 't1',
        toolName: 'confirmAction',
        args: { action: 'deploy' },
        suspendPayload: { reason: 'Needs confirmation' },
        resumeSchema: undefined,
      });
      const suspension = session.displayState.get().pendingSuspensions.get('t1');
      expect(suspension).toBeDefined();
      expect(suspension!.toolCallId).toBe('t1');
      expect(suspension!.toolName).toBe('confirmAction');
      expect(suspension!.args).toEqual({ action: 'deploy' });
      expect(suspension!.suspendPayload).toEqual({ reason: 'Needs confirmation' });
    });

    it('preserves pendingSuspensions on agent_start so resuming one keeps the rest', () => {
      emit(session, {
        type: 'tool_suspended',
        toolCallId: 't1',
        toolName: 'confirmAction',
        args: {},
        suspendPayload: {},
        resumeSchema: undefined,
      });
      expect(session.displayState.get().pendingSuspensions.size).toBe(1);

      // Resuming a parked tool restarts the run (a fresh agent_start); the other
      // parallel prompts must survive.
      emit(session, { type: 'agent_start' });
      expect(session.displayState.get().pendingSuspensions.has('t1')).toBe(true);
    });

    it('preserves pendingSuspensions on agent_end with reason suspended', () => {
      emit(session, {
        type: 'tool_suspended',
        toolCallId: 't1',
        toolName: 'confirmAction',
        args: {},
        suspendPayload: {},
        resumeSchema: undefined,
      });
      expect(session.displayState.get().pendingSuspensions.size).toBe(1);

      emit(session, { type: 'agent_end', reason: 'suspended' });
      expect(session.displayState.get().pendingSuspensions.size).toBe(1);
    });

    it('clears pendingSuspensions on agent_end with non-suspended reason', () => {
      emit(session, {
        type: 'tool_suspended',
        toolCallId: 't1',
        toolName: 'confirmAction',
        args: {},
        suspendPayload: {},
        resumeSchema: undefined,
      });
      expect(session.displayState.get().pendingSuspensions.size).toBe(1);

      emit(session, { type: 'agent_end', reason: 'complete' });
      expect(session.displayState.get().pendingSuspensions.size).toBe(0);
    });

    it('keeps other parked suspensions when one resumes while another is pending', () => {
      emit(session, {
        type: 'tool_suspended',
        toolCallId: 't1',
        toolName: 'ask_user',
        args: {},
        suspendPayload: { question: 'first?' },
        resumeSchema: undefined,
      });
      emit(session, {
        type: 'tool_suspended',
        toolCallId: 't2',
        toolName: 'ask_user',
        args: {},
        suspendPayload: { question: 'second?' },
        resumeSchema: undefined,
      });
      expect(session.displayState.get().pendingSuspensions.size).toBe(2);

      // Simulate resuming only t1 (display-state side of handleToolResume).
      session.displayState.get().pendingSuspensions.delete('t1');
      expect(session.displayState.get().pendingSuspensions.has('t1')).toBe(false);
      expect(session.displayState.get().pendingSuspensions.get('t2')?.suspendPayload).toEqual({
        question: 'second?',
      });
    });
  });
});

// ===========================================================================
// Modified files tracking
// ===========================================================================

describe('modifiedFiles tracking', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('tracks string_replace_lsp modifications', () => {
    emit(session, {
      type: 'tool_start',
      toolCallId: 't1',
      toolName: 'string_replace_lsp',
      args: { path: 'src/app.ts' },
    });
    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    const files = session.displayState.get().modifiedFiles;
    expect(files.has('src/app.ts')).toBe(true);
    expect(files.get('src/app.ts')!.operations).toEqual(['string_replace_lsp']);
  });

  it('tracks write_file modifications', () => {
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'write_file', args: { path: 'new.ts' } });
    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    expect(session.displayState.get().modifiedFiles.has('new.ts')).toBe(true);
  });

  it('tracks ast_smart_edit modifications', () => {
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'ast_smart_edit', args: { path: 'src/index.ts' } });
    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    expect(session.displayState.get().modifiedFiles.has('src/index.ts')).toBe(true);
  });

  it('accumulates multiple operations on the same file', () => {
    emit(session, {
      type: 'tool_start',
      toolCallId: 't1',
      toolName: 'string_replace_lsp',
      args: { path: 'src/app.ts' },
    });
    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    emit(session, {
      type: 'tool_start',
      toolCallId: 't2',
      toolName: 'string_replace_lsp',
      args: { path: 'src/app.ts' },
    });
    emit(session, { type: 'tool_end', toolCallId: 't2', result: 'ok', isError: false });

    const entry = session.displayState.get().modifiedFiles.get('src/app.ts');
    expect(entry!.operations).toEqual(['string_replace_lsp', 'string_replace_lsp']);
  });

  it('does not track file modifications for errored tools', () => {
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'write_file', args: { path: 'fail.ts' } });
    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'error', isError: true });

    expect(session.displayState.get().modifiedFiles.has('fail.ts')).toBe(false);
  });

  it('does not track non-file tools', () => {
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: { command: 'ls' } });
    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    expect(session.displayState.get().modifiedFiles.size).toBe(0);
  });
});

// ===========================================================================
// Interactive prompts
// ===========================================================================

describe('interactive prompts', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('sets a pendingSuspensions entry on tool_suspended', () => {
    emit(session, {
      type: 'tool_suspended',
      toolCallId: 'call-1',
      toolName: 'ask_user',
      args: {},
      suspendPayload: { question: 'Which option?' },
    });
    const s = session.displayState.get().pendingSuspensions.get('call-1');
    expect(s).toBeDefined();
    expect(s!.toolCallId).toBe('call-1');
    expect(s!.toolName).toBe('ask_user');
  });

  it('sets a pendingSuspensions entry on tool_suspended for submit_plan', () => {
    emit(session, {
      type: 'tool_suspended',
      toolCallId: 'call-plan',
      toolName: 'submit_plan',
      args: { title: 'Refactor Plan', plan: '# Steps\n1. Do X' },
      suspendPayload: { title: 'Refactor Plan', plan: '# Steps\n1. Do X' },
      resumeSchema: undefined,
    });
    const s = session.displayState.get().pendingSuspensions.get('call-plan');
    expect(s).toBeDefined();
    expect(s!.toolCallId).toBe('call-plan');
    expect(s!.toolName).toBe('submit_plan');
    expect(s!.suspendPayload).toEqual({ title: 'Refactor Plan', plan: '# Steps\n1. Do X' });
  });
});

// ===========================================================================
// Subagent lifecycle
// ===========================================================================

describe('subagent lifecycle', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('creates subagent entry on subagent_start', () => {
    emit(session, {
      type: 'subagent_start',
      toolCallId: 's1',
      agentType: 'explore',
      task: 'Find usages of X',
      modelId: 'gpt-4o',
      forked: true,
    });
    const sub = session.displayState.get().activeSubagents.get('s1');
    expect(sub).toBeDefined();
    expect(sub!.agentType).toBe('explore');
    expect(sub!.task).toBe('Find usages of X');
    expect(sub!.forked).toBe(true);
    expect(sub!.status).toBe('running');
    expect(sub!.toolCalls).toEqual([]);
  });

  it('includes displayName from configured subagent name on subagent_start', async () => {
    session = (
      await createSession(undefined, {
        subagents: [
          {
            id: 'explore',
            name: 'Explore',
            description: 'Find relevant context',
            instructions: 'Find relevant context.',
          },
        ],
      })
    ).session;

    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });

    const sub = session.displayState.get().activeSubagents.get('s1');
    expect(sub!.agentType).toBe('explore');
    expect(sub!.displayName).toBe('Explore');
  });

  it('leaves displayName unset when agentType has no configured subagent match', async () => {
    session = (
      await createSession(undefined, {
        subagents: [
          {
            id: 'explore',
            name: 'Explore',
            description: 'Find relevant context',
            instructions: 'Find relevant context.',
          },
        ],
      })
    ).session;

    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'execute', task: 't', modelId: 'm' });

    const sub = session.displayState.get().activeSubagents.get('s1');
    expect(sub!.agentType).toBe('execute');
    expect(sub!.displayName).toBeUndefined();
  });

  it('appends text on subagent_text_delta', () => {
    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });
    emit(session, { type: 'subagent_text_delta', toolCallId: 's1', agentType: 'explore', textDelta: 'hello ' });
    emit(session, { type: 'subagent_text_delta', toolCallId: 's1', agentType: 'explore', textDelta: 'world' });
    expect(session.displayState.get().activeSubagents.get('s1')!.textDelta).toBe('hello world');
  });

  it('tracks subagent tool calls', () => {
    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });
    emit(session, {
      type: 'subagent_tool_start',
      toolCallId: 's1',
      agentType: 'explore',
      subToolName: 'read_file',
      subToolArgs: {},
    });
    const sub = session.displayState.get().activeSubagents.get('s1')!;
    expect(sub.toolCalls).toHaveLength(1);
    expect(sub.toolCalls[0]!.name).toBe('read_file');
  });

  it('marks subagent tool error on subagent_tool_end', () => {
    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });
    emit(session, {
      type: 'subagent_tool_start',
      toolCallId: 's1',
      agentType: 'explore',
      subToolName: 'read_file',
      subToolArgs: {},
    });
    emit(session, {
      type: 'subagent_tool_end',
      toolCallId: 's1',
      agentType: 'explore',
      subToolName: 'read_file',
      subToolResult: 'err',
      isError: true,
    });
    const sub = session.displayState.get().activeSubagents.get('s1')!;
    expect(sub.toolCalls[0]!.isError).toBe(true);
  });

  it('marks subagent as completed on subagent_end', () => {
    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'execute', task: 't', modelId: 'm' });
    emit(session, {
      type: 'subagent_end',
      toolCallId: 's1',
      agentType: 'execute',
      result: 'done',
      isError: false,
      durationMs: 1234,
    });
    const sub = session.displayState.get().activeSubagents.get('s1')!;
    expect(sub.status).toBe('completed');
    expect(sub.durationMs).toBe(1234);
    expect(sub.result).toBe('done');
  });

  it('preserves displayName on terminal subagent history entries', async () => {
    session = (
      await createSession(undefined, {
        subagents: [
          {
            id: 'execute',
            name: 'Execute',
            description: 'Perform the delegated task',
            instructions: 'Perform the delegated task.',
          },
        ],
      })
    ).session;

    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'execute', task: 't', modelId: 'm' });
    emit(session, {
      type: 'subagent_end',
      toolCallId: 's1',
      agentType: 'execute',
      result: 'done',
      isError: false,
      durationMs: 1234,
    });

    const terminalSubagent = session.displayState.get().activeSubagents.get('s1')!;
    const historyEntry: AgentControllerSubagentHistoryEntry = terminalSubagent;

    expect(terminalSubagent.status).toBe('completed');
    expect(historyEntry.agentType).toBe('execute');
    expect(historyEntry.displayName).toBe('Execute');
    expect(historyEntry.result).toBe('done');
  });

  it('marks subagent as error on failed subagent_end', () => {
    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'execute', task: 't', modelId: 'm' });
    emit(session, {
      type: 'subagent_end',
      toolCallId: 's1',
      agentType: 'execute',
      result: 'failed',
      isError: true,
      durationMs: 500,
    });
    expect(session.displayState.get().activeSubagents.get('s1')!.status).toBe('error');
  });
});

// ===========================================================================
// Token usage tracking
// ===========================================================================

describe('usage_update', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('updates tokenUsage from internal token counters', () => {
    // Set internal token counters via the private field
    session.setTokenUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    emit(session, { type: 'usage_update', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });

    const usage = session.displayState.get().tokenUsage;
    expect(usage.promptTokens).toBe(100);
    expect(usage.completionTokens).toBe(50);
    expect(usage.totalTokens).toBe(150);
  });

  it('preserves richer token usage fields from internal token counters', () => {
    session.setTokenUsage({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    });
    emit(session, {
      type: 'usage_update',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 220,
        reasoningTokens: 70,
        cachedInputTokens: 25,
        cacheCreationInputTokens: 5,
        raw: { provider: 'test-provider' },
      },
    });

    expect(session.displayState.get().tokenUsage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    });
  });

  it('accumulates usage across multiple updates', () => {
    session.setTokenUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    emit(session, { type: 'usage_update', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });

    session.setTokenUsage({ promptTokens: 250, completionTokens: 120, totalTokens: 370 });
    emit(session, { type: 'usage_update', usage: { promptTokens: 250, completionTokens: 120, totalTokens: 370 } });

    const usage = session.displayState.get().tokenUsage;
    expect(usage.promptTokens).toBe(250);
    expect(usage.completionTokens).toBe(120);
    expect(usage.totalTokens).toBe(370);
  });
});

// ===========================================================================
// Task tracking
// ===========================================================================

describe('task_updated', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('updates tasks from event payload', () => {
    const tasks = [
      { id: 'fix-bug', content: 'Fix bug', status: 'in_progress' as const, activeForm: 'Fixing bug' },
      { id: 'write-tests', content: 'Write tests', status: 'pending' as const, activeForm: 'Writing tests' },
    ];
    emit(session, { type: 'task_updated', tasks });
    expect(session.displayState.get().tasks).toBe(tasks);
  });

  it('snapshots current tasks to previousTasks before update', () => {
    const tasks1 = [{ id: 'task-1', content: 'Task 1', status: 'pending' as const, activeForm: 'T1' }];
    const tasks2 = [
      { id: 'task-1', content: 'Task 1', status: 'completed' as const, activeForm: 'T1' },
      { id: 'task-2', content: 'Task 2', status: 'in_progress' as const, activeForm: 'T2' },
    ];

    emit(session, { type: 'task_updated', tasks: tasks1 });
    expect(session.displayState.get().previousTasks).toEqual([]);

    emit(session, { type: 'task_updated', tasks: tasks2 });
    expect(session.displayState.get().previousTasks).toEqual(tasks1);
    expect(session.displayState.get().tasks).toBe(tasks2);
  });

  it('preserves task ids in current and previous task snapshots', () => {
    const tasks1 = [{ id: 'task-1', content: 'Task 1', status: 'in_progress' as const, activeForm: 'T1' }];
    const tasks2 = [{ id: 'task-1', content: 'Task 1', status: 'completed' as const, activeForm: 'T1' }];

    emit(session, { type: 'task_updated', tasks: tasks1 });
    emit(session, { type: 'task_updated', tasks: tasks2 });

    expect(session.displayState.get().previousTasks).toEqual(tasks1);
    expect(session.displayState.get().tasks).toBe(tasks2);
  });
});

// ===========================================================================
// OM event → state transitions
// ===========================================================================

describe('OM event transitions', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  describe('om_status', () => {
    it('populates omProgress from window data', () => {
      emit(session, {
        type: 'om_status',
        windows: {
          active: {
            messages: { tokens: 15000, threshold: 30000 },
            observations: { tokens: 8000, threshold: 40000 },
          },
          buffered: {
            observations: {
              status: 'idle',
              chunks: 0,
              messageTokens: 0,
              projectedMessageRemoval: 0,
              observationTokens: 0,
            },
            reflection: { status: 'idle', inputObservationTokens: 0, observationTokens: 0 },
          },
        },
        recordId: 'r1',
        threadId: 't1',
        stepNumber: 3,
        generationCount: 2,
      } as any);

      const omp = session.displayState.get().omProgress;
      expect(omp.pendingTokens).toBe(15000);
      expect(omp.threshold).toBe(30000);
      expect(omp.thresholdPercent).toBe(50);
      expect(omp.observationTokens).toBe(8000);
      expect(omp.reflectionThreshold).toBe(40000);
      expect(omp.reflectionThresholdPercent).toBe(20);
      expect(omp.stepNumber).toBe(3);
      expect(omp.generationCount).toBe(2);
    });

    it('sets bufferingMessages from buffered.observations.status', () => {
      emit(session, {
        type: 'om_status',
        windows: {
          active: { messages: { tokens: 0, threshold: 30000 }, observations: { tokens: 0, threshold: 40000 } },
          buffered: {
            observations: {
              status: 'running',
              chunks: 1,
              messageTokens: 0,
              projectedMessageRemoval: 0,
              observationTokens: 0,
            },
            reflection: { status: 'idle', inputObservationTokens: 0, observationTokens: 0 },
          },
        },
        recordId: 'r1',
        threadId: 't1',
        stepNumber: 0,
        generationCount: 0,
      } as any);

      expect(session.displayState.get().bufferingMessages).toBe(true);
      expect(session.displayState.get().bufferingObservations).toBe(false);
    });

    it('sets bufferingObservations from buffered.reflection.status', () => {
      emit(session, {
        type: 'om_status',
        windows: {
          active: { messages: { tokens: 0, threshold: 30000 }, observations: { tokens: 0, threshold: 40000 } },
          buffered: {
            observations: {
              status: 'idle',
              chunks: 0,
              messageTokens: 0,
              projectedMessageRemoval: 0,
              observationTokens: 0,
            },
            reflection: { status: 'running', inputObservationTokens: 0, observationTokens: 0 },
          },
        },
        recordId: 'r1',
        threadId: 't1',
        stepNumber: 0,
        generationCount: 0,
      } as any);

      expect(session.displayState.get().bufferingMessages).toBe(false);
      expect(session.displayState.get().bufferingObservations).toBe(true);
    });
  });

  describe('om_observation_start / end / failed', () => {
    it('sets status to observing on om_observation_start', () => {
      emit(session, {
        type: 'om_observation_start',
        cycleId: 'c1',
        operationType: 'observation',
        tokensToObserve: 5000,
      });
      const omp = session.displayState.get().omProgress;
      expect(omp.status).toBe('observing');
      expect(omp.cycleId).toBe('c1');
      expect(omp.startTime).toBeDefined();
    });

    it('resets to idle and updates tokens on om_observation_end', () => {
      emit(session, {
        type: 'om_observation_start',
        cycleId: 'c1',
        operationType: 'observation',
        tokensToObserve: 5000,
      });
      emit(session, {
        type: 'om_observation_end',
        cycleId: 'c1',
        durationMs: 1000,
        tokensObserved: 5000,
        observationTokens: 6000,
      } as any);

      const omp = session.displayState.get().omProgress;
      expect(omp.status).toBe('idle');
      expect(omp.cycleId).toBeUndefined();
      expect(omp.startTime).toBeUndefined();
      expect(omp.observationTokens).toBe(6000);
      expect(omp.pendingTokens).toBe(0);
      expect(omp.thresholdPercent).toBe(0);
    });

    it('resets to idle on om_observation_failed', () => {
      emit(session, {
        type: 'om_observation_start',
        cycleId: 'c1',
        operationType: 'observation',
        tokensToObserve: 5000,
      });
      emit(session, { type: 'om_observation_failed', cycleId: 'c1', error: 'timeout', durationMs: 500 });

      const omp = session.displayState.get().omProgress;
      expect(omp.status).toBe('idle');
      expect(omp.cycleId).toBeUndefined();
    });
  });

  describe('om_reflection_start / end / failed', () => {
    it('sets status to reflecting and captures preReflectionTokens', () => {
      // First set some observation tokens via om_status
      emit(session, {
        type: 'om_status',
        windows: {
          active: { messages: { tokens: 0, threshold: 30000 }, observations: { tokens: 10000, threshold: 40000 } },
          buffered: {
            observations: {
              status: 'idle',
              chunks: 0,
              messageTokens: 0,
              projectedMessageRemoval: 0,
              observationTokens: 0,
            },
            reflection: { status: 'idle', inputObservationTokens: 0, observationTokens: 0 },
          },
        },
        recordId: 'r1',
        threadId: 't1',
        stepNumber: 0,
        generationCount: 0,
      } as any);

      emit(session, { type: 'om_reflection_start', cycleId: 'c1', tokensToReflect: 42000 });
      const omp = session.displayState.get().omProgress;
      expect(omp.status).toBe('reflecting');
      expect(omp.preReflectionTokens).toBe(10000); // captured from observationTokens before overwrite
      expect(omp.observationTokens).toBe(42000);
      expect(omp.reflectionThresholdPercent).toBe((42000 / 40000) * 100);
    });

    it('updates to compressed tokens on om_reflection_end', () => {
      emit(session, { type: 'om_reflection_start', cycleId: 'c1', tokensToReflect: 42000 });
      emit(session, { type: 'om_reflection_end', cycleId: 'c1', durationMs: 2000, compressedTokens: 15000 } as any);

      const omp = session.displayState.get().omProgress;
      expect(omp.status).toBe('idle');
      expect(omp.observationTokens).toBe(15000);
    });

    it('resets to idle on om_reflection_failed', () => {
      emit(session, { type: 'om_reflection_start', cycleId: 'c1', tokensToReflect: 42000 });
      emit(session, { type: 'om_reflection_failed', cycleId: 'c1', error: 'timeout', durationMs: 500 });

      expect(session.displayState.get().omProgress.status).toBe('idle');
    });
  });

  describe('om_buffering_start / end / failed / activation', () => {
    it('sets bufferingMessages on observation buffering start', () => {
      emit(session, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'observation', tokensToBuffer: 1000 });
      expect(session.displayState.get().bufferingMessages).toBe(true);
      expect(session.displayState.get().bufferingObservations).toBe(false);
    });

    it('sets bufferingObservations on reflection buffering start', () => {
      emit(session, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'reflection', tokensToBuffer: 1000 });
      expect(session.displayState.get().bufferingMessages).toBe(false);
      expect(session.displayState.get().bufferingObservations).toBe(true);
    });

    it('clears bufferingMessages on observation buffering end', () => {
      emit(session, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'observation', tokensToBuffer: 1000 });
      emit(session, {
        type: 'om_buffering_end',
        cycleId: 'c1',
        operationType: 'observation',
        tokensBuffered: 1000,
        bufferedTokens: 1000,
      } as any);
      expect(session.displayState.get().bufferingMessages).toBe(false);
    });

    it('clears bufferingObservations on reflection buffering end', () => {
      emit(session, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'reflection', tokensToBuffer: 1000 });
      emit(session, {
        type: 'om_buffering_end',
        cycleId: 'c1',
        operationType: 'reflection',
        tokensBuffered: 1000,
        bufferedTokens: 1000,
      } as any);
      expect(session.displayState.get().bufferingObservations).toBe(false);
    });

    it('clears buffering flag on observation buffering failed', () => {
      emit(session, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'observation', tokensToBuffer: 1000 });
      emit(session, { type: 'om_buffering_failed', cycleId: 'c1', operationType: 'observation', error: 'timeout' });
      expect(session.displayState.get().bufferingMessages).toBe(false);
    });

    it('clears buffering flag on reflection buffering failed', () => {
      emit(session, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'reflection', tokensToBuffer: 1000 });
      emit(session, { type: 'om_buffering_failed', cycleId: 'c1', operationType: 'reflection', error: 'timeout' });
      expect(session.displayState.get().bufferingObservations).toBe(false);
    });

    it('clears bufferingMessages on observation activation', () => {
      emit(session, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'observation', tokensToBuffer: 1000 });
      emit(session, {
        type: 'om_activation',
        cycleId: 'c1',
        operationType: 'observation',
        chunksActivated: 1,
        tokensActivated: 500,
        observationTokens: 800,
        messagesActivated: 5,
        generationCount: 1,
      });
      expect(session.displayState.get().bufferingMessages).toBe(false);
    });

    it('clears bufferingObservations on reflection activation', () => {
      emit(session, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'reflection', tokensToBuffer: 1000 });
      emit(session, {
        type: 'om_activation',
        cycleId: 'c1',
        operationType: 'reflection',
        chunksActivated: 1,
        tokensActivated: 500,
        observationTokens: 800,
        messagesActivated: 5,
        generationCount: 1,
      });
      expect(session.displayState.get().bufferingObservations).toBe(false);
    });
  });
});

// ===========================================================================
// state_changed threshold syncing
// ===========================================================================

describe('state_changed threshold syncing', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('updates observation threshold from state_changed', () => {
    // Set some pending tokens first
    (session.displayState.get() as any).omProgress.pendingTokens = 15000;

    emit(session, {
      type: 'state_changed',
      state: { observationThreshold: 20000 },
      changedKeys: ['observationThreshold'],
    });

    const omp = session.displayState.get().omProgress;
    expect(omp.threshold).toBe(20000);
    expect(omp.thresholdPercent).toBe(75); // 15000 / 20000 * 100
  });

  it('updates reflection threshold from state_changed', () => {
    (session.displayState.get() as any).omProgress.observationTokens = 20000;

    emit(session, {
      type: 'state_changed',
      state: { reflectionThreshold: 50000 },
      changedKeys: ['reflectionThreshold'],
    });

    const omp = session.displayState.get().omProgress;
    expect(omp.reflectionThreshold).toBe(50000);
    expect(omp.reflectionThresholdPercent).toBe(40); // 20000 / 50000 * 100
  });

  it('ignores non-threshold keys in state_changed', () => {
    const beforeThreshold = session.displayState.get().omProgress.threshold;
    emit(session, {
      type: 'state_changed',
      state: { yolo: true },
      changedKeys: ['yolo'],
    });
    expect(session.displayState.get().omProgress.threshold).toBe(beforeThreshold);
  });
});

// ===========================================================================
// Thread lifecycle (resetThreadDisplayState)
// ===========================================================================

describe('resetThreadDisplayState', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('resets all thread-scoped state on thread_created', () => {
    // Populate various state
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: {} });
    emit(session, { type: 'tool_input_start', toolCallId: 't2', toolName: 'write_file' });
    emit(session, {
      type: 'tool_suspended',
      toolCallId: 'p1',
      toolName: 'submit_plan',
      args: { title: 'P', plan: '#' },
      suspendPayload: { title: 'P', plan: '#' },
      resumeSchema: undefined,
    });
    emit(session, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });
    emit(session, {
      type: 'task_updated',
      tasks: [{ id: 'task-t', content: 'T', status: 'pending', activeForm: 'T' }],
    });
    emit(session, { type: 'om_observation_start', cycleId: 'c1', operationType: 'observation', tokensToObserve: 5000 });
    emit(session, { type: 'om_buffering_start', cycleId: 'c2', operationType: 'observation', tokensToBuffer: 1000 });

    // Now create new thread
    emit(session, { type: 'thread_created', thread: { id: 'new', title: 'New' } } as any);

    const ds = session.displayState.get();
    expect(ds.activeTools.size).toBe(0);
    expect(ds.toolInputBuffers.size).toBe(0);
    expect(ds.pendingApproval).toBeNull();
    expect(ds.pendingSuspensions.size).toBe(0);
    expect(ds.activeSubagents.size).toBe(0);
    expect(ds.currentMessage).toBeNull();
    expect(ds.modifiedFiles.size).toBe(0);
    expect(ds.tasks).toEqual([]);
    expect(ds.previousTasks).toEqual([]);
    expect(ds.omProgress.status).toBe('idle');
    expect(ds.omProgress.pendingTokens).toBe(0);
    expect(ds.bufferingMessages).toBe(false);
    expect(ds.bufferingObservations).toBe(false);
  });

  it('resets tokenUsage to zero on thread_created', () => {
    session.setTokenUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    emit(session, { type: 'usage_update', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });
    expect(session.displayState.get().tokenUsage.totalTokens).toBe(150);

    emit(session, { type: 'thread_created', thread: { id: 'new', title: 'New' } } as any);
    expect(session.displayState.get().tokenUsage).toEqual(createEmptyTokenUsage());
  });

  it('preserves isRunning across thread_created', () => {
    emit(session, { type: 'agent_start' });
    expect(session.displayState.get().isRunning).toBe(true);

    emit(session, { type: 'thread_created', thread: { id: 'new', title: 'New' } } as any);
    // isRunning is NOT reset by resetThreadDisplayState
    expect(session.displayState.get().isRunning).toBe(true);
  });

  it('resets omProgress on thread_changed', () => {
    emit(session, { type: 'om_observation_start', cycleId: 'c1', operationType: 'observation', tokensToObserve: 5000 });
    expect(session.displayState.get().omProgress.status).toBe('observing');

    emit(session, { type: 'thread_changed', threadId: 'other', previousThreadId: 'old' });
    expect(session.displayState.get().omProgress.status).toBe('idle');
    expect(session.displayState.get().omProgress.pendingTokens).toBe(0);
  });

  it('syncs tokenUsage from internal counters on thread_changed', () => {
    session.setTokenUsage({ promptTokens: 200, completionTokens: 100, totalTokens: 300 });
    emit(session, { type: 'thread_changed', threadId: 'other', previousThreadId: 'old' });
    expect(session.displayState.get().tokenUsage.totalTokens).toBe(300);
  });
});

// ===========================================================================
// display_state_changed emission
// ===========================================================================

describe('display_state_changed emission', () => {
  let session: Session;
  let events: AgentControllerEvent[];

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
    events = [];
    session.subscribe((event: AgentControllerEvent) => {
      events.push(event);
    });
    // createSession emits workspace lifecycle events (workspace_status_changed,
    // workspace_ready) during session creation, before this subscriber attaches.
    // The bus replays them to late subscribers — clear them so the tests below
    // only observe events they emit themselves.
    events.length = 0;
  });

  it('emits display_state_changed after every non-display_state_changed event', () => {
    emit(session, { type: 'agent_start' });
    expect(events.length).toBe(2);
    expect(events[0]!.type).toBe('agent_start');
    expect(events[1]!.type).toBe('display_state_changed');
  });

  it('includes current display state reference in display_state_changed', () => {
    emit(session, { type: 'agent_start' });
    const dscEvent = events.find(e => e.type === 'display_state_changed');
    expect(dscEvent).toBeDefined();
    if (dscEvent?.type === 'display_state_changed') {
      expect(dscEvent.displayState).toBe(session.displayState.get());
    }
  });

  it('display state is already updated when display_state_changed fires', () => {
    emit(session, { type: 'agent_start' });
    const dscEvent = events.find(e => e.type === 'display_state_changed');
    if (dscEvent?.type === 'display_state_changed') {
      expect(dscEvent.displayState.isRunning).toBe(true);
    }
  });

  it('does not emit display_state_changed for display_state_changed (no recursion)', () => {
    emit(session, { type: 'display_state_changed', displayState: session.displayState.get() });
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('display_state_changed');
  });

  it('restores replayed task display state without emitting any event', () => {
    const tasks = [{ id: 'tests', content: 'Write tests', status: 'pending' as const, activeForm: 'Writing tests' }];

    session.displayState.restoreTasks(tasks);

    // restoreTasks is a pure session-state mutation: it updates the snapshot but
    // does not touch the AgentController event bus (the UI re-renders explicitly after a
    // replay). No task_updated and no display_state_changed should fire.
    expect(session.displayState.get().tasks).toEqual(tasks);
    expect(session.displayState.get().previousTasks).toEqual([]);
    expect(events).toEqual([]);
  });

  it('emits display_state_changed for each event in a sequence', () => {
    emit(session, { type: 'agent_start' });
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'x' } });
    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });
    emit(session, { type: 'agent_end', reason: 'complete' });

    const dscEvents = events.filter(e => e.type === 'display_state_changed');
    expect(dscEvents.length).toBe(4);
  });

  it('raw subscribe receives every source event and every display_state_changed event', () => {
    for (let i = 0; i < 5; i++) {
      emit(session, {
        type: 'tool_input_delta',
        toolCallId: 'missing',
        argsTextDelta: String(i),
      });
    }

    const eventTypes = events.map(event => event.type);
    expect(eventTypes.filter(type => type === 'tool_input_delta')).toHaveLength(5);
    expect(eventTypes.filter(type => type === 'display_state_changed')).toHaveLength(5);
    expect(eventTypes).toEqual([
      'tool_input_delta',
      'display_state_changed',
      'tool_input_delta',
      'display_state_changed',
      'tool_input_delta',
      'display_state_changed',
      'tool_input_delta',
      'display_state_changed',
      'tool_input_delta',
      'display_state_changed',
    ]);
  });

  it('display_state_changed reflects state at time of each event', () => {
    const snapshots: boolean[] = [];
    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'display_state_changed') {
        snapshots.push(event.displayState.isRunning);
      }
    });

    emit(session, { type: 'agent_start' });
    emit(session, { type: 'agent_end', reason: 'complete' });

    // Note: there are 2 sets of snapshots from the first subscriber and this one
    // Just check the second subscriber's snapshots
    expect(snapshots[0]).toBe(true); // after agent_start
    expect(snapshots[1]).toBe(false); // after agent_end
  });
});

// ===========================================================================
// Full lifecycle integration
// ===========================================================================

describe('full lifecycle integration', () => {
  let session: Session;

  beforeEach(async () => {
    const ctx = await createSession();
    session = ctx.session;
  });

  it('handles a complete agent run lifecycle', () => {
    const ds = session.displayState.get();

    // Agent starts
    emit(session, { type: 'agent_start' });
    expect(ds.isRunning).toBe(true);

    // Message starts streaming
    const msg = { id: 'm1', role: 'assistant' as const, content: [], createdAt: new Date() };
    emit(session, { type: 'message_start', message: msg as any });
    expect(ds.currentMessage).toBe(msg);

    // Tool input streaming
    emit(session, { type: 'tool_input_start', toolCallId: 't1', toolName: 'string_replace_lsp' });
    expect(ds.activeTools.get('t1')?.status).toBe('streaming_input');
    expect(ds.toolInputBuffers.has('t1')).toBe(true);

    emit(session, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '{"path":"foo.ts"' });
    emit(session, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '}' });
    expect(ds.toolInputBuffers.get('t1')!.text).toBe('{"path":"foo.ts"}');

    emit(session, { type: 'tool_input_end', toolCallId: 't1' });
    expect(ds.toolInputBuffers.has('t1')).toBe(false);

    // Tool runs
    emit(session, { type: 'tool_start', toolCallId: 't1', toolName: 'string_replace_lsp', args: { path: 'foo.ts' } });
    expect(ds.activeTools.get('t1')?.status).toBe('running');

    emit(session, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });
    expect(ds.activeTools.get('t1')?.status).toBe('completed');
    expect(ds.modifiedFiles.has('foo.ts')).toBe(true);

    // Task update
    emit(session, {
      type: 'task_updated',
      tasks: [{ id: 'edit-foo', content: 'Edit foo', status: 'completed', activeForm: 'Editing' }],
    });
    expect(ds.tasks).toHaveLength(1);

    // Usage update
    session.setTokenUsage({ promptTokens: 1000, completionTokens: 500, totalTokens: 1500 });
    emit(session, { type: 'usage_update', usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 } });
    expect(ds.tokenUsage.totalTokens).toBe(1500);

    // Agent ends
    emit(session, { type: 'agent_end', reason: 'complete' });
    expect(ds.isRunning).toBe(false);

    // Modified files and token usage persist after agent_end
    expect(ds.modifiedFiles.has('foo.ts')).toBe(true);
    expect(ds.tokenUsage.totalTokens).toBe(1500);
  });
});

// ===========================================================================
// OMProgressState shape
// ===========================================================================

describe('Display state OMProgressState', () => {
  it('has correct OMProgressState shape', () => {
    const ds = defaultDisplayState();
    const omp = ds.omProgress;
    expect(omp).toHaveProperty('status');
    expect(omp).toHaveProperty('pendingTokens');
    expect(omp).toHaveProperty('threshold');
    expect(omp).toHaveProperty('thresholdPercent');
    expect(omp).toHaveProperty('observationTokens');
    expect(omp).toHaveProperty('reflectionThreshold');
    expect(omp).toHaveProperty('reflectionThresholdPercent');
    expect(omp).toHaveProperty('buffered');
    expect(omp.buffered).toHaveProperty('observations');
    expect(omp.buffered).toHaveProperty('reflection');
    expect(omp).toHaveProperty('generationCount');
    expect(omp).toHaveProperty('stepNumber');
    expect(omp).toHaveProperty('preReflectionTokens');
  });
});
