import { describe, expect, it } from 'vitest';
import type { SignalData } from '../messages/signal-data';
import { processExitNotice, taskNotice } from './background-notices';

const exitSignal = (
  attributes: SignalData['attributes'],
  contents = 'Background process 42 exited with code 1: npm test',
): SignalData => ({
  type: 'notification',
  tagName: 'background-process',
  contents,
  attributes,
});

describe('processExitNotice', () => {
  it.each([
    [
      'a numeric exit code',
      { pid: '42', exitCode: 1, toolCallId: 'call-1' },
      { pid: '42', exitCode: 1, toolCallId: 'call-1' },
    ],
    [
      'an exit code that crossed storage as text',
      { pid: 42, exitCode: '-1' },
      { pid: '42', exitCode: -1, toolCallId: undefined },
    ],
  ])('reads a notice with %s', (_, attributes, expected) => {
    expect(processExitNotice(exitSignal(attributes))).toEqual({ ...expected, command: 'npm test' });
  });

  it('reads the command from a multi-line notice that wraps it in other text', () => {
    const contents =
      'Background process 42 exited with code 0: cd app && make all\n\nok\n\nRead the full output with x.';
    expect(processExitNotice(exitSignal({ pid: '42', exitCode: 0 }, contents))?.command).toBe('cd app && make all');
  });

  it.each([
    ['no PID', { exitCode: 1 }],
    ['no exit code', { pid: '42' }],
    ['a fractional exit code', { pid: '42', exitCode: 1.5 }],
  ])('ignores a notice with %s', (_, attributes) => {
    expect(processExitNotice(exitSignal(attributes))).toBeUndefined();
  });

  it('ignores other notifications', () => {
    expect(processExitNotice({ ...exitSignal({ pid: '42', exitCode: 1 }), tagName: 'deploy' })).toBeUndefined();
    expect(processExitNotice({ ...exitSignal({ pid: '42', exitCode: 1 }), type: 'reactive' })).toBeUndefined();
  });
});

describe('taskNotice', () => {
  it('reads the task, its status and its call', () => {
    const signal: SignalData = {
      type: 'notification',
      tagName: 'background-task',
      attributes: { taskId: 'bg-1', toolCallId: 'call-1', toolName: 'report', status: 'failed' },
    };
    expect(taskNotice(signal)).toEqual({ taskId: 'bg-1', toolCallId: 'call-1', toolName: 'report', status: 'failed' });
  });

  it('ignores a notice with no status', () => {
    expect(
      taskNotice({ type: 'notification', tagName: 'background-task', attributes: { taskId: 'bg-1' } }),
    ).toBeUndefined();
  });
});
