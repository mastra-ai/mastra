/**
 * Command execution test domain.
 * Tests: executeCommand with various options
 */

import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: WorkspaceSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
}

export function createCommandExecutionTests(getContext: () => TestContext): void {
  describe('Command Execution', () => {
    it('executes a simple command', async () => {
      const { sandbox } = getContext();

      if (!sandbox.executeCommand) return;

      const result = await sandbox.executeCommand('echo', ['hello']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
    }, getContext().testTimeout);

    it('captures stdout', async () => {
      const { sandbox } = getContext();

      if (!sandbox.executeCommand) return;

      const result = await sandbox.executeCommand('echo', ['stdout test']);

      expect(result.stdout).toContain('stdout test');
    }, getContext().testTimeout);

    it('captures stderr', async () => {
      const { sandbox } = getContext();

      if (!sandbox.executeCommand) return;

      // Use a command that writes to stderr
      const result = await sandbox.executeCommand('sh', ['-c', 'echo "error message" >&2']);

      expect(result.stderr).toContain('error message');
    }, getContext().testTimeout);

    it('returns non-zero exit code for failing command', async () => {
      const { sandbox } = getContext();

      if (!sandbox.executeCommand) return;

      const result = await sandbox.executeCommand('sh', ['-c', 'exit 1']);

      expect(result.exitCode).toBe(1);
    }, getContext().testTimeout);

    it('handles commands with arguments', async () => {
      const { sandbox } = getContext();

      if (!sandbox.executeCommand) return;

      const result = await sandbox.executeCommand('echo', ['arg1', 'arg2', 'arg3']);

      expect(result.stdout.trim()).toBe('arg1 arg2 arg3');
    }, getContext().testTimeout);

    it('handles commands with special characters in arguments', async () => {
      const { sandbox } = getContext();

      if (!sandbox.executeCommand) return;

      const result = await sandbox.executeCommand('echo', ['hello world', 'test']);

      expect(result.stdout.trim()).toBe('hello world test');
    }, getContext().testTimeout);

    describe('environment variables', () => {
      it('passes environment variables to command', async () => {
        const { sandbox, capabilities } = getContext();
        if (!capabilities.supportsEnvVars) return;
        if (!sandbox.executeCommand) return;

        const result = await sandbox.executeCommand('sh', ['-c', 'echo $TEST_VAR'], {
          env: { TEST_VAR: 'test_value' },
        });

        expect(result.stdout.trim()).toBe('test_value');
      }, getContext().testTimeout);

      it('handles multiple environment variables', async () => {
        const { sandbox, capabilities } = getContext();
        if (!capabilities.supportsEnvVars) return;
        if (!sandbox.executeCommand) return;

        const result = await sandbox.executeCommand('sh', ['-c', 'echo "$VAR1 $VAR2"'], {
          env: { VAR1: 'first', VAR2: 'second' },
        });

        expect(result.stdout.trim()).toBe('first second');
      }, getContext().testTimeout);
    });

    describe('working directory', () => {
      it('executes command in specified working directory', async () => {
        const { sandbox, capabilities } = getContext();
        if (!capabilities.supportsWorkingDirectory) return;
        if (!sandbox.executeCommand) return;

        const result = await sandbox.executeCommand('pwd', [], {
          cwd: '/tmp',
        });

        expect(result.stdout.trim()).toBe('/tmp');
      }, getContext().testTimeout);
    });

    describe('timeout', () => {
      it('times out long-running commands', async () => {
        const { sandbox, capabilities } = getContext();
        if (!capabilities.supportsTimeout) return;
        if (!sandbox.executeCommand) return;

        const result = await sandbox.executeCommand('sleep', ['10'], {
          timeout: 1000, // 1 second timeout
        });

        // Should either timeout (exit non-zero) or be killed
        expect(result.exitCode).not.toBe(0);
      }, getContext().testTimeout);
    });
  });
}
