import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { AgentCoreRuntimeSandbox } from './index';

const agentRuntimeArn = process.env.AGENTCORE_RUNTIME_ARN;
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

const describeAgentCore = agentRuntimeArn ? describe : describe.skip;

describeAgentCore('AgentCoreRuntimeSandbox integration', () => {
  it('executes a shell command in AgentCore Runtime', async () => {
    const sandbox = new AgentCoreRuntimeSandbox({
      region,
      agentRuntimeArn: agentRuntimeArn!,
      runtimeSessionId: randomUUID(),
    });

    try {
      const stdoutChunks: string[] = [];
      const result = await sandbox.executeCommand('sh', ['-c', 'echo mastra-agentcore-ok && pwd'], {
        timeout: 30_000,
        onStdout: data => stdoutChunks.push(data),
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mastra-agentcore-ok');
      expect(stdoutChunks.join('')).toContain('mastra-agentcore-ok');
    } finally {
      try {
        await sandbox.stopRuntimeSession();
      } finally {
        await sandbox.destroy();
      }
    }
  });

  it('returns non-zero exits without throwing', async () => {
    const sandbox = new AgentCoreRuntimeSandbox({
      region,
      agentRuntimeArn: agentRuntimeArn!,
      runtimeSessionId: randomUUID(),
    });

    try {
      const result = await sandbox.executeCommand('sh', ['-c', 'echo agentcore-error >&2; exit 7'], {
        timeout: 30_000,
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(7);
      expect(result.stderr).toContain('agentcore-error');
    } finally {
      try {
        await sandbox.stopRuntimeSession();
      } finally {
        await sandbox.destroy();
      }
    }
  });
});
