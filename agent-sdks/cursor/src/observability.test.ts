import type { InteractionUpdate, ModelSelection, Run, SDKAgent } from '@cursor/sdk';
import { SpanType } from '@mastra/core/observability';
import type { Span } from '@mastra/core/observability';
import { describe, expect, it, vi } from 'vitest';

import { CursorSDKAgent } from './index';

vi.mock('@cursor/sdk', () => ({
  Agent: {
    create: vi.fn(),
  },
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
  model = { id: '__GATEWAY_OPENAI_MODEL__' },
  result = 'Cursor SDK result',
}: {
  id?: string;
  model?: ModelSelection;
  result?: string;
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
    stream: async function* () {},
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
    model: { id: '__GATEWAY_OPENAI_MODEL__' },
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

describe('CursorSDKAgent observability', () => {
  it('records generate spans with usage on the model generation span', async () => {
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
    expect(modelSpan.end).toHaveBeenCalledWith(
      expect.objectContaining({
        output: { text: 'generated text' },
        attributes: expect.objectContaining({
          finishReason: 'stop',
          responseId: 'cursor-generate-run',
          responseModel: '__GATEWAY_OPENAI_MODEL__',
          usage: expect.objectContaining({
            inputTokens: 15,
            outputTokens: 4,
          }),
        }),
      }),
    );
    expect(agentSpan.end).toHaveBeenCalledWith({ output: { text: 'generated text' } });
  });

  it('records MCP tool call spans from interaction updates', async () => {
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
});
