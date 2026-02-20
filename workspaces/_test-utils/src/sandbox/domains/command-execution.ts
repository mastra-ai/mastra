/**
 * Command execution test domain.
 * Tests: executeCommand with various options
 */

import type { MastraSandbox } from '@mastra/core/workspace';
import { describe, it, expect, beforeAll } from 'vitest';

import type { SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: MastraSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
}

export function createCommandExecutionTests(getContext: () => TestContext): void {
  describe('Command Execution', () => {
    let executeCommand: NonNullable<MastraSandbox['executeCommand']>;

    beforeAll(() => {
      const { sandbox } = getContext();
      expect(
        sandbox.executeCommand,
        'sandbox.executeCommand must be defined when commandExecution tests are enabled',
      ).toBeDefined();
      executeCommand = sandbox.executeCommand!.bind(sandbox);
    });

    it(
      'executes a simple command',
      async () => {
        const result = await executeCommand('echo', ['hello']);

        expect(result.exitCode).toBe(0);
        expect(result.success).toBe(true);
        expect(result.stdout.trim()).toBe('hello');
      },
      getContext().testTimeout,
    );

    it(
      'captures stdout',
      async () => {
        const result = await executeCommand('echo', ['stdout test']);

        expect(result.stdout).toContain('stdout test');
      },
      getContext().testTimeout,
    );

    it(
      'captures stderr',
      async () => {
        // Use a command that writes to stderr
        const result = await executeCommand('sh', ['-c', 'echo "error message" >&2']);

        expect(result.stderr).toContain('error message');
      },
      getContext().testTimeout,
    );

    it(
      'returns non-zero exit code for failing command',
      async () => {
        const result = await executeCommand('sh', ['-c', 'exit 1']);

        expect(result.exitCode).toBe(1);
        expect(result.success).toBe(false);
      },
      getContext().testTimeout,
    );

    it(
      'handles commands with arguments',
      async () => {
        const result = await executeCommand('echo', ['arg1', 'arg2', 'arg3']);

        expect(result.stdout.trim()).toBe('arg1 arg2 arg3');
      },
      getContext().testTimeout,
    );

    it(
      'handles commands with special characters in arguments',
      async () => {
        const result = await executeCommand('echo', ['hello world', 'test']);

        expect(result.stdout.trim()).toBe('hello world test');
      },
      getContext().testTimeout,
    );

    describe('environment variables', () => {
      it(
        'passes environment variables to command',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsEnvVars) return;

          const result = await executeCommand('sh', ['-c', 'echo $TEST_VAR'], {
            env: { TEST_VAR: 'test_value' },
          });

          expect(result.stdout.trim()).toBe('test_value');
        },
        getContext().testTimeout,
      );

      it(
        'handles multiple environment variables',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsEnvVars) return;

          const result = await executeCommand('sh', ['-c', 'echo "$VAR1 $VAR2"'], {
            env: { VAR1: 'first', VAR2: 'second' },
          });

          expect(result.stdout.trim()).toBe('first second');
        },
        getContext().testTimeout,
      );
    });

    describe('working directory', () => {
      it(
        'executes command in specified working directory',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsWorkingDirectory) return;

          const result = await executeCommand('pwd', [], {
            cwd: '/tmp',
          });

          // macOS: /tmp symlinks to /private/tmp
          expect(['/tmp', '/private/tmp']).toContain(result.stdout.trim());
        },
        getContext().testTimeout,
      );
    });

    describe('timeout', () => {
      it(
        'times out long-running commands',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsTimeout) return;

          const result = await executeCommand('sleep', ['10'], {
            timeout: 100,
          });

          // Should either timeout (exit non-zero) or be killed
          expect(result.exitCode).not.toBe(0);
        },
        getContext().testTimeout,
      );
    });

    describe('concurrency', () => {
      it(
        'executes multiple commands concurrently',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsConcurrency) return;

          // Run multiple commands in parallel
          const results = await Promise.all([
            executeCommand('echo', ['first']),
            executeCommand('echo', ['second']),
            executeCommand('echo', ['third']),
          ]);

          // All commands should succeed
          expect(results[0].exitCode).toBe(0);
          expect(results[0].stdout.trim()).toBe('first');
          expect(results[1].exitCode).toBe(0);
          expect(results[1].stdout.trim()).toBe('second');
          expect(results[2].exitCode).toBe(0);
          expect(results[2].stdout.trim()).toBe('third');
        },
        getContext().testTimeout,
      );

      it(
        'concurrent commands do not interfere with each other',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsConcurrency) return;
          if (!capabilities.supportsEnvVars) return;

          // Run commands that set different env vars
          const results = await Promise.all([
            executeCommand('sh', ['-c', 'echo $VAR'], { env: { VAR: 'value1' } }),
            executeCommand('sh', ['-c', 'echo $VAR'], { env: { VAR: 'value2' } }),
          ]);

          // Each command should see its own env vars
          expect(results[0].stdout.trim()).toBe('value1');
          expect(results[1].stdout.trim()).toBe('value2');
        },
        getContext().testTimeout,
      );
    });
  });
}
