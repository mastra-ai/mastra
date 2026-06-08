import type { Query, SDKMessage as ClaudeSDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { SpanType } from '@mastra/core/observability';
import type { Span } from '@mastra/core/observability';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaudeSDKAgent } from './index';

const queryMock = vi.hoisted(() => vi.fn());
const TEST_CLAUDE_MODEL = 'claude-sonnet-4-6';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

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

function createClaudeQuery(messages: ClaudeSDKMessage[]): Query {
  return (async function* () {
    for (const message of messages) {
      yield message;
    }
  })() as Query;
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
      model: TEST_CLAUDE_MODEL,
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

describe('ClaudeSDKAgent observability', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('records generate spans with cost metadata preserved in the output', async () => {
    const rootSpan = createMockSpan();
    queryMock.mockImplementationOnce(() => createClaudeQuery([createClaudeResultMessage('generated text')]));
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      sdkOptions: {
        model: TEST_CLAUDE_MODEL,
      },
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
        model: TEST_CLAUDE_MODEL,
      },
    });
    expect(modelSpan.end).toHaveBeenCalledWith(
      expect.objectContaining({
        output: { text: 'generated text' },
        attributes: expect.objectContaining({
          finishReason: 'stop',
          responseModel: TEST_CLAUDE_MODEL,
          costContext: expect.objectContaining({
            provider: 'anthropic',
            model: TEST_CLAUDE_MODEL,
            estimatedCost: 0.0123,
            costUnit: 'USD',
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

  it('records MCP tool call spans from transcript messages', async () => {
    const rootSpan = createMockSpan();
    queryMock.mockImplementationOnce(() =>
      createClaudeQuery([
        createClaudeToolUseMessage(),
        createClaudeToolResultMessage(),
        createClaudeResultMessage('London: 72F and clear.'),
      ]),
    );
    const agent = new ClaudeSDKAgent({
      id: 'claude-agent',
      description: 'Claude',
      sdkOptions: {
        model: TEST_CLAUDE_MODEL,
      },
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
});
