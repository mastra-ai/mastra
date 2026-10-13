import type { Agent } from '@mastra/core/agent';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRestateAgent, isRestateAgent } from '../durable-agent';

function makeMockAgent(): Agent<any, any, any> {
  const agent: any = {
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'test',
    getModel: vi.fn(async () => ({ specificationVersion: 'v2', modelId: 'gpt-4', provider: 'openai' })),
    getDefaultOptions: vi.fn(async () => ({})),
    stream: vi.fn(),
    generate: vi.fn(),
    listTools: vi.fn(async () => ({})),
    getDescription: vi.fn(() => 'test agent'),
    __registerMastra: vi.fn(),
    __registerPrimitives: vi.fn(),
    __setLogger: vi.fn(),
  };
  return agent as unknown as Agent<any, any, any>;
}

function makeMockStream(chunks: any[]) {
  const { ReadableStream } = require('node:stream/web') as typeof import('node:stream/web');
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

function makeMockIngress(result: any) {
  const client = {
    run: vi.fn(async () => ({ status: 'completed', runId: 'r1', result })),
    getRun: vi.fn(async () => null),
    resolveAwakeable: vi.fn(async () => ({ ok: true })),
    rejectAwakeable: vi.fn(async () => ({ ok: true })),
  };
  return {
    serviceClient: vi.fn(() => client),
  } as any;
}

const completedResult = {
  text: 'Hello!',
  chunks: [{ type: 'text', text: 'Hello!' }],
  steps: [],
  usage: {},
  finishReason: 'stop',
};

describe('createRestateAgent', () => {
  let agent: Agent<any, any, any>;

  beforeEach(() => {
    agent = makeMockAgent();
  });

  it('creates an agent that is recognized by isRestateAgent', () => {
    const ingress = makeMockIngress(completedResult);
    const durableAgent = createRestateAgent({ agent, restate: ingress });
    expect(isRestateAgent(durableAgent)).toBe(true);
    expect(durableAgent.id).toBe('test-agent');
    expect(durableAgent.name).toBe('Test Agent');
  });

  it('supports a { url } restate descriptor', () => {
    const durableAgent = createRestateAgent({ agent, restate: { url: 'http://localhost:8080' } });
    expect(isRestateAgent(durableAgent)).toBe(true);
  });

  it('stream() invokes the service run handler and reconstructs output', async () => {
    const ingress = makeMockIngress(completedResult);
    const durableAgent = createRestateAgent({ agent, restate: ingress });

    agent.stream = vi.fn(async () => ({
      fullStream: makeMockStream([{ type: 'text', text: 'Hello!' }]),
      __getModel: () => ({ modelId: 'gpt-4', provider: 'openai' }),
      getFullOutput: async () => ({
        text: 'Hello!',
        steps: [],
        usage: {},
        finishReason: 'stop',
      }),
    })) as any;

    const result = await durableAgent.stream('Hello');
    expect(result.runId).toBeDefined();
    expect(result.output).toBeDefined();
    expect(result.fullStream).toBeDefined();
    expect(typeof result.cleanup).toBe('function');
    expect(typeof result.abort).toBe('function');
  });

  it('generate() drains to a FullOutput', async () => {
    const ingress = makeMockIngress(completedResult);
    const durableAgent = createRestateAgent({ agent, restate: ingress });
    const out = await durableAgent.generate('Hello');
    expect(out.text).toBe('Hello!');
  });

  it('recover() throws a not-supported error', async () => {
    const ingress = makeMockIngress(completedResult);
    const durableAgent = createRestateAgent({ agent, restate: ingress });
    await expect(durableAgent.recover('r1')).rejects.toThrow(/not supported/i);
  });

  it('approveToolCall() resolves the awakeable for a suspended run', async () => {
    const suspendedState = {
      runId: 'r1',
      status: 'suspended',
      awakeableId: 'awk-1',
      toolCall: { toolCallId: 'tc-1', toolName: 'search' },
      events: [],
    };
    const ingress = makeMockIngress(completedResult);
    ingress.serviceClient().getRun = vi.fn(async () => suspendedState);
    const durableAgent = createRestateAgent({ agent, restate: ingress });

    await durableAgent.approveToolCall({ runId: 'r1' });
    expect(ingress.serviceClient().resolveAwakeable).toHaveBeenCalledWith({
      awakeableId: 'awk-1',
      resolution: { approved: true, toolCallId: 'tc-1' },
    });
  });

  it('approveToolCall() throws when no approval is pending', async () => {
    const ingress = makeMockIngress(completedResult);
    ingress.serviceClient().getRun = vi.fn(async () => null);
    const durableAgent = createRestateAgent({ agent, restate: ingress });
    await expect(durableAgent.approveToolCall({ runId: 'r1' })).rejects.toThrow(/no pending approval/i);
  });

  it('prepare() returns run and message ids', async () => {
    const ingress = makeMockIngress(completedResult);
    const durableAgent = createRestateAgent({ agent, restate: ingress });
    const prepared = await durableAgent.prepare('Hello');
    expect(prepared.runId).toBeDefined();
    expect(prepared.messageId).toBeDefined();
  });

  it('forwards agent method calls through the proxy', () => {
    const ingress = makeMockIngress(completedResult);
    const durableAgent = createRestateAgent({ agent, restate: ingress });
    expect(durableAgent.getDescription()).toBe('test agent');
  });

  it('getDurableWorkflows() returns an empty array (Restate owns execution)', () => {
    const ingress = makeMockIngress(completedResult);
    const durableAgent = createRestateAgent({ agent, restate: ingress });
    expect(durableAgent.getDurableWorkflows()).toEqual([]);
  });
});
