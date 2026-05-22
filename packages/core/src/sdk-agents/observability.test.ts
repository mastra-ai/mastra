import type { Query, SDKMessage as ClaudeSDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { InteractionUpdate, ModelSelection, Run, SDKAgent, SDKMessage as CursorSDKMessage } from '@cursor/sdk';
import { describe, expect, it, vi } from 'vitest';

import { SpanType } from '../observability';
import type { Span } from '../observability';
import { ClaudeSDKAgent } from './claude';
import type { ClaudeQueryFunction } from './claude';
import { CursorSDKAgent } from './cursor';

type MockSpan = Span<SpanType> & {
  options: Record<string, unknown>;
  children: MockSpan[];
  end: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  createChildSpan: ReturnType<typeof vi.fn>;
};

function createMockSpan(
  type: SpanType = SpanType.AGENT_RUN,
  parent?: MockSpan,
  options: Record<string, unknown> = {},
): MockSpan {
  const span = {
    id: `${type}-${Math.random().toString(16).slice(2)}`,
    type,
    name: String(options.name ?? type),
    options,
    children: [],
    isInternal: false,
    isEvent: false,
    isValid: true,
    parent,
    observabilityInstance: {},
    externalTraceId: 'trace-id',
    startTime: new Date(),
    end: vi.fn(),
    error: vi.fn(),
    update: vi.fn(),
    createEventSpan: vi.fn(),
    get isRootSpan() {
      return !parent;
    },
    getParentSpanId: vi.fn(() => parent?.id),
    findParent: vi.fn(),
    exportSpan: vi.fn(),
    executeInContext: vi.fn(async fn => fn()),
    executeInContextSync: vi.fn(fn => fn()),
    createChildSpan: vi.fn((childOptions: Record<string, unknown>) => {
      const child = createMockSpan(childOptions.type as SpanType, span as MockSpan, childOptions);
      span.children.push(child);
      return child;
    }),
  } as unknown as MockSpan;

  return span;
}

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

function createCursorToolStartedUpdate(): InteractionUpdate {
  return {
    type: 'tool-call-started',
    callId: 'cursor-weather-call',
    toolCall: {
      type: 'mcp',
      args: {
        providerIdentifier: 'weather',
        toolName: 'get_temperature',
        args: {
          location: 'London',
        },
      },
    },
  } as InteractionUpdate;
}

function createCursorToolCompletedUpdate(): InteractionUpdate {
  return {
    type: 'tool-call-completed',
    callId: 'cursor-weather-call',
    toolCall: {
      type: 'mcp',
      args: {
        providerIdentifier: 'weather',
        toolName: 'get_temperature',
        args: {
          location: 'London',
        },
      },
      result: {
        status: 'success',
        value: {
          content: [
            {
              type: 'text',
              text: 'London: 72F and clear.',
            },
          ],
        },
      },
    },
  } as InteractionUpdate;
}

function createCursorRun({
  id = 'cursor-run',
  model = { id: 'gpt-5.5' },
  result = 'Cursor SDK result',
  streamMessages = [],
}: {
  id?: string;
  model?: ModelSelection;
  result?: string;
  streamMessages?: CursorSDKMessage[];
} = {}): Run {
  return {
    id,
    agentId: 'cursor-sdk-agent',
    status: 'finished',
    result,
    model,
    durationMs: 25,
    supports: operation => operation === 'stream',
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

function createCursorSDKAgent(run: Run, updates: InteractionUpdate[] = [createTurnEndedUpdate()]): SDKAgent {
  return {
    agentId: 'cursor-sdk-agent',
    model: { id: 'gpt-5.5' },
    send: vi.fn(async (_message: string, options?: { onDelta?: (args: { update: InteractionUpdate }) => void }) => {
      for (const update of updates) {
        await options?.onDelta?.({ update });
      }
      return run;
    }),
    close: vi.fn(),
    reload: vi.fn(async () => undefined),
    [Symbol.asyncDispose]: vi.fn(async () => undefined),
    listArtifacts: vi.fn(async () => []),
    downloadArtifact: vi.fn(async () => Buffer.from('')),
  } as unknown as SDKAgent;
}

function createCursorTaskMessage(text: string): CursorSDKMessage {
  return {
    type: 'task',
    text,
  } as CursorSDKMessage;
}

function createClaudeQuery(messages: ClaudeSDKMessage[]): Query {
  return (async function* () {
    for (const message of messages) {
      yield message;
    }
  })() as Query;
}

function createClaudeStreamEvent(text: string): ClaudeSDKMessage {
  return {
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: {
        type: 'text_delta',
        text,
      },
    },
  } as ClaudeSDKMessage;
}

function createClaudeResultMessage(result: string): ClaudeSDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    duration_ms: 25,
    duration_api_ms: 20,
    is_error: false,
    num_turns: 1,
    result,
    stop_reason: 'end_turn',
    total_cost_usd: 0.0123,
    usage: {
      input_tokens: 10,
      output_tokens: 4,
      cache_read_input_tokens: 2,
      cache_creation_input_tokens: 3,
    },
    permission_denials: [],
    uuid: 'message-uuid',
    session_id: 'session-id',
  } as ClaudeSDKMessage;
}

function createClaudeToolUseMessage(): ClaudeSDKMessage {
  return {
    type: 'assistant',
    message: {
      id: 'assistant-tool-message',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu-weather',
          name: 'mcp__weather__get_temperature',
          input: {
            location: 'London',
          },
        },
      ],
      model: 'claude-sonnet-4-6',
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 1,
        output_tokens: 1,
      },
    },
    parent_tool_use_id: null,
    uuid: 'assistant-tool-uuid',
    session_id: 'session-id',
  } as ClaudeSDKMessage;
}

function createClaudeToolResultMessage(): ClaudeSDKMessage {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu-weather',
          content: [
            {
              type: 'text',
              text: 'London: 72F and clear.',
            },
          ],
        },
      ],
    },
    parent_tool_use_id: null,
    uuid: 'user-tool-result-uuid',
    session_id: 'session-id',
  } as ClaudeSDKMessage;
}

describe('SDK agent observability', () => {
  it('records Cursor generate spans with usage on the model generation span', async () => {
    const rootSpan = createMockSpan();
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      name: 'Cursor Agent',
      description: 'Cursor',
      agent: createCursorSDKAgent(createCursorRun({ id: 'cursor-generate-run', result: 'generated text' })),
    });

    const result = await agent.generate('Generate prompt', {
      runId: 'mastra-run',
      tracingContext: { currentSpan: rootSpan },
    });

    const agentSpan = rootSpan.children[0];
    const modelSpan = agentSpan.children[0];

    expect(result.text).toBe('generated text');
    expect(agentSpan.options).toMatchObject({
      type: SpanType.AGENT_RUN,
      entityId: 'cursor-agent',
      entityName: 'Cursor Agent',
      metadata: {
        runId: 'mastra-run',
        sdkAgent: true,
        sdkProvider: '@cursor/sdk',
        sdkMethod: 'generate',
      },
    });
    expect(modelSpan.options).toMatchObject({
      type: SpanType.MODEL_GENERATION,
      attributes: {
        model: 'gpt-5.5',
        provider: '@cursor/sdk',
        streaming: false,
      },
      metadata: {
        runId: 'mastra-run',
        sdkAgent: true,
        sdkProvider: '@cursor/sdk',
        sdkMethod: 'generate',
      },
    });
    expect(modelSpan.end).toHaveBeenCalledWith(
      expect.objectContaining({
        output: { text: 'generated text' },
        attributes: expect.objectContaining({
          finishReason: 'stop',
          responseId: 'cursor-generate-run',
          responseModel: 'gpt-5.5',
          usage: {
            inputTokens: 15,
            outputTokens: 4,
            inputDetails: {
              cacheRead: 2,
              cacheWrite: 3,
            },
            outputDetails: {
              text: 4,
              reasoning: undefined,
            },
          },
        }),
      }),
    );
    expect(agentSpan.end).toHaveBeenCalledWith({ output: { text: 'generated text' } });
  });

  it('records Cursor stream spans after the stream finishes', async () => {
    const rootSpan = createMockSpan();
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: createCursorSDKAgent(
        createCursorRun({
          id: 'cursor-stream-run',
          result: 'streamed text',
          streamMessages: [createCursorTaskMessage('streamed '), createCursorTaskMessage('text')],
        }),
      ),
    });

    const stream = await agent.stream('Stream prompt', {
      runId: 'stream-run',
      tracingContext: { currentSpan: rootSpan },
    });
    for await (const _chunk of stream.fullStream) {
      // consume the stream to completion
    }

    const agentSpan = rootSpan.children[0];
    const modelSpan = agentSpan.children[0];

    expect(await stream.text).toBe('streamed text');
    expect(modelSpan.end).toHaveBeenCalledWith(
      expect.objectContaining({
        output: { text: 'streamed text' },
        attributes: expect.objectContaining({
          finishReason: 'stop',
          responseId: 'cursor-stream-run',
          responseModel: 'gpt-5.5',
          usage: expect.objectContaining({
            inputTokens: 15,
            outputTokens: 4,
          }),
        }),
      }),
    );
    expect(agentSpan.end).toHaveBeenCalledWith({ output: { text: 'streamed text' } });
  });

  it('records Cursor SDK MCP tool call spans from interaction updates', async () => {
    const rootSpan = createMockSpan();
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: createCursorSDKAgent(
        createCursorRun({
          id: 'cursor-tool-run',
          result: 'London: 72F and clear.',
        }),
        [createCursorToolStartedUpdate(), createCursorToolCompletedUpdate(), createTurnEndedUpdate()],
      ),
    });

    const result = await agent.generate('Use the weather tool', {
      runId: 'cursor-tool-run',
      tracingContext: { currentSpan: rootSpan },
    });

    const agentSpan = rootSpan.children[0];
    const toolSpan = agentSpan.children.find(span => span.options.type === SpanType.MCP_TOOL_CALL);

    expect(result.text).toBe('London: 72F and clear.');
    expect(toolSpan?.options).toMatchObject({
      type: SpanType.MCP_TOOL_CALL,
      name: "mcp_tool: 'mcp__weather__get_temperature' on 'weather'",
      input: {
        location: 'London',
      },
      entityId: 'mcp__weather__get_temperature',
      entityName: 'mcp__weather__get_temperature',
      attributes: {
        mcpServer: 'weather',
      },
      metadata: {
        runId: 'cursor-tool-run',
        sdkAgent: true,
        sdkProvider: '@cursor/sdk',
        sdkMethod: 'generate',
        toolCallId: 'cursor-weather-call',
      },
    });
    expect(toolSpan?.end).toHaveBeenCalledWith({
      output: {
        content: [
          {
            type: 'text',
            text: 'London: 72F and clear.',
          },
        ],
      },
      attributes: { success: true },
    });
  });

  it('marks Cursor generate spans as errored when the SDK send fails', async () => {
    const rootSpan = createMockSpan();
    const sdkError = new Error('Cursor SDK failed');
    const sdkAgent = {
      agentId: 'cursor-sdk-agent',
      send: vi.fn(async () => {
        throw sdkError;
      }),
    } as unknown as SDKAgent;
    const agent = new CursorSDKAgent({
      id: 'cursor-agent',
      description: 'Cursor',
      agent: sdkAgent,
    });

    await expect(
      agent.generate('Generate prompt', {
        runId: 'failed-run',
        tracingContext: { currentSpan: rootSpan },
      }),
    ).rejects.toThrow('Cursor SDK failed');

    const agentSpan = rootSpan.children[0];
    const modelSpan = agentSpan.children[0];

    expect(modelSpan.error).toHaveBeenCalledWith({ error: sdkError });
    expect(agentSpan.error).toHaveBeenCalledWith({ error: sdkError });
    expect(modelSpan.end).not.toHaveBeenCalled();
    expect(agentSpan.end).not.toHaveBeenCalled();
  });

  it('records Claude generate spans with cost metadata preserved in the output', async () => {
    const rootSpan = createMockSpan();
    const query = vi.fn<ClaudeQueryFunction>(() => createClaudeQuery([createClaudeResultMessage('generated text')]));
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      agent: query,
      model: 'claude-sonnet-4-6',
    });

    const result = await agent.generate('Generate prompt', {
      runId: 'mastra-run',
      tracingContext: { currentSpan: rootSpan },
    });

    const agentSpan = rootSpan.children[0];
    const modelSpan = agentSpan.children[0];

    expect(result.providerMetadata).toMatchObject({
      claude: {
        totalCostUsd: 0.0123,
        model: 'claude-sonnet-4-6',
      },
    });
    expect(modelSpan.end).toHaveBeenCalledWith(
      expect.objectContaining({
        output: { text: 'generated text' },
        attributes: expect.objectContaining({
          finishReason: 'stop',
          responseModel: 'claude-sonnet-4-6',
          costContext: expect.objectContaining({
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            estimatedCost: 0.0123,
            costUnit: 'USD',
            costMetadata: expect.objectContaining({
              source: 'sdk_estimate',
              sdkProvider: '@anthropic-ai/claude-agent-sdk',
              sdkCostField: 'total_cost_usd',
              scope: 'query_total',
            }),
          }),
          usage: expect.objectContaining({
            inputTokens: 15,
            outputTokens: 4,
          }),
        }),
      }),
    );
    expect(agentSpan.end).toHaveBeenCalledWith({ output: { text: 'generated text' } });
  });

  it('records Claude SDK MCP tool call spans from transcript messages', async () => {
    const rootSpan = createMockSpan();
    const query = vi.fn<ClaudeQueryFunction>(() =>
      createClaudeQuery([
        createClaudeToolUseMessage(),
        createClaudeToolResultMessage(),
        createClaudeResultMessage('London: 72F and clear.'),
      ]),
    );
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      agent: query,
      model: 'claude-sonnet-4-6',
    });

    const result = await agent.generate('Use the weather tool', {
      runId: 'tool-run',
      tracingContext: { currentSpan: rootSpan },
    });

    const agentSpan = rootSpan.children[0];
    const toolSpan = agentSpan.children.find(span => span.options.type === SpanType.MCP_TOOL_CALL);

    expect(result.text).toBe('London: 72F and clear.');
    expect(toolSpan?.options).toMatchObject({
      type: SpanType.MCP_TOOL_CALL,
      name: "mcp_tool: 'mcp__weather__get_temperature' on 'weather'",
      input: {
        location: 'London',
      },
      entityId: 'mcp__weather__get_temperature',
      entityName: 'mcp__weather__get_temperature',
      attributes: {
        mcpServer: 'weather',
      },
      metadata: {
        runId: 'tool-run',
        sdkAgent: true,
        sdkProvider: '@anthropic-ai/claude-agent-sdk',
        sdkMethod: 'generate',
        toolCallId: 'toolu-weather',
      },
    });
    expect(toolSpan?.end).toHaveBeenCalledWith({
      output: [
        {
          type: 'text',
          text: 'London: 72F and clear.',
        },
      ],
      attributes: { success: true },
    });
  });

  it('records Claude stream spans after the stream finishes', async () => {
    const rootSpan = createMockSpan();
    const query = vi.fn<ClaudeQueryFunction>(() =>
      createClaudeQuery([
        createClaudeStreamEvent('streamed '),
        createClaudeStreamEvent('text'),
        createClaudeResultMessage('streamed text'),
      ]),
    );
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      agent: query,
      model: 'claude-sonnet-4-6',
    });

    const stream = await agent.stream('Stream prompt', {
      runId: 'stream-run',
      tracingContext: { currentSpan: rootSpan },
    });
    for await (const _chunk of stream.fullStream) {
      // consume the stream to completion
    }

    const agentSpan = rootSpan.children[0];
    const modelSpan = agentSpan.children[0];

    expect(await stream.text).toBe('streamed text');
    expect(modelSpan.end).toHaveBeenCalledWith(
      expect.objectContaining({
        output: { text: 'streamed text' },
        attributes: expect.objectContaining({
          finishReason: 'stop',
          responseModel: 'claude-sonnet-4-6',
          costContext: expect.objectContaining({
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            estimatedCost: 0.0123,
            costUnit: 'USD',
            costMetadata: expect.objectContaining({
              source: 'sdk_estimate',
              sdkProvider: '@anthropic-ai/claude-agent-sdk',
              sdkCostField: 'total_cost_usd',
              scope: 'query_total',
            }),
          }),
          usage: expect.objectContaining({
            inputTokens: 15,
            outputTokens: 4,
          }),
        }),
      }),
    );
    expect(agentSpan.end).toHaveBeenCalledWith({ output: { text: 'streamed text' } });
  });

  it('marks Claude stream spans as errored when the SDK stream fails', async () => {
    const rootSpan = createMockSpan();
    const query = vi.fn<ClaudeQueryFunction>(() =>
      createClaudeQuery([
        {
          type: 'result',
          subtype: 'error_during_execution',
          errors: ['Claude stream failed'],
          duration_ms: 25,
          duration_api_ms: 20,
          is_error: true,
          num_turns: 1,
          total_cost_usd: 0.0123,
          permission_denials: [],
          uuid: 'message-uuid',
          session_id: 'session-id',
        } as ClaudeSDKMessage,
      ]),
    );
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      agent: query,
      model: 'claude-sonnet-4-6',
    });

    const stream = await agent.stream('Stream prompt', {
      runId: 'failed-stream-run',
      tracingContext: { currentSpan: rootSpan },
    });
    await expect(stream.text).rejects.toThrow('Claude stream failed');
    await stream.consumeStream().catch(() => undefined);

    const agentSpan = rootSpan.children[0];
    const modelSpan = agentSpan.children[0];

    expect(modelSpan.error).toHaveBeenCalledWith({
      error: expect.objectContaining({ message: 'Claude stream failed' }),
    });
    expect(agentSpan.error).toHaveBeenCalledWith({
      error: expect.objectContaining({ message: 'Claude stream failed' }),
    });
    expect(modelSpan.end).not.toHaveBeenCalled();
    expect(agentSpan.end).not.toHaveBeenCalled();
  });
});
