import { describe, it, expect, vi } from 'vitest';

import type { ToolExecutionContext } from '../../../tools/types';
import type { CommandResult, ExecuteCommandOptions } from '../../sandbox/types';
import { Workspace } from '../../workspace';
import { executeCommandTool } from '../execute-command';

/**
 * Creates a mock workspace with a fake sandbox whose `executeCommand` can be controlled per-test.
 */
function createMockContext(options: {
  executeCommand: (command: string, args: string[], opts?: ExecuteCommandOptions) => Promise<CommandResult>;
  toolCallId?: string;
}) {
  const writerCustom = vi.fn();

  const sandbox = {
    id: 'test-sandbox',
    name: 'test-sandbox',
    provider: 'test',
    status: 'running' as const,
    executeCommand: options.executeCommand,
  };

  const workspace = new Workspace({ sandbox });

  const context: ToolExecutionContext = {
    workspace,
    writer: { custom: writerCustom } as any,
    agent: options.toolCallId ? ({ toolCallId: options.toolCallId } as any) : undefined,
  };

  return { context, writerCustom, sandbox };
}

/**
 * Filter writer.custom calls by type prefix.
 */
function getChunks(writerCustom: ReturnType<typeof vi.fn>, type: string) {
  return writerCustom.mock.calls.filter(call => call[0]?.type === type).map(call => call[0]);
}

// executeCommandTool.execute is always defined, but createTool types it as optional
const execute = executeCommandTool.execute!;

describe('executeCommandTool data chunks', () => {
  describe('workspace metadata emission', () => {
    it('emits workspace-metadata before any stdout/stderr', async () => {
      const { context, writerCustom } = createMockContext({
        executeCommand: async (_cmd, _args, opts) => {
          opts?.onStdout?.('output\n');
          return { success: true, exitCode: 0, stdout: 'output\n', stderr: '', executionTimeMs: 10 };
        },
      });

      await execute({ command: 'echo', args: ['hi'], timeout: null, cwd: null }, context);

      const allCalls = writerCustom.mock.calls.map(call => call[0]?.type);
      const metadataIdx = allCalls.indexOf('data-workspace-metadata');
      const stdoutIdx = allCalls.indexOf('data-sandbox-stdout');

      expect(metadataIdx).toBeGreaterThanOrEqual(0);
      expect(stdoutIdx).toBeGreaterThanOrEqual(0);
      expect(metadataIdx).toBeLessThan(stdoutIdx);
    });
  });

  describe('toolCallId in chunks', () => {
    it('includes toolCallId in stdout chunks', async () => {
      const { context, writerCustom } = createMockContext({
        toolCallId: 'call-abc',
        executeCommand: async (_cmd, _args, opts) => {
          opts?.onStdout?.('line 1\n');
          opts?.onStdout?.('line 2\n');
          return { success: true, exitCode: 0, stdout: 'line 1\nline 2\n', stderr: '', executionTimeMs: 10 };
        },
      });

      await execute({ command: 'echo', args: [], timeout: null, cwd: null }, context);

      const stdoutChunks = getChunks(writerCustom, 'data-sandbox-stdout');
      expect(stdoutChunks).toHaveLength(2);
      for (const chunk of stdoutChunks) {
        expect(chunk.data.toolCallId).toBe('call-abc');
      }
    });

    it('includes toolCallId in stderr chunks', async () => {
      const { context, writerCustom } = createMockContext({
        toolCallId: 'call-def',
        executeCommand: async (_cmd, _args, opts) => {
          opts?.onStderr?.('warn: something\n');
          return { success: true, exitCode: 0, stdout: '', stderr: 'warn: something\n', executionTimeMs: 5 };
        },
      });

      await execute({ command: 'test', args: [], timeout: null, cwd: null }, context);

      const stderrChunks = getChunks(writerCustom, 'data-sandbox-stderr');
      expect(stderrChunks).toHaveLength(1);
      expect(stderrChunks[0].data.toolCallId).toBe('call-def');
    });

    it('includes toolCallId in exit chunk on success', async () => {
      const { context, writerCustom } = createMockContext({
        toolCallId: 'call-ghi',
        executeCommand: async () => {
          return { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 50 };
        },
      });

      await execute({ command: 'true', args: [], timeout: null, cwd: null }, context);

      const exitChunks = getChunks(writerCustom, 'data-sandbox-exit');
      expect(exitChunks).toHaveLength(1);
      expect(exitChunks[0].data.toolCallId).toBe('call-ghi');
    });

    it('includes toolCallId in exit chunk on thrown error', async () => {
      const { context, writerCustom } = createMockContext({
        toolCallId: 'call-jkl',
        executeCommand: async () => {
          throw new Error('timeout');
        },
      });

      await execute({ command: 'sleep', args: ['999'], timeout: null, cwd: null }, context);

      const exitChunks = getChunks(writerCustom, 'data-sandbox-exit');
      expect(exitChunks).toHaveLength(1);
      expect(exitChunks[0].data.toolCallId).toBe('call-jkl');
    });

    it('sets toolCallId to undefined when no agent context', async () => {
      const { context, writerCustom } = createMockContext({
        executeCommand: async () => {
          return { success: true, exitCode: 0, stdout: 'ok', stderr: '', executionTimeMs: 1 };
        },
      });

      await execute({ command: 'echo', args: [], timeout: null, cwd: null }, context);

      const exitChunks = getChunks(writerCustom, 'data-sandbox-exit');
      expect(exitChunks).toHaveLength(1);
      expect(exitChunks[0].data.toolCallId).toBeUndefined();
    });
  });

  describe('exit chunk data', () => {
    it('emits exit chunk with success on successful command', async () => {
      const { context, writerCustom } = createMockContext({
        executeCommand: async () => {
          return { success: true, exitCode: 0, stdout: 'done', stderr: '', executionTimeMs: 123 };
        },
      });

      await execute({ command: 'echo', args: [], timeout: null, cwd: null }, context);

      const exitChunks = getChunks(writerCustom, 'data-sandbox-exit');
      expect(exitChunks).toHaveLength(1);
      expect(exitChunks[0].data).toMatchObject({
        exitCode: 0,
        success: true,
        executionTimeMs: 123,
      });
    });

    it('emits exit chunk with failure on non-zero exit code', async () => {
      const { context, writerCustom } = createMockContext({
        executeCommand: async () => {
          return { success: false, exitCode: 1, stdout: '', stderr: 'not found', executionTimeMs: 42 };
        },
      });

      await execute({ command: 'ls', args: ['/nope'], timeout: null, cwd: null }, context);

      const exitChunks = getChunks(writerCustom, 'data-sandbox-exit');
      expect(exitChunks).toHaveLength(1);
      expect(exitChunks[0].data).toMatchObject({
        exitCode: 1,
        success: false,
        executionTimeMs: 42,
      });
    });

    it('emits exit chunk with exitCode -1 on thrown error', async () => {
      const { context, writerCustom } = createMockContext({
        executeCommand: async () => {
          throw new Error('sandbox disconnected');
        },
      });

      const before = Date.now();
      await execute({ command: 'test', args: [], timeout: null, cwd: null }, context);
      const after = Date.now();

      const exitChunks = getChunks(writerCustom, 'data-sandbox-exit');
      expect(exitChunks).toHaveLength(1);
      expect(exitChunks[0].data.exitCode).toBe(-1);
      expect(exitChunks[0].data.success).toBe(false);
      expect(exitChunks[0].data.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(exitChunks[0].data.executionTimeMs).toBeLessThanOrEqual(after - before + 10);
    });
  });

  describe('return value with errors', () => {
    it('returns stdout + stderr + exit code on command failure', async () => {
      const { context } = createMockContext({
        executeCommand: async () => {
          return {
            success: false,
            exitCode: 2,
            stdout: 'partial output',
            stderr: 'some error',
            executionTimeMs: 10,
          };
        },
      });

      const result = await execute({ command: 'test', args: [], timeout: null, cwd: null }, context);

      expect(result).toBe('partial output\nsome error\nExit code: 2');
    });

    it('returns accumulated stdout + error message when sandbox throws', async () => {
      const { context } = createMockContext({
        executeCommand: async (_cmd, _args, opts) => {
          opts?.onStdout?.('Log #1\n');
          opts?.onStdout?.('Log #2\n');
          throw new Error('Process timed out after 4000ms');
        },
      });

      const result = await execute({ command: 'node', args: ['slow.js'], timeout: null, cwd: null }, context);

      expect(result).toContain('Log #1\n');
      expect(result).toContain('Log #2\n');
      expect(result).toContain('Error: Process timed out after 4000ms');
    });

    it('returns only error when no stdout was captured before throw', async () => {
      const { context } = createMockContext({
        executeCommand: async () => {
          throw new Error('Command not found');
        },
      });

      const result = await execute({ command: 'nonexistent', args: [], timeout: null, cwd: null }, context);

      expect(result).toBe('Error: Command not found');
    });

    it('returns accumulated stderr + error when only stderr before throw', async () => {
      const { context } = createMockContext({
        executeCommand: async (_cmd, _args, opts) => {
          opts?.onStderr?.('warning: something bad\n');
          throw new Error('killed');
        },
      });

      const result = await execute({ command: 'test', args: [], timeout: null, cwd: null }, context);

      expect(result).toBe('warning: something bad\n\nError: killed');
    });

    it('returns "(no output)" for successful command with empty stdout', async () => {
      const { context } = createMockContext({
        executeCommand: async () => {
          return { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 1 };
        },
      });

      const result = await execute({ command: 'true', args: [], timeout: null, cwd: null }, context);

      expect(result).toBe('(no output)');
    });

    it('returns stdout string for successful command', async () => {
      const { context } = createMockContext({
        executeCommand: async () => {
          return { success: true, exitCode: 0, stdout: 'hello world\n', stderr: '', executionTimeMs: 5 };
        },
      });

      const result = await execute({ command: 'echo', args: ['hello world'], timeout: null, cwd: null }, context);

      expect(result).toBe('hello world\n');
    });
  });

  describe('abort signal', () => {
    it('passes context.abortSignal to sandbox.executeCommand', async () => {
      const controller = new AbortController();
      let receivedOptions: ExecuteCommandOptions | undefined;

      const { context } = createMockContext({
        executeCommand: async (_cmd, _args, opts) => {
          receivedOptions = opts;
          return { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 1 };
        },
      });

      context.abortSignal = controller.signal;
      await execute({ command: 'echo', args: ['hi'], timeout: null, cwd: null }, context);

      expect(receivedOptions?.abortSignal).toBe(controller.signal);
    });

    it('passes undefined abortSignal when context has none', async () => {
      let receivedOptions: ExecuteCommandOptions | undefined;

      const { context } = createMockContext({
        executeCommand: async (_cmd, _args, opts) => {
          receivedOptions = opts;
          return { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 1 };
        },
      });

      await execute({ command: 'echo', args: ['hi'], timeout: null, cwd: null }, context);

      expect(receivedOptions?.abortSignal).toBeUndefined();
    });
  });

  describe('streaming chunks match return value', () => {
    it('streamed stdout chunks contain same data as final result', async () => {
      const stdoutLines = ['line 1\n', 'line 2\n', 'line 3\n'];
      const { context, writerCustom } = createMockContext({
        executeCommand: async (_cmd, _args, opts) => {
          for (const line of stdoutLines) {
            opts?.onStdout?.(line);
          }
          return {
            success: true,
            exitCode: 0,
            stdout: stdoutLines.join(''),
            stderr: '',
            executionTimeMs: 10,
          };
        },
      });

      const result = await execute({ command: 'cat', args: ['file.txt'], timeout: null, cwd: null }, context);

      // Final result is the stdout
      expect(result).toBe('line 1\nline 2\nline 3\n');

      // Streamed chunks should contain the same lines
      const stdoutChunks = getChunks(writerCustom, 'data-sandbox-stdout');
      const streamedOutput = stdoutChunks.map(c => c.data.output).join('');
      expect(streamedOutput).toBe(result);
    });

    it('streamed chunks + error match return value when command throws after streaming', async () => {
      const { context, writerCustom } = createMockContext({
        executeCommand: async (_cmd, _args, opts) => {
          opts?.onStdout?.('before error\n');
          throw new Error('boom');
        },
      });

      const result = await execute({ command: 'fail', args: [], timeout: null, cwd: null }, context);

      expect(result).toBe('before error\n\nError: boom');

      // Streamed stdout is the partial output
      const stdoutChunks = getChunks(writerCustom, 'data-sandbox-stdout');
      expect(stdoutChunks).toHaveLength(1);
      expect(stdoutChunks[0].data.output).toBe('before error\n');

      // Exit chunk indicates failure
      const exitChunks = getChunks(writerCustom, 'data-sandbox-exit');
      expect(exitChunks).toHaveLength(1);
      expect(exitChunks[0].data.success).toBe(false);
      expect(exitChunks[0].data.exitCode).toBe(-1);
    });
  });
});
