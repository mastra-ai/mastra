import { describe, it, expect, vi } from 'vitest';

import { Workspace } from '../../workspace';
import { executeCommandTool, executeCommandWithBackgroundTool } from '../execute-command';
import { getProcessOutputTool } from '../get-process-output';
import { killProcessTool } from '../kill-process';
import { applyTail, applyCharLimit, truncateOutput, MAX_OUTPUT_CHARS, DEFAULT_TAIL_LINES } from '../output-helpers';

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

/** Create a mock ProcessHandle with controllable state. */
function createMockHandle(opts: {
  pid: number;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  waitResult?: { exitCode: number; success: boolean; stdout: string; stderr: string };
}) {
  const handle = {
    pid: opts.pid,
    stdout: opts.stdout ?? '',
    stderr: opts.stderr ?? '',
    exitCode: opts.exitCode,
    wait: vi.fn().mockResolvedValue(
      opts.waitResult ?? {
        exitCode: opts.exitCode ?? 0,
        success: (opts.exitCode ?? 0) === 0,
        stdout: opts.stdout ?? '',
        stderr: opts.stderr ?? '',
        executionTimeMs: 10,
      },
    ),
    kill: vi.fn().mockResolvedValue(opts.exitCode === undefined),
    sendStdin: vi.fn().mockResolvedValue(undefined),
    emitStdout: vi.fn(),
    emitStderr: vi.fn(),
    reader: {} as any,
    writer: {} as any,
  };
  return handle;
}

/** Create a mock sandbox with executeCommand + processes. */
function createMockSandbox(
  overrides: {
    executeCommand?: (...args: any[]) => Promise<any>;
    processes?: {
      spawn?: (...args: any[]) => Promise<any>;
      get?: (pid: number) => Promise<any>;
      kill?: (pid: number) => Promise<boolean>;
      list?: () => Promise<any[]>;
    };
  } = {},
) {
  const sandbox: any = {
    id: 'test-sandbox',
    name: 'Test Sandbox',
    provider: 'test',
    status: 'running',
    getInfo: vi.fn().mockResolvedValue({
      id: 'test-sandbox',
      name: 'Test Sandbox',
      provider: 'test',
      status: 'running',
      createdAt: new Date(),
    }),
    executeCommand: overrides.executeCommand ?? vi.fn(),
  };

  if (overrides.processes) {
    sandbox.processes = {
      spawn: overrides.processes.spawn ?? vi.fn(),
      get: overrides.processes.get ?? vi.fn().mockResolvedValue(undefined),
      kill: overrides.processes.kill ?? vi.fn().mockResolvedValue(false),
      list: overrides.processes.list ?? vi.fn().mockResolvedValue([]),
    };
  }

  return sandbox;
}

/** Create a tool execution context with the given sandbox. */
function createContext(sandbox: any) {
  const workspace = new Workspace({ sandbox });
  return { workspace };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('execute_command tool', () => {
  describe('foreground mode', () => {
    it('returns stdout on success', async () => {
      const sandbox = createMockSandbox({
        executeCommand: vi.fn().mockResolvedValue({
          success: true,
          exitCode: 0,
          stdout: 'hello world\n',
          stderr: '',
          executionTimeMs: 5,
        }),
      });
      const ctx = createContext(sandbox);
      const result = await executeCommandTool.execute({ command: 'echo', args: ['hello', 'world'], tail: null }, ctx);
      expect(result).toBe('hello world\n');
    });

    it('returns "(no output)" for empty stdout on success', async () => {
      const sandbox = createMockSandbox({
        executeCommand: vi.fn().mockResolvedValue({
          success: true,
          exitCode: 0,
          stdout: '',
          stderr: '',
          executionTimeMs: 5,
        }),
      });
      const ctx = createContext(sandbox);
      const result = await executeCommandTool.execute({ command: 'true', args: [], tail: null }, ctx);
      expect(result).toBe('(no output)');
    });

    it('returns stdout + stderr + exit code on failure', async () => {
      const sandbox = createMockSandbox({
        executeCommand: vi.fn().mockResolvedValue({
          success: false,
          exitCode: 1,
          stdout: 'partial output\n',
          stderr: 'some error\n',
          executionTimeMs: 5,
        }),
      });
      const ctx = createContext(sandbox);
      const result = await executeCommandTool.execute({ command: 'false', args: [], tail: null }, ctx);
      expect(result).toContain('partial output');
      expect(result).toContain('some error');
      expect(result).toContain('Exit code: 1');
    });

    it('returns error message when executeCommand throws', async () => {
      const sandbox = createMockSandbox({
        executeCommand: vi.fn().mockRejectedValue(new Error('Command timed out')),
      });
      const ctx = createContext(sandbox);
      const result = await executeCommandTool.execute({ command: 'sleep', args: ['999'], tail: null }, ctx);
      expect(result).toContain('Error: Command timed out');
    });

    describe('tail param', () => {
      const longOutput = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`).join('\n');

      it('defaults to 200 lines when tail is not specified', async () => {
        const sandbox = createMockSandbox({
          executeCommand: vi.fn().mockResolvedValue({
            success: true,
            exitCode: 0,
            stdout: longOutput,
            stderr: '',
            executionTimeMs: 5,
          }),
        });
        const ctx = createContext(sandbox);
        const result = await executeCommandTool.execute({ command: 'seq', args: ['500'] }, ctx);
        const lines = (result as string).split('\n');
        expect(lines.length).toBe(200);
        expect(lines[0]).toBe('line 301');
        expect(lines[199]).toBe('line 500');
      });

      it('tail: 10 returns last 10 lines', async () => {
        const sandbox = createMockSandbox({
          executeCommand: vi.fn().mockResolvedValue({
            success: true,
            exitCode: 0,
            stdout: longOutput,
            stderr: '',
            executionTimeMs: 5,
          }),
        });
        const ctx = createContext(sandbox);
        const result = await executeCommandTool.execute({ command: 'seq', args: ['500'], tail: 10 }, ctx);
        const lines = (result as string).split('\n');
        expect(lines.length).toBe(10);
        expect(lines[0]).toBe('line 491');
        expect(lines[9]).toBe('line 500');
      });

      it('tail: 0 returns all lines (no limit)', async () => {
        const sandbox = createMockSandbox({
          executeCommand: vi.fn().mockResolvedValue({
            success: true,
            exitCode: 0,
            stdout: longOutput,
            stderr: '',
            executionTimeMs: 5,
          }),
        });
        const ctx = createContext(sandbox);
        const result = await executeCommandTool.execute({ command: 'seq', args: ['500'], tail: 0 }, ctx);
        const lines = (result as string).split('\n');
        expect(lines.length).toBe(500);
      });

      it('tail applies to both stdout and stderr on failure', async () => {
        const longStderr = Array.from({ length: 50 }, (_, i) => `err ${i + 1}`).join('\n');
        const sandbox = createMockSandbox({
          executeCommand: vi.fn().mockResolvedValue({
            success: false,
            exitCode: 1,
            stdout: longOutput,
            stderr: longStderr,
            executionTimeMs: 5,
          }),
        });
        const ctx = createContext(sandbox);
        const result = await executeCommandTool.execute({ command: 'fail', args: [], tail: 5 }, ctx);
        // stdout should be last 5 lines
        expect(result).toContain('line 496');
        expect(result).toContain('line 500');
        // stderr should be last 5 lines
        expect(result).toContain('err 46');
        expect(result).toContain('err 50');
        expect(result).toContain('Exit code: 1');
      });
    });
  });

  describe('background mode', () => {
    it('returns PID when background: true', async () => {
      const handle = createMockHandle({ pid: 42 });
      const sandbox = createMockSandbox({
        processes: {
          spawn: vi.fn().mockResolvedValue(handle),
        },
      });
      const ctx = createContext(sandbox);
      const result = await executeCommandWithBackgroundTool.execute(
        { command: 'node', args: ['server.js'], background: true },
        ctx,
      );
      expect(result).toBe('PID: 42');
    });

    it('runs foreground when background is not set', async () => {
      const sandbox = createMockSandbox({
        executeCommand: vi.fn().mockResolvedValue({
          success: true,
          exitCode: 0,
          stdout: 'foreground result\n',
          stderr: '',
          executionTimeMs: 5,
        }),
        processes: {
          spawn: vi.fn(),
        },
      });
      const ctx = createContext(sandbox);
      const result = await executeCommandWithBackgroundTool.execute({ command: 'echo', args: ['hi'] }, ctx);
      expect(result).toBe('foreground result\n');
      expect(sandbox.processes.spawn).not.toHaveBeenCalled();
    });
  });
});

describe('get_process_output tool', () => {
  it('returns output for a running process', async () => {
    const handle = createMockHandle({
      pid: 10,
      stdout: 'server started on port 3000\n',
      stderr: '',
      exitCode: undefined,
    });
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(handle),
      },
    });
    const ctx = createContext(sandbox);
    const result = await getProcessOutputTool.execute({ pid: 10 }, ctx);
    expect(result).toContain('PID: 10');
    expect(result).toContain('Status: running');
    expect(result).toContain('server started on port 3000');
  });

  it('returns "no output yet" for a running process with no output', async () => {
    const handle = createMockHandle({
      pid: 11,
      stdout: '',
      stderr: '',
      exitCode: undefined,
    });
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(handle),
      },
    });
    const ctx = createContext(sandbox);
    const result = await getProcessOutputTool.execute({ pid: 11 }, ctx);
    expect(result).toContain('Status: running');
    expect(result).toContain('(no output yet)');
  });

  it('returns not found for unknown PID', async () => {
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(undefined),
      },
    });
    const ctx = createContext(sandbox);
    const result = await getProcessOutputTool.execute({ pid: 99999 }, ctx);
    expect(result).toContain('No background process found with PID 99999');
  });

  it('skips output for already-exited process (no wait)', async () => {
    const handle = createMockHandle({
      pid: 12,
      stdout: 'lots of output here\n',
      stderr: '',
      exitCode: 0,
    });
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(handle),
      },
    });
    const ctx = createContext(sandbox);
    const result = await getProcessOutputTool.execute({ pid: 12 }, ctx);
    expect(result).toContain('Status: exited (code 0)');
    // Should NOT include stdout since process already exited and wait was not requested
    expect(result).not.toContain('lots of output here');
  });

  describe('tail param', () => {
    it('returns last N lines of stdout', async () => {
      const longStdout = Array.from({ length: 500 }, (_, i) => `log ${i + 1}`).join('\n');
      const handle = createMockHandle({
        pid: 13,
        stdout: longStdout,
        stderr: '',
        exitCode: undefined,
      });
      const sandbox = createMockSandbox({
        processes: {
          get: vi.fn().mockResolvedValue(handle),
        },
      });
      const ctx = createContext(sandbox);
      const result = await getProcessOutputTool.execute({ pid: 13, tail: 5 }, ctx);
      expect(result).toContain('log 496');
      expect(result).toContain('log 500');
      expect(result).not.toContain('log 1\n');
    });

    it('tail: 0 returns all output', async () => {
      const longStdout = Array.from({ length: 500 }, (_, i) => `log ${i + 1}`).join('\n');
      const handle = createMockHandle({
        pid: 14,
        stdout: longStdout,
        stderr: '',
        exitCode: undefined,
      });
      const sandbox = createMockSandbox({
        processes: {
          get: vi.fn().mockResolvedValue(handle),
        },
      });
      const ctx = createContext(sandbox);
      const result = await getProcessOutputTool.execute({ pid: 14, tail: 0 }, ctx);
      expect(result).toContain('log 1\n');
      expect(result).toContain('log 500');
    });
  });

  describe('wait param', () => {
    it('blocks until process exits when wait: true', async () => {
      const handle = createMockHandle({
        pid: 15,
        stdout: 'final output\n',
        stderr: '',
        exitCode: undefined,
      });
      // Simulate wait resolving
      handle.wait.mockImplementation(async () => {
        // After wait resolves, exitCode gets set
        (handle as any).exitCode = 0;
        return { exitCode: 0, success: true, stdout: 'final output\n', stderr: '', executionTimeMs: 100 };
      });
      const sandbox = createMockSandbox({
        processes: {
          get: vi.fn().mockResolvedValue(handle),
        },
      });
      const ctx = createContext(sandbox);
      const result = await getProcessOutputTool.execute({ pid: 15, wait: true }, ctx);
      expect(handle.wait).toHaveBeenCalled();
      expect(result).toContain('final output');
    });

    it('returns output for exited process when wait: true', async () => {
      const handle = createMockHandle({
        pid: 16,
        stdout: 'build complete\nDone in 2.3s\n',
        stderr: '',
        exitCode: 0,
      });
      const sandbox = createMockSandbox({
        processes: {
          get: vi.fn().mockResolvedValue(handle),
        },
      });
      const ctx = createContext(sandbox);
      const result = await getProcessOutputTool.execute({ pid: 16, wait: true }, ctx);
      // wait: true should bypass the "skip output for exited" guard
      expect(result).toContain('build complete');
      expect(result).toContain('Done in 2.3s');
    });
  });
});

describe('kill_process tool', () => {
  it('kills a running process and returns last output', async () => {
    const stdout = Array.from({ length: 100 }, (_, i) => `server log ${i + 1}`).join('\n');
    const handle = createMockHandle({
      pid: 20,
      stdout,
      stderr: 'warn: something\n',
      exitCode: undefined,
    });
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(handle),
        kill: vi.fn().mockResolvedValue(true),
      },
    });
    const ctx = createContext(sandbox);
    const result = await killProcessTool.execute({ pid: 20 }, ctx);
    expect(result).toContain('Process 20 has been killed');
    // Should include last 50 lines of stdout
    expect(result).toContain('server log 51');
    expect(result).toContain('server log 100');
    // Should NOT include early lines
    expect(result).not.toContain('server log 1\n');
    // Should include stderr
    expect(result).toContain('warn: something');
  });

  it('returns not found for unknown PID', async () => {
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(undefined),
        kill: vi.fn().mockResolvedValue(false),
      },
    });
    const ctx = createContext(sandbox);
    const result = await killProcessTool.execute({ pid: 99999 }, ctx);
    expect(result).toContain('was not found or had already exited');
  });

  it('returns not found when process already exited', async () => {
    const handle = createMockHandle({
      pid: 21,
      stdout: 'done\n',
      stderr: '',
      exitCode: 0,
    });
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(handle),
        kill: vi.fn().mockResolvedValue(false),
      },
    });
    const ctx = createContext(sandbox);
    const result = await killProcessTool.execute({ pid: 21 }, ctx);
    expect(result).toContain('was not found or had already exited');
  });

  it('returns kill message with no output when process had none', async () => {
    const handle = createMockHandle({
      pid: 22,
      stdout: '',
      stderr: '',
      exitCode: undefined,
    });
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(handle),
        kill: vi.fn().mockResolvedValue(true),
      },
    });
    const ctx = createContext(sandbox);
    const result = await killProcessTool.execute({ pid: 22 }, ctx);
    expect(result).toBe('Process 22 has been killed.');
    expect(result).not.toContain('stdout');
    expect(result).not.toContain('stderr');
  });
});

// ---------------------------------------------------------------------------
// Output Helpers (unit tests)
// ---------------------------------------------------------------------------

describe('output-helpers', () => {
  describe('applyTail', () => {
    it('returns empty string for empty input', () => {
      expect(applyTail('', 10)).toBe('');
    });

    it('returns all lines when count exceeds total', () => {
      expect(applyTail('a\nb\nc', 10)).toBe('a\nb\nc');
    });

    it('returns last N lines', () => {
      const input = 'a\nb\nc\nd\ne';
      expect(applyTail(input, 2)).toBe('d\ne');
    });

    it('uses DEFAULT_TAIL_LINES when tail is undefined', () => {
      const lines = Array.from({ length: 300 }, (_, i) => `${i}`).join('\n');
      const result = applyTail(lines, undefined);
      expect(result.split('\n').length).toBe(DEFAULT_TAIL_LINES);
    });

    it('uses DEFAULT_TAIL_LINES when tail is null', () => {
      const lines = Array.from({ length: 300 }, (_, i) => `${i}`).join('\n');
      const result = applyTail(lines, null);
      expect(result.split('\n').length).toBe(DEFAULT_TAIL_LINES);
    });

    it('returns all lines when tail is 0 (no limit)', () => {
      const lines = Array.from({ length: 500 }, (_, i) => `${i}`).join('\n');
      const result = applyTail(lines, 0);
      expect(result.split('\n').length).toBe(500);
    });

    it('handles negative tail by taking absolute value', () => {
      const input = 'a\nb\nc\nd\ne';
      expect(applyTail(input, -2)).toBe('d\ne');
    });

    it('does not count trailing newline as an extra line', () => {
      // "a\nb\nc\n" should be treated as 3 lines, not 4
      const input = 'a\nb\nc\nd\ne\n';
      const result = applyTail(input, 2);
      expect(result).toBe('d\ne\n');
    });

    it('preserves trailing newline after truncation', () => {
      const input = 'line1\nline2\nline3\n';
      const result = applyTail(input, 1);
      expect(result).toBe('line3\n');
    });

    it('works correctly without trailing newline', () => {
      const input = 'line1\nline2\nline3';
      const result = applyTail(input, 1);
      expect(result).toBe('line3');
    });
  });

  describe('applyCharLimit', () => {
    it('returns output unchanged when under limit', () => {
      expect(applyCharLimit('short', 100)).toBe('short');
    });

    it('returns output unchanged when exactly at limit', () => {
      const output = 'x'.repeat(100);
      expect(applyCharLimit(output, 100)).toBe(output);
    });

    it('truncates from the start and adds notice', () => {
      const output = 'a'.repeat(50);
      const result = applyCharLimit(output, 20);
      expect(result).toContain('[output truncated: showing last 20 of 50 characters]');
      // The actual content should be the last 20 chars
      expect(result).toContain('a'.repeat(20));
    });

    it('returns empty string for empty input', () => {
      expect(applyCharLimit('', 100)).toBe('');
    });

    it('uses MAX_OUTPUT_CHARS as default limit', () => {
      // Just under the limit — should pass through
      const justUnder = 'x'.repeat(MAX_OUTPUT_CHARS);
      expect(applyCharLimit(justUnder)).toBe(justUnder);

      // Just over — should truncate
      const justOver = 'x'.repeat(MAX_OUTPUT_CHARS + 1);
      const result = applyCharLimit(justOver);
      expect(result).toContain('[output truncated');
    });
  });

  describe('truncateOutput', () => {
    it('applies tail then char limit', () => {
      // 500 lines of 100 chars each = 50,000+ chars
      const lines = Array.from({ length: 500 }, (_, i) => `line-${String(i).padStart(3, '0')}-${'x'.repeat(90)}`);
      const output = lines.join('\n');

      // tail: 0 (no line limit) but char limit should kick in
      const result = truncateOutput(output, 0);
      expect(result).toContain('[output truncated');
      expect(result.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS + 200); // notice adds some overhead
    });

    it('tail reduces output enough to skip char limit', () => {
      // 500 lines, but tail: 5 will reduce to ~500 chars — well under 30k
      const lines = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`);
      const output = lines.join('\n');

      const result = truncateOutput(output, 5);
      expect(result).not.toContain('[output truncated');
      expect(result.split('\n').length).toBe(5);
    });
  });
});

describe('char limit integration', () => {
  it('execute_command truncates huge foreground output', async () => {
    const hugeOutput = 'x'.repeat(50_000);
    const sandbox = createMockSandbox({
      executeCommand: vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: hugeOutput,
        stderr: '',
        executionTimeMs: 5,
      }),
    });
    const ctx = createContext(sandbox);
    const result = await executeCommandTool.execute({ command: 'cat', args: ['big.bin'], tail: 0 }, ctx);
    expect(result).toContain('[output truncated');
    // Result should be bounded
    expect((result as string).length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS + 200);
  });

  it('get_process_output truncates huge stdout', async () => {
    const hugeStdout = 'y'.repeat(50_000);
    const handle = createMockHandle({
      pid: 30,
      stdout: hugeStdout,
      stderr: '',
      exitCode: undefined,
    });
    const sandbox = createMockSandbox({
      processes: {
        get: vi.fn().mockResolvedValue(handle),
      },
    });
    const ctx = createContext(sandbox);
    const result = await getProcessOutputTool.execute({ pid: 30, tail: 0 }, ctx);
    expect(result).toContain('[output truncated');
  });
});
