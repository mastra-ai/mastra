import { isAgentCompatible } from '@mastra/core/agent';
import { Agent as OpenAIAgent } from '@openai/agents';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenAISDKAgent } from './index';

const runMock = vi.hoisted(() => vi.fn());
const TEST_OPENAI_MODEL = 'gpt-5.1';

vi.mock('@openai/agents', () => {
  class Agent {
    name: string;
    instructions?: unknown;
    model?: unknown;
    tools?: unknown[];

    constructor(options: { name: string; instructions?: unknown; model?: unknown; tools?: unknown[] }) {
      this.name = options.name;
      this.instructions = options.instructions;
      this.model = options.model;
      this.tools = options.tools;
    }
  }

  return {
    Agent,
    run: runMock,
  };
});

function createUsage({
  inputTokens = 10,
  outputTokens = 4,
  cacheReadInputTokens = 2,
  reasoningTokens = 1,
}: {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  reasoningTokens?: number;
} = {}) {
  return {
    requests: 1,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputTokensDetails: [{ cachedTokens: cacheReadInputTokens }],
    outputTokensDetails: [{ reasoningTokens }],
    requestUsageEntries: [
      {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        inputTokensDetails: { cachedTokens: cacheReadInputTokens },
        outputTokensDetails: { reasoningTokens },
        endpoint: 'responses.create',
      },
    ],
  };
}

function createRunResult({
  finalOutput = 'OpenAI SDK result',
  model = TEST_OPENAI_MODEL,
  usage = createUsage(),
  newItems = [],
}: {
  finalOutput?: unknown;
  model?: string;
  usage?: unknown;
  newItems?: any[];
} = {}) {
  const lastAgent = new OpenAIAgent({
    name: 'SDK Agent',
    model,
  });

  return {
    finalOutput,
    lastResponseId: 'response-id',
    lastAgent,
    newItems,
    rawResponses: [
      {
        responseId: 'response-id',
        providerData: {
          model,
        },
        usage,
      },
    ],
    state: {
      usage,
    },
    runContext: {
      usage,
    },
  };
}

function createStreamedRunResult({
  finalOutput = 'hello world',
  model = TEST_OPENAI_MODEL,
  usage = createUsage(),
  events = [
    {
      type: 'raw_model_stream_event',
      data: {
        type: 'output_text_delta',
        delta: 'hello ',
      },
    },
    {
      type: 'raw_model_stream_event',
      data: {
        type: 'output_text_delta',
        delta: 'world',
      },
    },
  ],
}: {
  finalOutput?: unknown;
  model?: string;
  usage?: unknown;
  events?: any[];
} = {}) {
  const result = createRunResult({ finalOutput, model, usage });

  return {
    ...result,
    completed: Promise.resolve(),
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

function createFunctionToolItems() {
  const call = {
    type: 'tool_call_item',
    rawItem: {
      type: 'function_call',
      callId: 'tool-call-id',
      name: 'getWeather',
      arguments: '{"city":"Lagos"}',
    },
  };
  const output = {
    type: 'tool_call_output_item',
    rawItem: {
      type: 'function_call_result',
      callId: 'tool-call-id',
      name: 'getWeather',
      status: 'completed',
      output: 'sunny',
    },
    output: 'sunny',
  };

  return [call, output];
}

describe('OpenAISDKAgent', () => {
  beforeEach(() => {
    runMock.mockReset();
  });

  it('is compatible with the Agent/SubAgent contract', () => {
    const agent = new OpenAISDKAgent({
      id: 'openai-agent',
      name: 'OpenAI Agent',
      description: 'Use OpenAI Agents SDK as a Mastra agent.',
      sdkOptions: {
        name: 'SDK Agent',
        model: TEST_OPENAI_MODEL,
      },
    });

    expect(agent.id).toBe('openai-agent');
    expect(agent.name).toBe('OpenAI Agent');
    expect(agent.getDescription()).toBe('Use OpenAI Agents SDK as a Mastra agent.');
    expect(agent.supportsMemory()).toBe(false);
    expect(isAgentCompatible(agent)).toBe(true);
  });

  it('creates an OpenAI SDK agent from sdkOptions and maps generate options to run()', async () => {
    runMock.mockResolvedValueOnce(createRunResult({ finalOutput: 'generated text' }));
    const abortController = new AbortController();
    const agent = new OpenAISDKAgent({
      id: 'openai-agent',
      name: 'OpenAI Agent',
      description: 'OpenAI',
      sdkOptions: {
        name: 'SDK Agent',
        instructions: 'Answer clearly.',
        model: TEST_OPENAI_MODEL,
      },
    });

    const result = await agent.generate('Generate prompt', {
      runId: 'mastra-run',
      abortSignal: abortController.signal,
      maxSteps: 2,
    });

    expect(result.text).toBe('generated text');
    expect(result.runId).toBe('mastra-run');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(4);
    expect(result.usage.totalTokens).toBe(14);
    expect(result.providerMetadata).toMatchObject({
      openai: {
        model: TEST_OPENAI_MODEL,
        responseId: 'response-id',
        lastResponseId: 'response-id',
        rawResponseCount: 1,
      },
    });
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SDK Agent',
        instructions: 'Answer clearly.',
        model: TEST_OPENAI_MODEL,
      }),
      'Generate prompt',
      {
        stream: false,
        maxTurns: 2,
        signal: abortController.signal,
      },
    );
  });

  it('accepts a pre-created OpenAI SDK agent', async () => {
    runMock.mockResolvedValueOnce(createRunResult({ finalOutput: 'direct text' }));
    const sdkAgent = new OpenAIAgent({
      name: 'Direct SDK Agent',
      model: TEST_OPENAI_MODEL,
    });
    const agent = new OpenAISDKAgent({
      id: 'openai-agent',
      description: 'OpenAI',
      agent: sdkAgent,
    });

    const result = await agent.generate('Generate prompt');

    expect(result.text).toBe('direct text');
    expect(runMock).toHaveBeenCalledWith(
      sdkAgent,
      'Generate prompt',
      expect.objectContaining({
        stream: false,
      }),
    );
  });

  it('streams text deltas from OpenAI SDK raw model events', async () => {
    runMock.mockResolvedValueOnce(createStreamedRunResult());
    const agent = new OpenAISDKAgent({
      id: 'openai-agent',
      description: 'OpenAI',
      sdkOptions: {
        name: 'SDK Agent',
        model: TEST_OPENAI_MODEL,
      },
    });

    const output = await agent.stream('Stream prompt', {
      runId: 'stream-run',
      maxSteps: 3,
    });
    const fullOutput = await output.getFullOutput();

    expect(fullOutput.text).toBe('hello world');
    expect(fullOutput.runId).toBe('stream-run');
    expect(fullOutput.usage.inputTokens).toBe(10);
    expect(runMock).toHaveBeenCalledWith(
      expect.any(OpenAIAgent),
      'Stream prompt',
      expect.objectContaining({
        stream: true,
        maxTurns: 3,
      }),
    );
  });

  it('observes tool call items without changing the generated output', async () => {
    runMock.mockResolvedValueOnce(
      createRunResult({
        finalOutput: 'tool result text',
        newItems: createFunctionToolItems(),
      }),
    );
    const agent = new OpenAISDKAgent({
      id: 'openai-agent',
      description: 'OpenAI',
      sdkOptions: {
        name: 'SDK Agent',
        model: TEST_OPENAI_MODEL,
      },
    });

    const result = await agent.generate('Use the tool');

    expect(result.text).toBe('tool result text');
    expect(result.providerMetadata).toMatchObject({
      openai: {
        itemCount: 2,
      },
    });
  });
});
