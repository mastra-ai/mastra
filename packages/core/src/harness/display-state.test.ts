import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';
import { defaultDisplayState } from './types';

function createHarness(storage?: InMemoryStore) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage: storage ?? new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

// Helper to call the private emit method
function emit(harness: Harness, event: HarnessEvent) {
  (harness as any).emit(event);
}

describe('defaultDisplayState', () => {
  it('returns a fresh display state with correct defaults', () => {
    const ds = defaultDisplayState();
    expect(ds.isRunning).toBe(false);
    expect(ds.currentMessage).toBeNull();
    expect(ds.tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    expect(ds.activeTools).toBeInstanceOf(Map);
    expect(ds.activeTools.size).toBe(0);
    expect(ds.toolInputBuffers).toBeInstanceOf(Map);
    expect(ds.toolInputBuffers.size).toBe(0);
    expect(ds.pendingApproval).toBeNull();
    expect(ds.pendingQuestion).toBeNull();
    expect(ds.pendingPlanApproval).toBeNull();
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
    ds1.tasks.push({ content: 'test', status: 'pending', activeForm: 'Testing' });
    expect(ds2.tasks).toEqual([]);
  });
});

describe('Harness.getDisplayState()', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('returns display state with correct initial values', () => {
    const ds = harness.getDisplayState();
    expect(ds.isRunning).toBe(false);
    expect(ds.currentMessage).toBeNull();
    expect(ds.tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    expect(ds.activeTools.size).toBe(0);
    expect(ds.pendingApproval).toBeNull();
    expect(ds.pendingQuestion).toBeNull();
    expect(ds.pendingPlanApproval).toBeNull();
    expect(ds.activeSubagents.size).toBe(0);
    expect(ds.modifiedFiles.size).toBe(0);
    expect(ds.tasks).toEqual([]);
    expect(ds.previousTasks).toEqual([]);
  });

  it('returns the same reference (not a copy)', () => {
    const ds1 = harness.getDisplayState();
    const ds2 = harness.getDisplayState();
    expect(ds1).toBe(ds2);
  });
});

// ===========================================================================
// Agent lifecycle
// ===========================================================================

describe('agent lifecycle', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('sets isRunning to true on agent_start', () => {
    emit(harness, { type: 'agent_start' });
    expect(harness.getDisplayState().isRunning).toBe(true);
  });

  it('clears activeTools on agent_start', () => {
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: {} });
    expect(harness.getDisplayState().activeTools.size).toBe(1);

    emit(harness, { type: 'agent_start' });
    expect(harness.getDisplayState().activeTools.size).toBe(0);
  });

  it('clears toolInputBuffers on agent_start', () => {
    emit(harness, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
    expect(harness.getDisplayState().toolInputBuffers.size).toBe(1);

    emit(harness, { type: 'agent_start' });
    expect(harness.getDisplayState().toolInputBuffers.size).toBe(0);
  });

  it('clears pendingApproval on agent_start', () => {
    emit(harness, { type: 'tool_approval_required', toolCallId: 't1', toolName: 'write_file', args: {} });
    expect(harness.getDisplayState().pendingApproval).not.toBeNull();

    emit(harness, { type: 'agent_start' });
    expect(harness.getDisplayState().pendingApproval).toBeNull();
  });

  it('sets isRunning to false on agent_end', () => {
    emit(harness, { type: 'agent_start' });
    expect(harness.getDisplayState().isRunning).toBe(true);

    emit(harness, { type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().isRunning).toBe(false);
  });

  it('clears pendingQuestion on agent_end', () => {
    emit(harness, { type: 'ask_question', questionId: 'q1', question: 'What?', options: [] });
    expect(harness.getDisplayState().pendingQuestion).not.toBeNull();

    emit(harness, { type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().pendingQuestion).toBeNull();
  });

  it('clears pendingPlanApproval on agent_end', () => {
    emit(harness, { type: 'plan_approval_required', planId: 'p1', title: 'Plan', plan: '# Plan' });
    expect(harness.getDisplayState().pendingPlanApproval).not.toBeNull();

    emit(harness, { type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().pendingPlanApproval).toBeNull();
  });

  it('marks running tools as error on agent_end', () => {
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'test.ts' } });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('running');

    emit(harness, { type: 'agent_end', reason: 'aborted' });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('error');
  });

  it('marks streaming_input tools as error on agent_end', () => {
    emit(harness, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('streaming_input');

    emit(harness, { type: 'agent_end', reason: 'aborted' });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('error');
  });

  it('does not change completed tools on agent_end', () => {
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'test.ts' } });
    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('completed');

    emit(harness, { type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('completed');
  });

  it('clears activeSubagents on agent_end', () => {
    emit(harness, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 'find', modelId: 'gpt-4o' });
    expect(harness.getDisplayState().activeSubagents.size).toBe(1);

    emit(harness, { type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().activeSubagents.size).toBe(0);
  });
});

// ===========================================================================
// Message streaming
// ===========================================================================

describe('message streaming', () => {
  let harness: Harness;
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

  beforeEach(() => {
    harness = createHarness();
  });

  it('tracks currentMessage on message_start', () => {
    emit(harness, { type: 'message_start', message: msg1 as any });
    expect(harness.getDisplayState().currentMessage).toBe(msg1);
  });

  it('updates currentMessage on message_update', () => {
    emit(harness, { type: 'message_start', message: msg1 as any });
    emit(harness, { type: 'message_update', message: msg2 as any });
    expect(harness.getDisplayState().currentMessage).toBe(msg2);
  });

  it('keeps currentMessage reference on message_end', () => {
    emit(harness, { type: 'message_start', message: msg1 as any });
    emit(harness, { type: 'message_end', message: msg2 as any });
    expect(harness.getDisplayState().currentMessage).toBe(msg2);
  });
});

// ===========================================================================
// Tool lifecycle
// ===========================================================================

describe('tool lifecycle', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  describe('tool_start / tool_end', () => {
    it('creates tool entry on tool_start', () => {
      emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'foo.ts' } });
      const tool = harness.getDisplayState().activeTools.get('t1');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('read_file');
      expect(tool!.args).toEqual({ path: 'foo.ts' });
      expect(tool!.status).toBe('running');
    });

    it('updates existing tool entry on tool_start (after tool_input_start)', () => {
      emit(harness, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      emit(harness, {
        type: 'tool_start',
        toolCallId: 't1',
        toolName: 'write_file',
        args: { path: 'x', content: 'y' },
      });
      const tool = harness.getDisplayState().activeTools.get('t1');
      expect(tool!.status).toBe('running');
      expect(tool!.args).toEqual({ path: 'x', content: 'y' });
    });

    it('marks tool as completed on successful tool_end', () => {
      emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: {} });
      emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'file contents', isError: false });
      const tool = harness.getDisplayState().activeTools.get('t1');
      expect(tool!.status).toBe('completed');
      expect(tool!.result).toBe('file contents');
      expect(tool!.isError).toBe(false);
    });

    it('marks tool as error on failed tool_end', () => {
      emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: {} });
      emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'not found', isError: true });
      const tool = harness.getDisplayState().activeTools.get('t1');
      expect(tool!.status).toBe('error');
      expect(tool!.isError).toBe(true);
    });
  });

  describe('tool_update', () => {
    it('sets partialResult on existing tool', () => {
      emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: {} });
      emit(harness, { type: 'tool_update', toolCallId: 't1', partialResult: 'partial output' });
      expect(harness.getDisplayState().activeTools.get('t1')!.partialResult).toBe('partial output');
    });

    it('stringifies non-string partialResult', () => {
      emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: {} });
      emit(harness, { type: 'tool_update', toolCallId: 't1', partialResult: { key: 'value' } });
      expect(harness.getDisplayState().activeTools.get('t1')!.partialResult).toBe('{"key":"value"}');
    });

    it('ignores update for unknown toolCallId', () => {
      emit(harness, { type: 'tool_update', toolCallId: 'unknown', partialResult: 'x' });
      expect(harness.getDisplayState().activeTools.has('unknown')).toBe(false);
    });
  });

  describe('shell_output', () => {
    it('appends shell output to tool', () => {
      emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: {} });
      emit(harness, { type: 'shell_output', toolCallId: 't1', output: 'line1\n', stream: 'stdout' });
      emit(harness, { type: 'shell_output', toolCallId: 't1', output: 'line2\n', stream: 'stderr' });
      expect(harness.getDisplayState().activeTools.get('t1')!.shellOutput).toBe('line1\nline2\n');
    });
  });

  describe('tool_input_start / tool_input_delta / tool_input_end', () => {
    it('creates buffer on tool_input_start', () => {
      emit(harness, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      const buf = harness.getDisplayState().toolInputBuffers.get('t1');
      expect(buf).toBeDefined();
      expect(buf!.text).toBe('');
      expect(buf!.toolName).toBe('write_file');
    });

    it('creates tool entry with streaming_input status on tool_input_start', () => {
      emit(harness, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      const tool = harness.getDisplayState().activeTools.get('t1');
      expect(tool).toBeDefined();
      expect(tool!.status).toBe('streaming_input');
    });

    it('accumulates text on tool_input_delta', () => {
      emit(harness, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      emit(harness, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '{"path":' });
      emit(harness, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '"test.ts"}' });
      expect(harness.getDisplayState().toolInputBuffers.get('t1')!.text).toBe('{"path":"test.ts"}');
    });

    it('removes buffer on tool_input_end', () => {
      emit(harness, { type: 'tool_input_start', toolCallId: 't1', toolName: 'write_file' });
      emit(harness, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '{}' });
      emit(harness, { type: 'tool_input_end', toolCallId: 't1' });
      expect(harness.getDisplayState().toolInputBuffers.has('t1')).toBe(false);
    });

    it('ignores delta for unknown toolCallId', () => {
      emit(harness, { type: 'tool_input_delta', toolCallId: 'unknown', argsTextDelta: 'x' });
      expect(harness.getDisplayState().toolInputBuffers.has('unknown')).toBe(false);
    });
  });

  describe('tool_approval_required', () => {
    it('sets pendingApproval', () => {
      emit(harness, {
        type: 'tool_approval_required',
        toolCallId: 't1',
        toolName: 'execute_command',
        args: { command: 'rm -rf /' },
      });
      const approval = harness.getDisplayState().pendingApproval;
      expect(approval).not.toBeNull();
      expect(approval!.toolCallId).toBe('t1');
      expect(approval!.toolName).toBe('execute_command');
      expect(approval!.args).toEqual({ command: 'rm -rf /' });
    });
  });
});

// ===========================================================================
// Modified files tracking
// ===========================================================================

describe('modifiedFiles tracking', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('tracks string_replace_lsp modifications', () => {
    emit(harness, {
      type: 'tool_start',
      toolCallId: 't1',
      toolName: 'string_replace_lsp',
      args: { path: 'src/app.ts' },
    });
    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    const files = harness.getDisplayState().modifiedFiles;
    expect(files.has('src/app.ts')).toBe(true);
    expect(files.get('src/app.ts')!.operations).toEqual(['string_replace_lsp']);
  });

  it('tracks write_file modifications', () => {
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'write_file', args: { path: 'new.ts' } });
    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    expect(harness.getDisplayState().modifiedFiles.has('new.ts')).toBe(true);
  });

  it('tracks ast_smart_edit modifications', () => {
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'ast_smart_edit', args: { path: 'src/index.ts' } });
    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    expect(harness.getDisplayState().modifiedFiles.has('src/index.ts')).toBe(true);
  });

  it('accumulates multiple operations on the same file', () => {
    emit(harness, {
      type: 'tool_start',
      toolCallId: 't1',
      toolName: 'string_replace_lsp',
      args: { path: 'src/app.ts' },
    });
    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    emit(harness, {
      type: 'tool_start',
      toolCallId: 't2',
      toolName: 'string_replace_lsp',
      args: { path: 'src/app.ts' },
    });
    emit(harness, { type: 'tool_end', toolCallId: 't2', result: 'ok', isError: false });

    const entry = harness.getDisplayState().modifiedFiles.get('src/app.ts');
    expect(entry!.operations).toEqual(['string_replace_lsp', 'string_replace_lsp']);
  });

  it('does not track file modifications for errored tools', () => {
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'write_file', args: { path: 'fail.ts' } });
    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'error', isError: true });

    expect(harness.getDisplayState().modifiedFiles.has('fail.ts')).toBe(false);
  });

  it('does not track non-file tools', () => {
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'execute_command', args: { command: 'ls' } });
    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });

    expect(harness.getDisplayState().modifiedFiles.size).toBe(0);
  });
});

// ===========================================================================
// Interactive prompts
// ===========================================================================

describe('interactive prompts', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('sets pendingQuestion on ask_question', () => {
    emit(harness, {
      type: 'ask_question',
      questionId: 'q1',
      question: 'Which option?',
      options: [{ label: 'A' }, { label: 'B' }],
    });
    const q = harness.getDisplayState().pendingQuestion;
    expect(q).not.toBeNull();
    expect(q!.questionId).toBe('q1');
    expect(q!.question).toBe('Which option?');
    expect(q!.options).toHaveLength(2);
  });

  it('sets pendingPlanApproval on plan_approval_required', () => {
    emit(harness, {
      type: 'plan_approval_required',
      planId: 'p1',
      title: 'Refactor Plan',
      plan: '# Steps\n1. Do X',
    });
    const p = harness.getDisplayState().pendingPlanApproval;
    expect(p).not.toBeNull();
    expect(p!.planId).toBe('p1');
    expect(p!.title).toBe('Refactor Plan');
    expect(p!.plan).toBe('# Steps\n1. Do X');
  });

  it('clears pendingPlanApproval on plan_approved', () => {
    emit(harness, { type: 'plan_approval_required', planId: 'p1', title: 'Plan', plan: '...' });
    expect(harness.getDisplayState().pendingPlanApproval).not.toBeNull();

    emit(harness, { type: 'plan_approved' });
    expect(harness.getDisplayState().pendingPlanApproval).toBeNull();
  });
});

// ===========================================================================
// Subagent lifecycle
// ===========================================================================

describe('subagent lifecycle', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('creates subagent entry on subagent_start', () => {
    emit(harness, {
      type: 'subagent_start',
      toolCallId: 's1',
      agentType: 'explore',
      task: 'Find usages of X',
      modelId: 'gpt-4o',
    });
    const sub = harness.getDisplayState().activeSubagents.get('s1');
    expect(sub).toBeDefined();
    expect(sub!.agentType).toBe('explore');
    expect(sub!.task).toBe('Find usages of X');
    expect(sub!.status).toBe('running');
    expect(sub!.toolCalls).toEqual([]);
  });

  it('appends text on subagent_text_delta', () => {
    emit(harness, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });
    emit(harness, { type: 'subagent_text_delta', toolCallId: 's1', agentType: 'explore', textDelta: 'hello ' });
    emit(harness, { type: 'subagent_text_delta', toolCallId: 's1', agentType: 'explore', textDelta: 'world' });
    expect(harness.getDisplayState().activeSubagents.get('s1')!.textDelta).toBe('hello world');
  });

  it('tracks subagent tool calls', () => {
    emit(harness, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });
    emit(harness, {
      type: 'subagent_tool_start',
      toolCallId: 's1',
      agentType: 'explore',
      subToolName: 'read_file',
      subToolArgs: {},
    });
    const sub = harness.getDisplayState().activeSubagents.get('s1')!;
    expect(sub.toolCalls).toHaveLength(1);
    expect(sub.toolCalls[0]!.name).toBe('read_file');
  });

  it('marks subagent tool error on subagent_tool_end', () => {
    emit(harness, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });
    emit(harness, {
      type: 'subagent_tool_start',
      toolCallId: 's1',
      agentType: 'explore',
      subToolName: 'read_file',
      subToolArgs: {},
    });
    emit(harness, {
      type: 'subagent_tool_end',
      toolCallId: 's1',
      agentType: 'explore',
      subToolName: 'read_file',
      subToolResult: 'err',
      isError: true,
    });
    const sub = harness.getDisplayState().activeSubagents.get('s1')!;
    expect(sub.toolCalls[0]!.isError).toBe(true);
  });

  it('marks subagent as completed on subagent_end', () => {
    emit(harness, { type: 'subagent_start', toolCallId: 's1', agentType: 'execute', task: 't', modelId: 'm' });
    emit(harness, {
      type: 'subagent_end',
      toolCallId: 's1',
      agentType: 'execute',
      result: 'done',
      isError: false,
      durationMs: 1234,
    });
    const sub = harness.getDisplayState().activeSubagents.get('s1')!;
    expect(sub.status).toBe('completed');
    expect(sub.durationMs).toBe(1234);
    expect(sub.result).toBe('done');
  });

  it('marks subagent as error on failed subagent_end', () => {
    emit(harness, { type: 'subagent_start', toolCallId: 's1', agentType: 'execute', task: 't', modelId: 'm' });
    emit(harness, {
      type: 'subagent_end',
      toolCallId: 's1',
      agentType: 'execute',
      result: 'failed',
      isError: true,
      durationMs: 500,
    });
    expect(harness.getDisplayState().activeSubagents.get('s1')!.status).toBe('error');
  });
});

// ===========================================================================
// Token usage tracking
// ===========================================================================

describe('usage_update', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('updates tokenUsage from internal token counters', () => {
    // Set internal token counters via the private field
    (harness as any).tokenUsage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
    emit(harness, { type: 'usage_update', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });

    const usage = harness.getDisplayState().tokenUsage;
    expect(usage.promptTokens).toBe(100);
    expect(usage.completionTokens).toBe(50);
    expect(usage.totalTokens).toBe(150);
  });

  it('accumulates usage across multiple updates', () => {
    (harness as any).tokenUsage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
    emit(harness, { type: 'usage_update', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });

    (harness as any).tokenUsage = { promptTokens: 250, completionTokens: 120, totalTokens: 370 };
    emit(harness, { type: 'usage_update', usage: { promptTokens: 250, completionTokens: 120, totalTokens: 370 } });

    const usage = harness.getDisplayState().tokenUsage;
    expect(usage.promptTokens).toBe(250);
    expect(usage.completionTokens).toBe(120);
    expect(usage.totalTokens).toBe(370);
  });
});

// ===========================================================================
// Task tracking
// ===========================================================================

describe('task_updated', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('updates tasks from event payload', () => {
    const tasks = [
      { content: 'Fix bug', status: 'in_progress' as const, activeForm: 'Fixing bug' },
      { content: 'Write tests', status: 'pending' as const, activeForm: 'Writing tests' },
    ];
    emit(harness, { type: 'task_updated', tasks });
    expect(harness.getDisplayState().tasks).toBe(tasks);
  });

  it('snapshots current tasks to previousTasks before update', () => {
    const tasks1 = [{ content: 'Task 1', status: 'pending' as const, activeForm: 'T1' }];
    const tasks2 = [
      { content: 'Task 1', status: 'completed' as const, activeForm: 'T1' },
      { content: 'Task 2', status: 'in_progress' as const, activeForm: 'T2' },
    ];

    emit(harness, { type: 'task_updated', tasks: tasks1 });
    expect(harness.getDisplayState().previousTasks).toEqual([]);

    emit(harness, { type: 'task_updated', tasks: tasks2 });
    expect(harness.getDisplayState().previousTasks).toEqual(tasks1);
    expect(harness.getDisplayState().tasks).toBe(tasks2);
  });
});

// ===========================================================================
// OM event → state transitions
// ===========================================================================

describe('OM event transitions', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  describe('om_status', () => {
    it('populates omProgress from window data', () => {
      emit(harness, {
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

      const omp = harness.getDisplayState().omProgress;
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
      emit(harness, {
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

      expect(harness.getDisplayState().bufferingMessages).toBe(true);
      expect(harness.getDisplayState().bufferingObservations).toBe(false);
    });

    it('sets bufferingObservations from buffered.reflection.status', () => {
      emit(harness, {
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

      expect(harness.getDisplayState().bufferingMessages).toBe(false);
      expect(harness.getDisplayState().bufferingObservations).toBe(true);
    });
  });

  describe('om_observation_start / end / failed', () => {
    it('sets status to observing on om_observation_start', () => {
      emit(harness, {
        type: 'om_observation_start',
        cycleId: 'c1',
        operationType: 'observation',
        tokensToObserve: 5000,
      });
      const omp = harness.getDisplayState().omProgress;
      expect(omp.status).toBe('observing');
      expect(omp.cycleId).toBe('c1');
      expect(omp.startTime).toBeDefined();
    });

    it('resets to idle and updates tokens on om_observation_end', () => {
      emit(harness, {
        type: 'om_observation_start',
        cycleId: 'c1',
        operationType: 'observation',
        tokensToObserve: 5000,
      });
      emit(harness, {
        type: 'om_observation_end',
        cycleId: 'c1',
        durationMs: 1000,
        tokensObserved: 5000,
        observationTokens: 6000,
      } as any);

      const omp = harness.getDisplayState().omProgress;
      expect(omp.status).toBe('idle');
      expect(omp.cycleId).toBeUndefined();
      expect(omp.startTime).toBeUndefined();
      expect(omp.observationTokens).toBe(6000);
      expect(omp.pendingTokens).toBe(0);
      expect(omp.thresholdPercent).toBe(0);
    });

    it('resets to idle on om_observation_failed', () => {
      emit(harness, {
        type: 'om_observation_start',
        cycleId: 'c1',
        operationType: 'observation',
        tokensToObserve: 5000,
      });
      emit(harness, { type: 'om_observation_failed', cycleId: 'c1', error: 'timeout', durationMs: 500 });

      const omp = harness.getDisplayState().omProgress;
      expect(omp.status).toBe('idle');
      expect(omp.cycleId).toBeUndefined();
    });
  });

  describe('om_reflection_start / end / failed', () => {
    it('sets status to reflecting and captures preReflectionTokens', () => {
      // First set some observation tokens via om_status
      emit(harness, {
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

      emit(harness, { type: 'om_reflection_start', cycleId: 'c1', tokensToReflect: 42000 });
      const omp = harness.getDisplayState().omProgress;
      expect(omp.status).toBe('reflecting');
      expect(omp.preReflectionTokens).toBe(10000); // captured from observationTokens before overwrite
      expect(omp.observationTokens).toBe(42000);
      expect(omp.reflectionThresholdPercent).toBe((42000 / 40000) * 100);
    });

    it('updates to compressed tokens on om_reflection_end', () => {
      emit(harness, { type: 'om_reflection_start', cycleId: 'c1', tokensToReflect: 42000 });
      emit(harness, { type: 'om_reflection_end', cycleId: 'c1', durationMs: 2000, compressedTokens: 15000 } as any);

      const omp = harness.getDisplayState().omProgress;
      expect(omp.status).toBe('idle');
      expect(omp.observationTokens).toBe(15000);
    });

    it('resets to idle on om_reflection_failed', () => {
      emit(harness, { type: 'om_reflection_start', cycleId: 'c1', tokensToReflect: 42000 });
      emit(harness, { type: 'om_reflection_failed', cycleId: 'c1', error: 'timeout', durationMs: 500 });

      expect(harness.getDisplayState().omProgress.status).toBe('idle');
    });
  });

  describe('om_buffering_start / end / failed / activation', () => {
    it('sets bufferingMessages on observation buffering start', () => {
      emit(harness, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'observation', tokensToBuffer: 1000 });
      expect(harness.getDisplayState().bufferingMessages).toBe(true);
      expect(harness.getDisplayState().bufferingObservations).toBe(false);
    });

    it('sets bufferingObservations on reflection buffering start', () => {
      emit(harness, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'reflection', tokensToBuffer: 1000 });
      expect(harness.getDisplayState().bufferingMessages).toBe(false);
      expect(harness.getDisplayState().bufferingObservations).toBe(true);
    });

    it('clears bufferingMessages on observation buffering end', () => {
      emit(harness, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'observation', tokensToBuffer: 1000 });
      emit(harness, {
        type: 'om_buffering_end',
        cycleId: 'c1',
        operationType: 'observation',
        tokensBuffered: 1000,
        bufferedTokens: 1000,
      } as any);
      expect(harness.getDisplayState().bufferingMessages).toBe(false);
    });

    it('clears bufferingObservations on reflection buffering end', () => {
      emit(harness, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'reflection', tokensToBuffer: 1000 });
      emit(harness, {
        type: 'om_buffering_end',
        cycleId: 'c1',
        operationType: 'reflection',
        tokensBuffered: 1000,
        bufferedTokens: 1000,
      } as any);
      expect(harness.getDisplayState().bufferingObservations).toBe(false);
    });

    it('clears buffering flag on observation buffering failed', () => {
      emit(harness, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'observation', tokensToBuffer: 1000 });
      emit(harness, { type: 'om_buffering_failed', cycleId: 'c1', operationType: 'observation', error: 'timeout' });
      expect(harness.getDisplayState().bufferingMessages).toBe(false);
    });

    it('clears buffering flag on reflection buffering failed', () => {
      emit(harness, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'reflection', tokensToBuffer: 1000 });
      emit(harness, { type: 'om_buffering_failed', cycleId: 'c1', operationType: 'reflection', error: 'timeout' });
      expect(harness.getDisplayState().bufferingObservations).toBe(false);
    });

    it('clears bufferingMessages on observation activation', () => {
      emit(harness, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'observation', tokensToBuffer: 1000 });
      emit(harness, {
        type: 'om_activation',
        cycleId: 'c1',
        operationType: 'observation',
        chunksActivated: 1,
        tokensActivated: 500,
        observationTokens: 800,
        messagesActivated: 5,
        generationCount: 1,
      });
      expect(harness.getDisplayState().bufferingMessages).toBe(false);
    });

    it('clears bufferingObservations on reflection activation', () => {
      emit(harness, { type: 'om_buffering_start', cycleId: 'c1', operationType: 'reflection', tokensToBuffer: 1000 });
      emit(harness, {
        type: 'om_activation',
        cycleId: 'c1',
        operationType: 'reflection',
        chunksActivated: 1,
        tokensActivated: 500,
        observationTokens: 800,
        messagesActivated: 5,
        generationCount: 1,
      });
      expect(harness.getDisplayState().bufferingObservations).toBe(false);
    });
  });
});

// ===========================================================================
// state_changed threshold syncing
// ===========================================================================

describe('state_changed threshold syncing', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('updates observation threshold from state_changed', () => {
    // Set some pending tokens first
    (harness as any).displayState.omProgress.pendingTokens = 15000;

    emit(harness, {
      type: 'state_changed',
      state: { observationThreshold: 20000 },
      changedKeys: ['observationThreshold'],
    });

    const omp = harness.getDisplayState().omProgress;
    expect(omp.threshold).toBe(20000);
    expect(omp.thresholdPercent).toBe(75); // 15000 / 20000 * 100
  });

  it('updates reflection threshold from state_changed', () => {
    (harness as any).displayState.omProgress.observationTokens = 20000;

    emit(harness, {
      type: 'state_changed',
      state: { reflectionThreshold: 50000 },
      changedKeys: ['reflectionThreshold'],
    });

    const omp = harness.getDisplayState().omProgress;
    expect(omp.reflectionThreshold).toBe(50000);
    expect(omp.reflectionThresholdPercent).toBe(40); // 20000 / 50000 * 100
  });

  it('ignores non-threshold keys in state_changed', () => {
    const beforeThreshold = harness.getDisplayState().omProgress.threshold;
    emit(harness, {
      type: 'state_changed',
      state: { yolo: true },
      changedKeys: ['yolo'],
    });
    expect(harness.getDisplayState().omProgress.threshold).toBe(beforeThreshold);
  });
});

// ===========================================================================
// Thread lifecycle (resetThreadDisplayState)
// ===========================================================================

describe('resetThreadDisplayState', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('resets all thread-scoped state on thread_created', () => {
    // Populate various state
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: {} });
    emit(harness, { type: 'tool_input_start', toolCallId: 't2', toolName: 'write_file' });
    emit(harness, { type: 'ask_question', questionId: 'q1', question: 'Q?', options: [] });
    emit(harness, { type: 'plan_approval_required', planId: 'p1', title: 'P', plan: '#' });
    emit(harness, { type: 'subagent_start', toolCallId: 's1', agentType: 'explore', task: 't', modelId: 'm' });
    emit(harness, { type: 'task_updated', tasks: [{ content: 'T', status: 'pending', activeForm: 'T' }] });
    emit(harness, { type: 'om_observation_start', cycleId: 'c1', operationType: 'observation', tokensToObserve: 5000 });
    emit(harness, { type: 'om_buffering_start', cycleId: 'c2', operationType: 'observation', tokensToBuffer: 1000 });

    // Now create new thread
    emit(harness, { type: 'thread_created', thread: { id: 'new', title: 'New' } } as any);

    const ds = harness.getDisplayState();
    expect(ds.activeTools.size).toBe(0);
    expect(ds.toolInputBuffers.size).toBe(0);
    expect(ds.pendingApproval).toBeNull();
    expect(ds.pendingQuestion).toBeNull();
    expect(ds.pendingPlanApproval).toBeNull();
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
    (harness as any).tokenUsage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
    emit(harness, { type: 'usage_update', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });
    expect(harness.getDisplayState().tokenUsage.totalTokens).toBe(150);

    emit(harness, { type: 'thread_created', thread: { id: 'new', title: 'New' } } as any);
    expect(harness.getDisplayState().tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('preserves isRunning across thread_created', () => {
    emit(harness, { type: 'agent_start' });
    expect(harness.getDisplayState().isRunning).toBe(true);

    emit(harness, { type: 'thread_created', thread: { id: 'new', title: 'New' } } as any);
    // isRunning is NOT reset by resetThreadDisplayState
    expect(harness.getDisplayState().isRunning).toBe(true);
  });

  it('resets omProgress on thread_changed', () => {
    emit(harness, { type: 'om_observation_start', cycleId: 'c1', operationType: 'observation', tokensToObserve: 5000 });
    expect(harness.getDisplayState().omProgress.status).toBe('observing');

    emit(harness, { type: 'thread_changed', threadId: 'other', previousThreadId: 'old' });
    expect(harness.getDisplayState().omProgress.status).toBe('idle');
    expect(harness.getDisplayState().omProgress.pendingTokens).toBe(0);
  });

  it('syncs tokenUsage from internal counters on thread_changed', () => {
    (harness as any).tokenUsage = { promptTokens: 200, completionTokens: 100, totalTokens: 300 };
    emit(harness, { type: 'thread_changed', threadId: 'other', previousThreadId: 'old' });
    expect(harness.getDisplayState().tokenUsage.totalTokens).toBe(300);
  });
});

// ===========================================================================
// display_state_changed emission
// ===========================================================================

describe('display_state_changed emission', () => {
  let harness: Harness;
  let events: HarnessEvent[];

  beforeEach(() => {
    harness = createHarness();
    events = [];
    harness.subscribe((event: HarnessEvent) => {
      events.push(event);
    });
  });

  it('emits display_state_changed after every non-display_state_changed event', () => {
    emit(harness, { type: 'agent_start' });
    expect(events.length).toBe(2);
    expect(events[0]!.type).toBe('agent_start');
    expect(events[1]!.type).toBe('display_state_changed');
  });

  it('includes current display state reference in display_state_changed', () => {
    emit(harness, { type: 'agent_start' });
    const dscEvent = events.find(e => e.type === 'display_state_changed');
    expect(dscEvent).toBeDefined();
    if (dscEvent?.type === 'display_state_changed') {
      expect(dscEvent.displayState).toBe(harness.getDisplayState());
    }
  });

  it('display state is already updated when display_state_changed fires', () => {
    emit(harness, { type: 'agent_start' });
    const dscEvent = events.find(e => e.type === 'display_state_changed');
    if (dscEvent?.type === 'display_state_changed') {
      expect(dscEvent.displayState.isRunning).toBe(true);
    }
  });

  it('does not emit display_state_changed for display_state_changed (no recursion)', () => {
    emit(harness, { type: 'display_state_changed', displayState: harness.getDisplayState() });
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('display_state_changed');
  });

  it('emits display_state_changed for each event in a sequence', () => {
    emit(harness, { type: 'agent_start' });
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'x' } });
    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });
    emit(harness, { type: 'agent_end', reason: 'complete' });

    const dscEvents = events.filter(e => e.type === 'display_state_changed');
    expect(dscEvents.length).toBe(4);
  });

  it('display_state_changed reflects state at time of each event', () => {
    const snapshots: boolean[] = [];
    harness.subscribe((event: HarnessEvent) => {
      if (event.type === 'display_state_changed') {
        snapshots.push(event.displayState.isRunning);
      }
    });

    emit(harness, { type: 'agent_start' });
    emit(harness, { type: 'agent_end', reason: 'complete' });

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
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('handles a complete agent run lifecycle', () => {
    const ds = harness.getDisplayState();

    // Agent starts
    emit(harness, { type: 'agent_start' });
    expect(ds.isRunning).toBe(true);

    // Message starts streaming
    const msg = { id: 'm1', role: 'assistant' as const, content: [], createdAt: new Date() };
    emit(harness, { type: 'message_start', message: msg as any });
    expect(ds.currentMessage).toBe(msg);

    // Tool input streaming
    emit(harness, { type: 'tool_input_start', toolCallId: 't1', toolName: 'string_replace_lsp' });
    expect(ds.activeTools.get('t1')?.status).toBe('streaming_input');
    expect(ds.toolInputBuffers.has('t1')).toBe(true);

    emit(harness, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '{"path":"foo.ts"' });
    emit(harness, { type: 'tool_input_delta', toolCallId: 't1', argsTextDelta: '}' });
    expect(ds.toolInputBuffers.get('t1')!.text).toBe('{"path":"foo.ts"}');

    emit(harness, { type: 'tool_input_end', toolCallId: 't1' });
    expect(ds.toolInputBuffers.has('t1')).toBe(false);

    // Tool runs
    emit(harness, { type: 'tool_start', toolCallId: 't1', toolName: 'string_replace_lsp', args: { path: 'foo.ts' } });
    expect(ds.activeTools.get('t1')?.status).toBe('running');

    emit(harness, { type: 'tool_end', toolCallId: 't1', result: 'ok', isError: false });
    expect(ds.activeTools.get('t1')?.status).toBe('completed');
    expect(ds.modifiedFiles.has('foo.ts')).toBe(true);

    // Task update
    emit(harness, {
      type: 'task_updated',
      tasks: [{ content: 'Edit foo', status: 'completed', activeForm: 'Editing' }],
    });
    expect(ds.tasks).toHaveLength(1);

    // Usage update
    (harness as any).tokenUsage = { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 };
    emit(harness, { type: 'usage_update', usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 } });
    expect(ds.tokenUsage.totalTokens).toBe(1500);

    // Agent ends
    emit(harness, { type: 'agent_end', reason: 'complete' });
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
