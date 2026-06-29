import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runHooksForEvent: vi.fn(),
  loadHooksConfig: vi.fn(),
}));

vi.mock('./executor.js', () => ({
  runHooksForEvent: mocks.runHooksForEvent,
}));

vi.mock('./config.js', () => ({
  loadHooksConfig: mocks.loadHooksConfig,
  getProjectHooksPath: vi.fn(),
  getGlobalHooksPath: vi.fn(),
}));

import { HookManager } from './manager.js';

function createHookResult(overrides: Record<string, unknown> = {}) {
  return {
    allowed: true,
    results: [],
    warnings: [],
    ...overrides,
  };
}

function createManager(hooksConfig: Record<string, unknown> = {}) {
  mocks.loadHooksConfig.mockReturnValue(hooksConfig);
  mocks.runHooksForEvent.mockResolvedValue(createHookResult());
  return new HookManager('/project', 'session-1');
}

describe('HookManager run_id propagation', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mockFn => mockFn.mockReset());
  });

  it('includes run_id in PreToolUse stdin when a run is active', async () => {
    const mgr = createManager({
      PreToolUse: [{ type: 'command', command: 'echo test' }],
    });
    mgr.setRunId('run-uuid-1');

    await mgr.runPreToolUse('execute_command', { command: 'ls' });

    const stdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(stdin.run_id).toBe('run-uuid-1');
    expect(stdin.hook_event_name).toBe('PreToolUse');
    expect(stdin.tool_name).toBe('execute_command');
  });

  it('includes run_id in PostToolUse stdin when a run is active', async () => {
    const mgr = createManager({
      PostToolUse: [{ type: 'command', command: 'echo test' }],
    });
    mgr.setRunId('run-uuid-2');

    await mgr.runPostToolUse('write_file', { path: 'x' }, undefined, false);

    const stdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(stdin.run_id).toBe('run-uuid-2');
    expect(stdin.hook_event_name).toBe('PostToolUse');
  });

  it('includes run_id in Stop stdin when a run is active', async () => {
    const mgr = createManager({
      Stop: [{ type: 'command', command: 'echo test' }],
    });
    mgr.setRunId('run-uuid-3');

    await mgr.runStop(undefined, 'complete');

    const stdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(stdin.run_id).toBe('run-uuid-3');
    expect(stdin.hook_event_name).toBe('Stop');
    expect(stdin.stop_reason).toBe('complete');
  });

  it('omits run_id from stdin when no run is active', async () => {
    const mgr = createManager({
      PreToolUse: [{ type: 'command', command: 'echo test' }],
    });

    await mgr.runPreToolUse('execute_command', { command: 'ls' });

    const stdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(stdin.run_id).toBeUndefined();
  });

  it('clears run_id so subsequent hooks no longer carry it', async () => {
    const mgr = createManager({
      Stop: [{ type: 'command', command: 'echo test' }],
    });
    mgr.setRunId('run-uuid-4');
    mgr.clearRunId();

    await mgr.runStop(undefined, 'complete');

    const stdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(stdin.run_id).toBeUndefined();
  });

  it('returns empty result and skips executor when no hooks configured for AgentStart', async () => {
    const mgr = createManager();
    mgr.setRunId('run-uuid-5');

    const result = await mgr.runAgentStart();

    expect(result.allowed).toBe(true);
    expect(mocks.runHooksForEvent).not.toHaveBeenCalled();
  });

  it('returns empty result when AgentStart has hooks but no run_id set', async () => {
    const mgr = createManager({
      AgentStart: [{ type: 'command', command: 'echo test' }],
    });

    const result = await mgr.runAgentStart();

    expect(result.allowed).toBe(true);
    expect(mocks.runHooksForEvent).not.toHaveBeenCalled();
  });

  it('fires AgentStart with run_id when hooks and run_id are both present', async () => {
    const mgr = createManager({
      AgentStart: [{ type: 'command', command: 'echo test' }],
    });
    mgr.setRunId('run-uuid-6');

    await mgr.runAgentStart();

    const stdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(stdin.run_id).toBe('run-uuid-6');
    expect(stdin.hook_event_name).toBe('AgentStart');
  });

  it('fires PermissionRequest with tool context and run_id', async () => {
    const mgr = createManager({
      PermissionRequest: [{ type: 'command', command: 'echo test' }],
    });
    mgr.setRunId('run-uuid-7');

    await mgr.runPermissionRequest('tool_approval', 'call-1', 'execute_command', { command: 'rm -rf /' });

    const stdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(stdin.run_id).toBe('run-uuid-7');
    expect(stdin.hook_event_name).toBe('PermissionRequest');
    expect(stdin.permission_kind).toBe('tool_approval');
    expect(stdin.tool_call_id).toBe('call-1');
    expect(stdin.tool_name).toBe('execute_command');
    expect(stdin.tool_input).toEqual({ command: 'rm -rf /' });
  });

  it('fires Interrupt with reason', async () => {
    const mgr = createManager({
      Interrupt: [{ type: 'command', command: 'echo test' }],
    });
    mgr.setRunId('run-uuid-8');

    await mgr.runInterrupt('user_interrupt');

    const stdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(stdin.hook_event_name).toBe('Interrupt');
    expect(stdin.reason).toBe('user_interrupt');
    expect(stdin.run_id).toBe('run-uuid-8');
  });

  it('fires SubagentStart and SubagentEnd with delegation context', async () => {
    const mgr = createManager({
      SubagentStart: [{ type: 'command', command: 'echo test' }],
      SubagentEnd: [{ type: 'command', command: 'echo test' }],
    });
    mgr.setRunId('run-uuid-9');

    await mgr.runSubagentStart('call-2', 'execute', 'run tests', 'gpt-4o', true);
    await mgr.runSubagentEnd('call-2', 'execute', 'done', false, 500);

    const startStdin = mocks.runHooksForEvent.mock.calls[0][1];
    expect(startStdin.hook_event_name).toBe('SubagentStart');
    expect(startStdin.run_id).toBe('run-uuid-9');
    expect(startStdin.agent_type).toBe('execute');
    expect(startStdin.task).toBe('run tests');
    expect(startStdin.model_id).toBe('gpt-4o');
    expect(startStdin.forked).toBe(true);

    const endStdin = mocks.runHooksForEvent.mock.calls[1][1];
    expect(endStdin.hook_event_name).toBe('SubagentEnd');
    expect(endStdin.run_id).toBe('run-uuid-9');
    expect(endStdin.agent_type).toBe('execute');
    expect(endStdin.result).toBe('done');
    expect(endStdin.is_error).toBe(false);
    expect(endStdin.duration_ms).toBe(500);
  });
});
