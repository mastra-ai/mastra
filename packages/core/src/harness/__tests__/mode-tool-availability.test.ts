/**
 * Tests for per-mode tool availability via `mode.availableTools`.
 *
 * When a mode declares `availableTools`, the harness resolves an
 * `activeTools` allowlist at LLM-call time so that only the listed tools
 * are visible to the model and executable at tool-call time.  This matches
 * the existing execution-time enforcement in
 * `packages/core/src/agent/durable/workflows/steps/tool-call.ts`.
 *
 * These tests cover the generic Harness behavior independently of Mastra
 * Code's concrete mode definitions.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { Harness } from '../harness';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerMode } from '../types';

vi.setConfig({ testTimeout: 30_000 });

/** Stream that emits a single tool-call then a finish with `tool-calls`. */
function createToolCallStream(toolName: string, toolCallId = 'call-1') {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId,
        toolName,
        input: '{"value":"test"}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

/** Stream that emits plain text then a finish with `stop`. */
function createTextStream(text = 'Done.') {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-1',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

/** Build a mock model whose first call returns a tool-call and subsequent calls return text. */
function createMockModel(toolName: string) {
  let callCount = 0;
  return new MastraLanguageModelV2Mock({
    doStream: async () => {
      callCount++;
      return { stream: callCount === 1 ? createToolCallStream(toolName) : createTextStream() };
    },
  });
}

function makeTool(id: string, execute?: (...args: any[]) => any) {
  return createTool({
    id,
    description: `Tool ${id}`,
    inputSchema: z.object({ value: z.string() }),
    execute: execute ?? vi.fn().mockResolvedValue(`${id} result`),
  });
}

async function setupHarness({
  modes,
  tools,
  model,
  toolCategoryResolver,
  initialState,
}: {
  modes: AgentControllerMode[];
  tools: Record<string, ReturnType<typeof createTool>>;
  model: MastraLanguageModelV2Mock;
  toolCategoryResolver?: (toolName: string) => 'read' | 'edit' | 'execute' | 'mcp' | 'other' | null;
  initialState?: Record<string, unknown>;
}) {
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a helpful assistant.',
    model,
    tools,
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { 'test-agent': agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent('test-agent');

  const harness = new Harness({
    id: 'test-harness',
    storage,
    agent: registeredAgent,
    modes,
    workspace: createMockWorkspace(),
    ...(toolCategoryResolver && { toolCategoryResolver }),
    ...(initialState && { initialState: initialState as any }),
  });

  await harness.init();
  const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
  await session.thread.create();

  return { harness, session, registeredAgent };
}

describe('Harness: mode availableTools allowlist', () => {
  it('sets activeTools from mode.availableTools in stream options', async () => {
    // Use a text-only stream so we don't trigger tool approval flow.
    const model = new MastraLanguageModelV2Mock({
      doStream: async () => ({ stream: createTextStream() }),
    });

    const { session, registeredAgent } = await setupHarness({
      modes: [
        {
          id: 'restricted',
          name: 'Restricted',
          default: true,
          availableTools: ['allowedTool', 'ask_user'],
        },
      ],
      tools: {
        allowedTool: makeTool('allowedTool'),
        hiddenTool: makeTool('hiddenTool'),
      },
      model,
    });

    const streamSpy = vi.spyOn(registeredAgent, 'stream');
    await session.sendMessage({ content: 'Hello' });

    // stream was called with activeTools matching the mode's allowlist
    const [, streamOptions] = streamSpy.mock.calls[0] as unknown as [any, any];
    expect(streamOptions.activeTools).toEqual(['allowedTool', 'ask_user']);
  });

  it('hides tools not in availableTools at execution time', async () => {
    const model = createMockModel('hiddenTool');
    const hiddenExecute = vi.fn().mockResolvedValue('hidden result');

    const { session } = await setupHarness({
      modes: [
        {
          id: 'restricted',
          name: 'Restricted',
          default: true,
          availableTools: ['allowedTool'],
        },
      ],
      tools: {
        allowedTool: makeTool('allowedTool'),
        hiddenTool: makeTool('hiddenTool', hiddenExecute),
      },
      model,
      // yolo so tool approval is auto-allowed — the hidden tool would execute if not blocked
      initialState: { yolo: true },
    });

    await session.sendMessage({ content: 'Hello' });

    // hiddenTool is not in availableTools → must NOT execute
    expect(hiddenExecute).not.toHaveBeenCalled();
  });

  it('allows tools in availableTools to execute', async () => {
    const model = createMockModel('allowedTool');
    const allowedExecute = vi.fn().mockResolvedValue('allowed result');

    const { session } = await setupHarness({
      modes: [
        {
          id: 'restricted',
          name: 'Restricted',
          default: true,
          availableTools: ['allowedTool'],
        },
      ],
      tools: {
        allowedTool: makeTool('allowedTool', allowedExecute),
        hiddenTool: makeTool('hiddenTool'),
      },
      model,
      initialState: { yolo: true },
    });

    await session.sendMessage({ content: 'Hello' });

    expect(allowedExecute).toHaveBeenCalledOnce();
  });

  it('does not set activeTools when mode has no availableTools', async () => {
    const model = createMockModel('tool1');
    const tool1Execute = vi.fn().mockResolvedValue('result1');

    const { session, registeredAgent } = await setupHarness({
      modes: [{ id: 'open', name: 'Open', default: true }],
      tools: {
        tool1: makeTool('tool1', tool1Execute),
        tool2: makeTool('tool2'),
      },
      model,
      initialState: { yolo: true },
    });

    const streamSpy = vi.spyOn(registeredAgent, 'stream');
    await session.sendMessage({ content: 'Hello' });

    const [, streamOptions] = streamSpy.mock.calls[0] as unknown as [any, any];
    expect(streamOptions.activeTools).toBeUndefined();
  });

  it('per-tool deny removes the tool even if it appears in availableTools', async () => {
    const model = createMockModel('deniedTool');
    const deniedExecute = vi.fn().mockResolvedValue('denied result');

    const { session, registeredAgent } = await setupHarness({
      modes: [
        {
          id: 'restricted',
          name: 'Restricted',
          default: true,
          availableTools: ['allowedTool', 'deniedTool'],
        },
      ],
      tools: {
        allowedTool: makeTool('allowedTool'),
        deniedTool: makeTool('deniedTool', deniedExecute),
      },
      model,
      initialState: {
        yolo: true,
        permissionRules: {
          categories: {},
          tools: { deniedTool: 'deny' },
        },
      },
    });

    const streamSpy = vi.spyOn(registeredAgent, 'stream');
    await session.sendMessage({ content: 'Hello' });

    expect(streamSpy).toHaveBeenCalled();

    // Per-tool deny is handled by buildToolsets — the denied tool is deleted
    // from the toolsets entirely.  activeTools may still list the name, but
    // the tool cannot execute because it doesn't exist in the toolsets.
    // Verify the denied tool did NOT execute.
    expect(deniedExecute).not.toHaveBeenCalled();
  });

  it('category deny filters tools from activeTools', async () => {
    const model = createMockModel('editTool');
    const editExecute = vi.fn().mockResolvedValue('edit result');

    const { session, registeredAgent } = await setupHarness({
      modes: [
        {
          id: 'restricted',
          name: 'Restricted',
          default: true,
          availableTools: ['readTool', 'editTool'],
        },
      ],
      tools: {
        readTool: makeTool('readTool'),
        editTool: makeTool('editTool', editExecute),
      },
      model,
      toolCategoryResolver: (toolName: string) => {
        if (toolName === 'readTool') return 'read' as const;
        if (toolName === 'editTool') return 'edit' as const;
        return 'other' as const;
      },
      initialState: {
        yolo: true,
        permissionRules: {
          categories: { edit: 'deny' },
          tools: {},
        },
      },
    });

    const streamSpy = vi.spyOn(registeredAgent, 'stream');
    await session.sendMessage({ content: 'Hello' });

    const [, streamOptions] = streamSpy.mock.calls[0] as unknown as [any, any];

    // The 'edit' category is denied, so editTool must be filtered out of
    // activeTools even though it appears in the mode's availableTools list.
    expect(streamOptions.activeTools).toEqual(['readTool']);

    // editTool must not execute
    expect(editExecute).not.toHaveBeenCalled();
  });
});
