/**
 * Command execution test domain.
 * Tests: executeCommand with various options
 */

import type { MastraSandbox } from '@mastra/core/workspace';
import { describe, it, expect, beforeAll } from 'vitest';

import type { CreateSandboxOptions, SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: MastraSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
  createSandbox?: (options?: CreateSandboxOptions) => Promise<MastraSandbox> | MastraSandbox;
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

      it(
        'handles env values with special characters',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsEnvVars) return;

          const result = await executeCommand('printenv', ['SPECIAL'], {
            env: { SPECIAL: 'has spaces & "quotes"' },
          });

          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain('has spaces');
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

      it(
        'times out long-running commands with streaming callbacks',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsTimeout) return;
          if (!capabilities.supportsStreaming) return;

          const chunks: string[] = [];
          const result = await executeCommand(
            'sh',
            ['-c', 'for i in $(seq 1 100); do echo "line $i"; sleep 0.5; done'],
            {
              timeout: 2000,
              onStdout: c => chunks.push(c),
            },
          );

          // Should timeout and return failure
          expect(result.success).toBe(false);
          // Should have captured some partial output before timeout
          expect(chunks.length).toBeGreaterThan(0);
        },
        getContext().testTimeout,
      );

      it(
        'fast command completes within timeout',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsTimeout) return;

          const result = await executeCommand('echo', ['fast'], { timeout: 10000 });

          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain('fast');
        },
        getContext().testTimeout,
      );
    });

    describe('abort signal', () => {
      it(
        'aborts a running command when signal fires',
        async () => {
          const controller = new AbortController();

          const result = await executeCommand(
            'node',
            ['-e', 'process.stdout.write("started\\n"); setTimeout(() => {}, 30000)'],
            {
              abortSignal: controller.signal,
              onStdout: () => controller.abort(),
            },
          );

          expect(result.success).toBe(false);
          expect(result.executionTimeMs).toBeLessThan(5000);
        },
        getContext().testTimeout,
      );

      it(
        'aborts immediately when signal is already aborted',
        async () => {
          const controller = new AbortController();
          controller.abort();

          const start = Date.now();
          const result = await executeCommand('sleep', ['10'], {
            abortSignal: controller.signal,
          });

          expect(result.success).toBe(false);
          expect(Date.now() - start).toBeLessThan(2000);
        },
        getContext().testTimeout,
      );

      it(
        'captures partial output before abort',
        async () => {
          const controller = new AbortController();

          const result = await executeCommand(
            'node',
            ['-e', 'process.stdout.write("before abort\\n"); setTimeout(() => {}, 30000)'],
            {
              abortSignal: controller.signal,
              onStdout: () => controller.abort(),
            },
          );

          expect(result.success).toBe(false);
          expect(result.stdout).toContain('before abort');
          expect(result.executionTimeMs).toBeLessThan(5000);
        },
        getContext().testTimeout,
      );
    });

    describe('shell patterns', () => {
      it(
        'executes a shell pipeline',
        async () => {
          const result = await executeCommand('sh', [
            '-c',
            'echo "cherry banana apple" | tr " " "\\n" | sort | head -1',
          ]);

          expect(result.exitCode).toBe(0);
          expect(result.stdout.trim()).toBe('apple');
        },
        getContext().testTimeout,
      );

      it(
        'executes a heredoc',
        async () => {
          const result = await executeCommand('sh', [
            '-c',
            `cat > /tmp/heredoc-test.txt << 'EOF'
line one
line two
EOF
cat /tmp/heredoc-test.txt`,
          ]);

          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain('line one');
          expect(result.stdout).toContain('line two');
        },
        getContext().testTimeout,
      );

      it(
        'preserves custom exit codes',
        async () => {
          const result = await executeCommand('sh', ['-c', 'exit 42']);

          expect(result.exitCode).toBe(42);
          expect(result.success).toBe(false);
        },
        getContext().testTimeout,
      );

      it(
        'captures both stdout and stderr from same command',
        async () => {
          const result = await executeCommand('sh', ['-c', 'echo "out" && echo "err" >&2']);

          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain('out');
          expect(result.stderr).toContain('err');
        },
        getContext().testTimeout,
      );
    });

    describe('filesystem', () => {
      it(
        'can write and read back a file',
        async () => {
          const token = `roundtrip-${Date.now()}`;
          const write = await executeCommand('sh', ['-c', `echo "${token}" > /tmp/roundtrip-test.txt`]);
          const read = await executeCommand('cat', ['/tmp/roundtrip-test.txt']);

          expect(write.exitCode).toBe(0);
          expect(read.exitCode).toBe(0);
          expect(read.stdout).toContain(token);
        },
        getContext().testTimeout,
      );

      it(
        'handles large output (5000 lines)',
        async () => {
          const result = await executeCommand('sh', ['-c', 'seq 1 5000']);
          const lines = result.stdout.trim().split('\n');

          expect(result.exitCode).toBe(0);
          expect(lines.length).toBe(5000);
          expect(lines[0]).toBe('1');
          expect(lines[lines.length - 1]).toBe('5000');
        },
        getContext().testTimeout,
      );
    });

    describe('streaming', () => {
      it(
        'streams stdout chunks via callback',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsStreaming) return;

          const chunks: string[] = [];
          const result = await executeCommand('sh', ['-c', 'for i in 1 2 3; do echo "chunk $i"; sleep 0.3; done'], {
            onStdout: c => chunks.push(c),
          });

          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain('chunk 3');
          expect(chunks.length).toBeGreaterThan(0);
        },
        getContext().testTimeout,
      );

      it(
        'streams stderr chunks via callback',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsStreaming) return;

          const stderrChunks: string[] = [];
          const result = await executeCommand('sh', ['-c', 'echo "err1" >&2; sleep 0.2; echo "err2" >&2'], {
            onStderr: c => stderrChunks.push(c),
          });

          expect(result.exitCode).toBe(0);
          expect(stderrChunks.length).toBeGreaterThan(0);
          expect(result.stderr).toContain('err');
        },
        getContext().testTimeout,
      );
    });

    describe('sandbox-level environment variables', () => {
      const withEnvSandbox = async (
        env: Record<string, string>,
        run: (exec: NonNullable<MastraSandbox['executeCommand']>) => Promise<void>,
      ) => {
        const { createSandbox } = getContext();
        if (!createSandbox) return;
        const envSandbox = await createSandbox({ env });
        try {
          await envSandbox._start();
          const exec = envSandbox.executeCommand?.bind(envSandbox);
          if (!exec) throw new Error('sandbox.executeCommand must be defined');
          await run(exec);
        } finally {
          await envSandbox._destroy();
        }
      };

      it(
        'per-command env overrides sandbox-level env',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsEnvVars) return;

          await withEnvSandbox({ MY_VAR: 'initial' }, async exec => {
            // Check initial value from sandbox env
            const result1 = await exec('sh', ['-c', 'echo $MY_VAR']);
            expect(result1.stdout.trim()).toBe('initial');

            // Per-command env should override
            const result2 = await exec('sh', ['-c', 'echo $MY_VAR'], {
              env: { MY_VAR: 'changed' },
            });
            expect(result2.stdout.trim()).toBe('changed');

            // Original sandbox env still works for subsequent commands
            const result3 = await exec('sh', ['-c', 'echo $MY_VAR']);
            expect(result3.stdout.trim()).toBe('initial');
          });
        },
        getContext().testTimeout * 3,
      );

      it(
        'per-command env merges with sandbox-level env',
        async () => {
          const { capabilities } = getContext();
          if (!capabilities.supportsEnvVars) return;

          await withEnvSandbox({ VAR_A: '1', VAR_B: '2' }, async exec => {
            // Per-command env adds VAR_C and overrides VAR_B
            const result = await exec('sh', ['-c', 'echo $VAR_A $VAR_B $VAR_C'], {
              env: { VAR_B: 'override', VAR_C: '3' },
            });
            expect(result.stdout.trim()).toBe('1 override 3');
          });
        },
        getContext().testTimeout * 3,
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
