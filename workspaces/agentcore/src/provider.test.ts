import { describe, it, expect, vi } from 'vitest';
import { agentCoreRuntimeSandboxProvider } from './provider';
import { AgentCoreRuntimeSandbox } from './sandbox';

vi.mock('@aws-sdk/client-bedrock-agentcore', () => {
  class BedrockAgentCoreClient {
    send = vi.fn();
    destroy = vi.fn();
  }

  class InvokeAgentRuntimeCommandCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }

  class StopRuntimeSessionCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }

  return { BedrockAgentCoreClient, InvokeAgentRuntimeCommandCommand, StopRuntimeSessionCommand };
});

describe('agentCoreRuntimeSandboxProvider', () => {
  it('describes the AgentCore Runtime sandbox provider', () => {
    expect(agentCoreRuntimeSandboxProvider.id).toBe('agentcore');
    expect(agentCoreRuntimeSandboxProvider.name).toBe('AgentCore Runtime Sandbox');
    expect(agentCoreRuntimeSandboxProvider.configSchema?.required).toEqual(['agentRuntimeArn']);
    expect(agentCoreRuntimeSandboxProvider.configSchema?.properties?.agentRuntimeArn).toBeDefined();
    expect(agentCoreRuntimeSandboxProvider.configSchema?.properties?.commandTimeout).toMatchObject({
      minimum: 1,
      maximum: 3_600_000,
    });
  });

  it('creates an AgentCoreRuntimeSandbox from serializable config', async () => {
    const sandbox = await agentCoreRuntimeSandboxProvider.createSandbox({
      region: 'us-west-2',
      agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/my-agent',
      runtimeSessionId: '12345678-1234-1234-1234-123456789012',
      qualifier: 'DEFAULT',
      commandTimeout: 120_000,
      stopSessionOnLifecycle: true,
    });

    expect(sandbox).toBeInstanceOf(AgentCoreRuntimeSandbox);
    expect(sandbox.id).toBe('12345678-1234-1234-1234-123456789012');
  });
});
