import type { InteractionUpdate, ModelSelection, Run, SDKAgent, SDKMessage, SendOptions } from '@cursor/sdk';
import { isAgentCompatible } from '@mastra/core/agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CursorSDKAgent } from './index';

const createCursorAgent = vi.fn();
const cursorCreateMock = vi.hoisted(() => vi.fn());
const cursorResumeMock = vi.hoisted(() => vi.fn());

vi.mock('@cursor/sdk', () => ({
  Agent: {
    create: cursorCreateMock,
    resume: cursorResumeMock,
  },
}));

function createTurnEndedUpdate({
  inputTokens = 10,
  outputTokens = 4,
  cacheReadTokens = 2,
  cacheWriteTokens = 3,
}: {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
} = {}): InteractionUpdate {
  return {
    type: 'turn-ended',
    usage: {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
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
  model = { id: '__GATEWAY_OPENAI_MODEL__' },
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

function createSDKAgent(run: Run, updates: InteractionUpdate[] = [createTurnEndedUpdate()]) {
  const send = vi.fn(async (_message: string, options?: SendOptions) => {
    for (const update of updates) {
      await options?.onDelta?.({ update });
    }
    return run;
  });
  const sdkAgent = {
    agentId: 'cursor-sdk-agent',
    model: { id: '__GATEWAY_OPENAI_MODEL__' },
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
  beforeEach(() => {
    createCursorAgent.mockReset();
    cursorCreateMock.mockReset();
    cursorResumeMock.mockReset();
  });

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
    expect(agent.supportsMemory()).toBe(false);
    expect(isAgentCompatible(agent)).toBe(true);
  });

  it('accepts a direct CursorAgent.create promise as the wrapped SDK agent', async () => {
    const { sdkAgent } = createSDKAgent(createRun({ id: 'promise-run', result: 'promise text' }));
    createCursorAgent.mockResolvedValueOnce(sdkAgent);
    const sdkAgentPromise = createCursorAgent({
      apiKey: 'cursor-key',
      model: { id: '__GATEWAY_OPENAI_MODEL__' },
      local: {
        cwd: '/repo',
      },
    });

    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: sdkAgentPromise,
    });

    const result = await agent.generate('Generate prompt');

    expect(result.text).toBe('promise text');
    expect(createCursorAgent).toHaveBeenCalledWith({
      apiKey: 'cursor-key',
      model: { id: '__GATEWAY_OPENAI_MODEL__' },
      local: {
        cwd: '/repo',
      },
    });
  });

  it('creates a Cursor SDK agent from sdkOptions and falls back to CURSOR_API_KEY', async () => {
    const originalApiKey = process.env['CURSOR_API_KEY'];
    process.env['CURSOR_API_KEY'] = 'cursor-env-key';
    const { sdkAgent } = createSDKAgent(createRun({ id: 'created-run', result: 'created text' }));
    cursorCreateMock.mockResolvedValueOnce(sdkAgent);

    try {
      const agent = new CursorSDKAgent({
        id: 'cursor-agent',
        name: 'Cursor Agent',
        description: 'Cursor',
        sdkOptions: {
          model: { id: '__GATEWAY_OPENAI_MODEL__' },
          local: {
            cwd: '/repo',
          },
        },
      });

      const result = await agent.generate('Generate prompt');

      expect(result.text).toBe('created text');
      expect(cursorCreateMock).toHaveBeenCalledWith({
        apiKey: 'cursor-env-key',
        model: { id: '__GATEWAY_OPENAI_MODEL__' },
        name: 'Cursor Agent',
        local: {
          cwd: '/repo',
        },
      });
    } finally {
      if (originalApiKey === undefined) {
        delete process.env['CURSOR_API_KEY'];
      } else {
        process.env['CURSOR_API_KEY'] = originalApiKey;
      }
    }
  });

  it('lets an agent factory compose wrapper options with factory-owned options', async () => {
    const originalApiKey = process.env['CURSOR_API_KEY'];
    process.env['CURSOR_API_KEY'] = 'cursor-env-key';
    const { sdkAgent } = createSDKAgent(createRun({ id: 'composed-run', result: 'composed text' }));
    createCursorAgent.mockResolvedValueOnce(sdkAgent);
    const agentFactory = vi.fn(options =>
      createCursorAgent({
        ...options,
        model: { id: '__GATEWAY_OPENAI_MODEL__' },
        local: {
          cwd: '/repo',
        },
      }),
    );

    try {
      const agent = new CursorSDKAgent({
        id: 'cursor-agent',
        name: 'Cursor Agent',
        description: 'Cursor',
        agent: agentFactory,
        sdkOptions: {
          mcpServers: {
            filesystem: { command: 'node', args: ['server.js'] },
          },
        },
      });

      const result = await agent.generate('Generate prompt');

      expect(result.text).toBe('composed text');
      expect(agentFactory).toHaveBeenCalledWith({
        apiKey: 'cursor-env-key',
        name: 'Cursor Agent',
        mcpServers: {
          filesystem: { command: 'node', args: ['server.js'] },
        },
      });
      expect(createCursorAgent).toHaveBeenCalledWith({
        apiKey: 'cursor-env-key',
        name: 'Cursor Agent',
        model: { id: '__GATEWAY_OPENAI_MODEL__' },
        local: {
          cwd: '/repo',
        },
        mcpServers: {
          filesystem: { command: 'node', args: ['server.js'] },
        },
      });
    } finally {
      if (originalApiKey === undefined) {
        delete process.env['CURSOR_API_KEY'];
      } else {
        process.env['CURSOR_API_KEY'] = originalApiKey;
      }
    }
  });

  it('uses the inline Cursor model for wrapper model metadata', async () => {
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: createCursorAgent,
      sdkOptions: {
        model: { id: '__GATEWAY_OPENAI_MODEL__' },
      },
    });

    expect((await agent.getModel()).modelId).toBe('__GATEWAY_OPENAI_MODEL__');
  });

  it('retries inline Cursor SDK agent creation after a failure', async () => {
    const { sdkAgent } = createSDKAgent(createRun({ id: 'retry-run', result: 'retried text' }));
    cursorCreateMock.mockRejectedValueOnce(new Error('create failed')).mockResolvedValueOnce(sdkAgent);
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      sdkOptions: {
        model: { id: '__GATEWAY_OPENAI_MODEL__' },
      },
    });

    await expect(agent.generate('Generate prompt')).rejects.toThrow('create failed');

    const result = await agent.generate('Generate prompt');

    expect(result.text).toBe('retried text');
    expect(cursorCreateMock).toHaveBeenCalledTimes(2);
  });

  it('generate calls the provided Cursor SDK agent directly and returns Mastra output', async () => {
    const { sdkAgent, send } = createSDKAgent(createRun({ id: 'generate-run', result: 'generated text' }));
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: () => sdkAgent,
      sdkOptions: {
        mcpServers: {
          filesystem: { command: 'node', args: ['server.js'] },
        },
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
        requestedModel: '__GATEWAY_OPENAI_MODEL__',
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
  });

  it('sums usage across Cursor turn-ended updates', async () => {
    const { sdkAgent } = createSDKAgent(createRun(), [
      {
        type: 'turn-ended',
      } as InteractionUpdate,
      createTurnEndedUpdate({
        inputTokens: 10,
        outputTokens: 4,
        cacheReadTokens: 2,
        cacheWriteTokens: 3,
      }),
      createTurnEndedUpdate({
        inputTokens: 7,
        outputTokens: 5,
        cacheReadTokens: 11,
        cacheWriteTokens: 13,
      }),
    ]);
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: sdkAgent,
    });

    const result = await agent.generate('Generate prompt');

    expect(result.usage.inputTokens).toBe(46);
    expect(result.usage.outputTokens).toBe(9);
    expect(result.usage.totalTokens).toBe(55);
    expect(result.usage.cachedInputTokens).toBe(13);
    expect(result.usage.cacheCreationInputTokens).toBe(16);
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

  it('does not force structured output when the Cursor SDK has no native schema output API', async () => {
    const { sdkAgent, send } = createSDKAgent(createRun({ result: '{"answer":"yes"}' }));
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: sdkAgent,
    });

    const options = {
      structuredOutput: {
        schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
          },
          required: ['answer'],
        },
      },
    } as const;

    await expect(agent.generate<{ answer: string }>('Return a JSON answer', options)).rejects.toThrow(
      'CursorSDKAgent does not support structuredOutput',
    );
    await expect(agent.stream<{ answer: string }>('Return a JSON answer', options)).rejects.toThrow(
      'CursorSDKAgent does not support structuredOutput',
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('resumeGenerate reuses the wrapped Cursor SDK agent when agentId is omitted', async () => {
    const { sdkAgent, send } = createSDKAgent(createRun({ result: 'continued text' }));
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: sdkAgent,
    });

    const result = await agent.resumeGenerate({ message: 'Continue prompt' }, { runId: 'resume-run' });

    expect(result.text).toBe('continued text');
    expect(result.runId).toBe('resume-run');
    expect(send).toHaveBeenCalledWith('Continue prompt', expect.objectContaining({ onDelta: expect.any(Function) }));
    expect(cursorResumeMock).not.toHaveBeenCalled();
  });

  it('resumeStream resumes a Cursor SDK agent by agentId when provided', async () => {
    const { sdkAgent, send } = createSDKAgent(
      createRun({
        id: 'resumed-run',
        result: 'resumed text',
        streamMessages: [createTaskMessage('resumed '), createTaskMessage('text')],
      }),
    );
    cursorResumeMock.mockResolvedValueOnce(sdkAgent);
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      sdkOptions: {
        model: { id: '__GATEWAY_OPENAI_MODEL__' },
      },
    });

    const stream = await agent.resumeStream(
      {
        message: 'Continue prompt',
        agentId: 'cursor-agent-id',
        sdkOptions: {
          model: { id: '__GATEWAY_OPENAI_MODEL_BASE__' },
        },
      },
      { runId: 'resume-run' },
    );
    for await (const _chunk of stream.fullStream) {
      // drain
    }

    expect(await stream.text).toBe('resumed text');
    expect(cursorResumeMock).toHaveBeenCalledWith(
      'cursor-agent-id',
      expect.objectContaining({
        model: { id: '__GATEWAY_OPENAI_MODEL_BASE__' },
      }),
    );
    expect(send).toHaveBeenCalledWith('Continue prompt', expect.objectContaining({ onDelta: expect.any(Function) }));
  });
});
