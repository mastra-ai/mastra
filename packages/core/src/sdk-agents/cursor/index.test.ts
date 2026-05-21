import type { InteractionUpdate, ModelSelection, Run, SDKAgent, SDKMessage, SendOptions } from '@cursor/sdk';
import { describe, expect, it, vi } from 'vitest';

import { isAgentCompatible } from '../../agent';
import { CursorSDKAgent } from './index';

function createTurnEndedUpdate(): InteractionUpdate {
  return {
    type: 'turn-ended',
    usage: {
      inputTokens: 10,
      outputTokens: 4,
      cacheReadTokens: 2,
      cacheWriteTokens: 3,
    },
  } as InteractionUpdate;
}

function createTaskMessage(text: string): SDKMessage {
  return {
    type: 'task',
    text,
  } as SDKMessage;
}

function createRun({
  id = 'cursor-run',
  model = { id: 'gpt-5.5' },
  result = 'Cursor SDK result',
  streamMessages = [createTaskMessage(result)],
  supportsStream = true,
}: {
  id?: string;
  model?: ModelSelection;
  result?: string;
  streamMessages?: SDKMessage[];
  supportsStream?: boolean;
} = {}): Run {
  return {
    id,
    agentId: 'cursor-sdk-agent',
    status: 'finished',
    result,
    model,
    durationMs: 25,
    supports: operation => operation === 'stream' && supportsStream,
    unsupportedReason: () => undefined,
    stream: async function* () {
      for (const message of streamMessages) {
        yield message;
      }
    },
    wait: vi.fn(async () => ({
      id,
      status: 'finished',
      result,
      model,
      durationMs: 25,
    })),
    cancel: vi.fn(async () => undefined),
    onDidChangeStatus: vi.fn(() => () => undefined),
  } as Run;
}

function createSDKAgent(run: Run) {
  const send = vi.fn(async (_message: string, options?: SendOptions) => {
    await options?.onDelta?.({ update: createTurnEndedUpdate() });
    return run;
  });
  const sdkAgent = {
    agentId: 'cursor-sdk-agent',
    model: { id: 'gpt-5.5' },
    send,
    close: vi.fn(),
    reload: vi.fn(async () => undefined),
    [Symbol.asyncDispose]: vi.fn(async () => undefined),
    listArtifacts: vi.fn(async () => []),
    downloadArtifact: vi.fn(async () => Buffer.from('')),
  } as unknown as SDKAgent;

  return { sdkAgent, send };
}

describe('CursorSDKAgent', () => {
  it('is compatible with the Agent/SubAgent contract', () => {
    const { sdkAgent } = createSDKAgent(createRun());
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      name: 'Cursor Agent',
      description: 'Use Cursor Agent as a Mastra agent.',
      agent: sdkAgent,
    });

    expect(agent.id).toBe('cursor-agent');
    expect(agent.name).toBe('Cursor Agent');
    expect(agent.getDescription()).toBe('Use Cursor Agent as a Mastra agent.');
    expect(isAgentCompatible(agent)).toBe(true);
  });

  it('generate calls the provided Cursor SDK agent directly and returns Mastra output', async () => {
    const onDelta = vi.fn();
    const { sdkAgent, send } = createSDKAgent(createRun({ id: 'generate-run', result: 'generated text' }));
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: sdkAgent,
      mcpServers: {
        filesystem: { command: 'node', args: ['server.js'] },
      },
      sendOptions: {
        onDelta,
      },
    });

    const result = await agent.generate('Generate prompt', { runId: 'mastra-run', maxSteps: 1 });

    expect(result.text).toBe('generated text');
    expect(result.runId).toBe('mastra-run');
    expect(result.usage.inputTokens).toBe(15);
    expect(result.usage.outputTokens).toBe(4);
    expect(result.usage.totalTokens).toBe(19);
    expect(result.providerMetadata).toMatchObject({
      cursor: {
        agentId: 'cursor-sdk-agent',
        runId: 'generate-run',
        requestedModel: 'gpt-5.5',
        durationMs: 25,
        mcpServerNames: ['filesystem'],
      },
    });
    expect(send).toHaveBeenCalledWith(
      'Generate prompt',
      expect.objectContaining({
        mcpServers: {
          filesystem: { command: 'node', args: ['server.js'] },
        },
      }),
    );
    expect(onDelta).toHaveBeenCalledWith({ update: createTurnEndedUpdate() });
  });

  it('stream emits Mastra chunks and resolves text from Cursor stream messages', async () => {
    const { sdkAgent } = createSDKAgent(
      createRun({
        id: 'stream-run',
        result: 'streamed text',
        streamMessages: [createTaskMessage('streamed '), createTaskMessage('text')],
      }),
    );
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: () => sdkAgent,
    });

    const stream = await agent.stream('Stream prompt', { runId: 'stream-mastra-run' });
    const chunks = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    expect(await stream.text).toBe('streamed text');
    expect((await stream.usage).inputTokens).toBe(15);
    expect(chunks.map(chunk => chunk.type)).toEqual([
      'start',
      'step-start',
      'response-metadata',
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
      'step-finish',
      'finish',
    ]);
  });
});
