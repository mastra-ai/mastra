import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentCoreRuntimeSandbox } from './index';

const { mockSend, mockDestroy, commandInputs } = vi.hoisted(() => {
  return {
    mockSend: vi.fn(),
    mockDestroy: vi.fn(),
    commandInputs: [] as Array<{ type: string; input: Record<string, unknown> }>,
  };
});

vi.mock('@aws-sdk/client-bedrock-agentcore', () => {
  class BedrockAgentCoreClient {
    destroy = mockDestroy;

    send(command: { type: string; input: Record<string, unknown> }, options?: Record<string, unknown>) {
      return mockSend(command, options);
    }
  }

  class InvokeAgentRuntimeCommandCommand {
    readonly type = 'invoke';

    constructor(readonly input: Record<string, unknown>) {
      commandInputs.push({ type: this.type, input });
    }
  }

  class StopRuntimeSessionCommand {
    readonly type = 'stop';

    constructor(readonly input: Record<string, unknown>) {
      commandInputs.push({ type: this.type, input });
    }
  }

  return { BedrockAgentCoreClient, InvokeAgentRuntimeCommandCommand, StopRuntimeSessionCommand };
});

async function* streamEvents(
  events: Array<{
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    status?: string;
  }>,
) {
  for (const event of events) {
    if (event.stdout || event.stderr) {
      yield {
        chunk: {
          contentDelta: {
            stdout: event.stdout,
            stderr: event.stderr,
          },
        },
      };
    }

    if (event.exitCode !== undefined || event.status) {
      yield {
        chunk: {
          contentStop: {
            exitCode: event.exitCode,
            status: event.status,
          },
        },
      };
    }
  }
}

describe('AgentCoreRuntimeSandbox', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockDestroy.mockReset();
    commandInputs.length = 0;
  });

  it('creates a sandbox with AgentCore Runtime metadata', () => {
    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    expect(sandbox.name).toBe('AgentCoreRuntimeSandbox');
    expect(sandbox.provider).toBe('agentcore');
    expect(sandbox.id).toBe('12345678-1234-1234-1234-123456789012');
    expect(sandbox.runtimeSessionId).toBe('12345678-1234-1234-1234-123456789012');
  });

  it('requires an agent runtime ARN', () => {
    expect(() => new AgentCoreRuntimeSandbox({ agentRuntimeArn: '' })).toThrow('agentRuntimeArn is required');
  });

  it('executes commands through InvokeAgentRuntimeCommand', async () => {
    mockSend.mockResolvedValueOnce({
      stream: streamEvents([
        { stdout: 'hello ' },
        { stderr: 'warn' },
        { stdout: 'world' },
        { exitCode: 0, status: 'COMPLETED' },
      ]),
    });

    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const sandbox = new AgentCoreRuntimeSandbox({
      region: 'us-west-2',
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
      qualifier: 'DEFAULT',
    });

    const result = await sandbox.executeCommand('npm', ['test'], {
      cwd: '/workspace/app',
      env: { NODE_ENV: 'test' },
      timeout: 60_000,
      onStdout,
      onStderr,
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(commandInputs[0]).toEqual({
      type: 'invoke',
      input: {
        agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
        runtimeSessionId: '12345678-1234-1234-1234-123456789012',
        qualifier: 'DEFAULT',
        contentType: 'application/json',
        accept: 'application/vnd.amazon.eventstream',
        body: {
          command: 'cd /workspace/app && NODE_ENV=test npm test',
          timeout: 60,
        },
      },
    });
    expect(result).toMatchObject({
      command: 'cd /workspace/app && NODE_ENV=test npm test',
      success: true,
      exitCode: 0,
      stdout: 'hello world',
      stderr: 'warn',
      timedOut: false,
    });
    expect(onStdout).toHaveBeenCalledWith('hello ');
    expect(onStdout).toHaveBeenCalledWith('world');
    expect(onStderr).toHaveBeenCalledWith('warn');
  });

  it('returns non-zero command exits without throwing', async () => {
    mockSend.mockResolvedValueOnce({
      stream: streamEvents([{ stderr: 'failed' }, { exitCode: 2, status: 'COMPLETED' }]),
    });

    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    const result = await sandbox.executeCommand('/bin/bash -c "exit 2"');

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('failed');
  });

  it('marks AgentCore timed out commands as timedOut', async () => {
    mockSend.mockResolvedValueOnce({
      stream: streamEvents([{ stderr: 'timeout' }, { exitCode: 124, status: 'TIMED_OUT' }]),
    });

    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    const result = await sandbox.executeCommand('sleep 10', [], { timeout: 1000 });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);
    expect(commandInputs[0]?.input.body).toEqual({ command: 'sleep 10', timeout: 1 });
  });

  it('returns exit code 124 when AgentCore omits the timeout exit code', async () => {
    mockSend.mockResolvedValueOnce({
      stream: streamEvents([{ stderr: 'timeout' }, { status: 'TIMED_OUT' }]),
    });

    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    const result = await sandbox.executeCommand('sleep 10', [], { timeout: 1000 });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);
  });

  it('passes abort signals to the AWS SDK client', async () => {
    mockSend.mockResolvedValueOnce({
      stream: streamEvents([{ exitCode: 0, status: 'COMPLETED' }]),
    });

    const abortController = new AbortController();
    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    await sandbox.executeCommand('echo ok', [], { abortSignal: abortController.signal });

    expect(mockSend.mock.calls[0]?.[1]).toEqual({ abortSignal: abortController.signal });
  });

  it('surfaces AgentCore event stream errors', async () => {
    mockSend.mockResolvedValueOnce({
      stream: (async function* () {
        yield {
          validationException: {
            name: 'ValidationException',
            message: 'Command payload is invalid',
          },
        };
      })(),
    });

    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    await expect(sandbox.executeCommand('echo ok')).rejects.toThrow(
      '[AgentCoreRuntimeSandbox] ValidationException: Command payload is invalid',
    );
  });

  it('rejects invalid environment variable names', async () => {
    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    await expect(sandbox.executeCommand('echo ok', [], { env: { 'BAD-NAME': 'value' } })).rejects.toThrow(
      'Invalid environment variable name',
    );
  });

  it('validates AgentCore command timeout limits', async () => {
    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    await expect(sandbox.executeCommand('echo ok', [], { timeout: 0 })).rejects.toThrow(
      'timeout must be a positive number',
    );
    await expect(sandbox.executeCommand('echo ok', [], { timeout: 3_601_000 })).rejects.toThrow(
      'timeout must be at most 3600 seconds',
    );
  });

  it('stops the runtime session only when lifecycle cleanup is enabled', async () => {
    mockSend.mockResolvedValueOnce({});

    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
      stopSessionOnLifecycle: true,
      stopClientToken: '12345678-1234-1234-1234-123456789012',
    });

    await sandbox._start();
    await sandbox._destroy();

    expect(commandInputs[0]).toEqual({
      type: 'stop',
      input: {
        agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
        runtimeSessionId: '12345678-1234-1234-1234-123456789012',
        qualifier: undefined,
        clientToken: '12345678-1234-1234-1234-123456789012',
      },
    });
    expect(mockDestroy).toHaveBeenCalled();
  });

  it('does not stop the runtime session by default', async () => {
    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    await sandbox._start();
    await sandbox._destroy();

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it('destroys an owned AWS client after it has been used', async () => {
    mockSend.mockResolvedValueOnce({
      stream: streamEvents([{ exitCode: 0, status: 'COMPLETED' }]),
    });

    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
    });

    await sandbox.executeCommand('echo ok');
    await sandbox._destroy();

    expect(mockDestroy).toHaveBeenCalled();
  });

  it('can explicitly stop the runtime session without lifecycle cleanup enabled', async () => {
    mockSend.mockResolvedValueOnce({});

    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
      stopClientToken: '12345678-1234-1234-1234-123456789012',
    });

    await sandbox.stopRuntimeSession();

    expect(commandInputs[0]).toEqual({
      type: 'stop',
      input: {
        agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
        runtimeSessionId: '12345678-1234-1234-1234-123456789012',
        qualifier: undefined,
        clientToken: '12345678-1234-1234-1234-123456789012',
      },
    });
  });

  it('supports custom instructions', () => {
    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
      instructions: ({ defaultInstructions }) => `${defaultInstructions}\nUse /workspace for project files.`,
    });

    expect(sandbox.getInstructions()).toContain('AgentCore Code Interpreter is a separate service');
    expect(sandbox.getInstructions()).toContain('Use /workspace for project files.');
  });

  it('exposes runtime metadata from getInfo', async () => {
    const sandbox = new AgentCoreRuntimeSandbox({
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
      qualifier: 'prod',
    });

    const info = await sandbox.getInfo();

    expect(info).toMatchObject({
      id: '12345678-1234-1234-1234-123456789012',
      name: 'AgentCoreRuntimeSandbox',
      provider: 'agentcore',
      status: 'pending',
      metadata: {
        agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
        runtimeSessionId: '12345678-1234-1234-1234-123456789012',
        qualifier: 'prod',
        stopSessionOnLifecycle: false,
      },
    });
  });
});
