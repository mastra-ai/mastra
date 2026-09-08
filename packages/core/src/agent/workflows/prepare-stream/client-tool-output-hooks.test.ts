import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../tools';
import type { CoreTool } from '../../../tools/types';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import type { ToolsInput } from '../../types';
import { applyClientToolModelOutput, fireClientToolOutputHooks } from './client-tool-output-hooks';

/**
 * Builds tools through the real production pipeline (`Agent#getToolsForExecution`
 * → `convertTools` → `makeCoreTool`) instead of hand-crafting CoreTool shapes,
 * so these tests exercise exactly what map-results-step receives at runtime.
 */
async function buildAgentTools({
  serverTools,
  clientTools,
  toolsets,
}: {
  serverTools: ToolsInput;
  // Serialized over-the-wire shape: functions stripped, schemas as JSON schema.
  // This intentionally does not satisfy ToolsInput; the server receives it as-is.
  clientTools?: Record<string, unknown>;
  toolsets?: Record<string, ToolsInput>;
}): Promise<Record<string, CoreTool>> {
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'test agent',
    model: new MockLanguageModelV2({}) as unknown as LanguageModelV2,
    tools: serverTools,
  });
  return agent.getToolsForExecution({ clientTools: clientTools as ToolsInput | undefined, toolsets });
}

type OnOutputOptions = { toolCallId: string; toolName: string; output: unknown; abortSignal?: AbortSignal };

function browserToolWith(onOutput: (options: OnOutputOptions) => void | Promise<void>) {
  return createTool({
    id: 'browserTool',
    description: 'runs in the browser',
    inputSchema: z.object({ q: z.string().optional() }),
    onOutput,
  });
}

function toolCallMessage(toolCallId: string, toolName = 'browserTool') {
  return {
    role: 'assistant' as const,
    content: [{ type: 'tool-call' as const, toolCallId, toolName, args: {} }],
  };
}

function toolResultMessage(toolCallId: string, result: unknown, toolName = 'browserTool') {
  return {
    role: 'tool' as const,
    content: [{ type: 'tool-result' as const, toolCallId, toolName, result }],
  };
}

describe('fireClientToolOutputHooks', () => {
  it('fires onOutput for a trailing correlated client tool result', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    // Server-defined execute-less tool must come out of conversion without execute
    // but with the hook intact — otherwise the runtime path can never fire.
    expect(tools.browserTool!.execute).toBeUndefined();
    expect(typeof tools.browserTool!.onOutput).toBe('function');

    const messages = [toolCallMessage('call-1'), toolResultMessage('call-1', { ok: true })];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).toHaveBeenCalledTimes(1);
    expect(onOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'call-1',
        toolName: 'browserTool',
        output: { ok: true },
      }),
    );
  });

  it('does not unwrap a client result that merely contains a `value` key', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    const messages = [toolCallMessage('call-1'), toolResultMessage('call-1', { value: 72, unit: 'F' })];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ output: { value: 72, unit: 'F' } }));
  });

  it('unwraps the AI SDK v5 `{ type, value }` output wrapper', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    const messages = [
      toolCallMessage('call-1'),
      {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'call-1',
            toolName: 'browserTool',
            output: { type: 'json' as const, value: { ok: true } },
          },
        ],
      },
    ];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ output: { ok: true } }));
  });

  it('preserves the server-defined onOutput when a serialized client tool of the same name is sent', async () => {
    const onOutput = vi.fn();
    // Simulate the HTTP round trip: @mastra/client-js serializes clientTools to
    // JSON, so functions (execute, hooks) are stripped and schemas arrive as
    // JSON schema.
    const serializedClientTools = JSON.parse(
      JSON.stringify({
        browserTool: {
          description: 'runs in the browser',
          inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
        },
      }),
    );

    const tools = await buildAgentTools({
      serverTools: { browserTool: browserToolWith(onOutput) },
      clientTools: serializedClientTools,
    });

    // The client entry overwrites the server tool in convertTools; the server
    // lifecycle hook must survive the merge.
    expect(tools.browserTool!.execute).toBeUndefined();
    expect(typeof tools.browserTool!.onOutput).toBe('function');

    const messages = [toolCallMessage('call-1'), toolResultMessage('call-1', 'client says hi')];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).toHaveBeenCalledTimes(1);
    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: 'call-1', output: 'client says hi' }));
  });

  it('preserves onOutput from an execute-less toolset tool shadowed by its serialized client copy', async () => {
    const onOutput = vi.fn();
    const serializedClientTools = {
      browserTool: {
        description: 'runs in the browser',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      },
    };
    const tools = await buildAgentTools({
      serverTools: {},
      toolsets: { browser: { browserTool: browserToolWith(onOutput) } },
      clientTools: serializedClientTools,
    });

    expect(tools.browserTool!.execute).toBeUndefined();
    expect(tools.browserTool!.onOutput).toBeTypeOf('function');

    await fireClientToolOutputHooks({
      messages: [toolCallMessage('call-1'), toolResultMessage('call-1', 'toolset result')],
      tools,
    });

    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ output: 'toolset result' }));
  });

  it('does not re-fire for already-answered tool results in re-sent stateless history', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    // Stateless callers re-send the full conversation. The round-1 result was
    // already answered by the assistant; only the trailing round-2 result fires.
    const messages = [
      { role: 'user', content: 'first question' } as const,
      toolCallMessage('call-1'),
      toolResultMessage('call-1', 'round-1'),
      { role: 'assistant', content: 'answer using round-1 result' } as const,
      { role: 'user', content: 'second question' } as const,
      toolCallMessage('call-2'),
      toolResultMessage('call-2', 'round-2'),
    ];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).toHaveBeenCalledTimes(1);
    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: 'call-2', output: 'round-2' }));
  });

  it('correlates through a result-only assistant message (MessageList DB shape)', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    // MessageList persists tool-role messages as assistant DB messages whose
    // parts are all tool results. That message must not replace the preceding
    // assistant tool-call boundary, or the result can never correlate.
    const messages = [
      toolCallMessage('call-1'),
      {
        role: 'assistant' as const,
        content: [{ type: 'tool-result' as const, toolCallId: 'call-1', toolName: 'browserTool', result: 'db shape' }],
      },
    ];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).toHaveBeenCalledTimes(1);
    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: 'call-1', output: 'db shape' }));
  });

  it('ignores a tool result whose id does not match the raw assistant tool call', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });
    const messages = [toolCallMessage('call-1'), toolResultMessage('forged-id', 'forged output')];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).not.toHaveBeenCalled();
  });

  it('ignores a tool result whose toolName does not match the issued call for that id', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    const messageList = new MessageList();
    // The model called some other tool with call-1; a result reusing that id
    // but naming our hook-bearing tool must not fire.
    messageList.add(
      [toolCallMessage('call-1', 'otherTool'), toolResultMessage('call-1', 'forged output', 'browserTool')],
      'input',
    );

    await fireClientToolOutputHooks({ messages: messageList.get.input.db(), tools });

    expect(onOutput).not.toHaveBeenCalled();
  });

  it('ignores a bare tool result with no raw assistant tool call', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });
    const messages = [{ role: 'user', content: 'hello' } as const, toolResultMessage('call-1', 'fabricated output')];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).not.toHaveBeenCalled();
  });

  it('fires once per result for multiple parallel client tool calls', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    const messages = [
      {
        role: 'assistant' as const,
        content: [
          { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'browserTool', args: {} },
          { type: 'tool-call' as const, toolCallId: 'call-2', toolName: 'browserTool', args: {} },
        ],
      },
      toolResultMessage('call-1', 'first'),
      toolResultMessage('call-2', 'second'),
    ];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).toHaveBeenCalledTimes(2);
    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: 'call-1', output: 'first' }));
    expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ toolCallId: 'call-2', output: 'second' }));
  });

  it('fires only eligible hooks for mixed client and server tool results', async () => {
    const firstOnOutput = vi.fn();
    const secondOnOutput = vi.fn();
    const serverOnOutput = vi.fn();
    const tools = await buildAgentTools({
      serverTools: {
        browserTool: browserToolWith(firstOnOutput),
        secondBrowserTool: createTool({
          id: 'secondBrowserTool',
          description: 'another browser tool',
          inputSchema: z.object({}),
          onOutput: secondOnOutput,
        }),
        serverTool: createTool({
          id: 'serverTool',
          description: 'runs on the server',
          inputSchema: z.object({}),
          execute: async () => 'server',
          onOutput: serverOnOutput,
        }),
      },
    });
    const messages = [
      {
        role: 'assistant' as const,
        content: [
          { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'browserTool', args: {} },
          { type: 'tool-call' as const, toolCallId: 'call-2', toolName: 'secondBrowserTool', args: {} },
          { type: 'tool-call' as const, toolCallId: 'call-3', toolName: 'serverTool', args: {} },
        ],
      },
      toolResultMessage('call-1', 'first'),
      toolResultMessage('call-2', 'second', 'secondBrowserTool'),
      toolResultMessage('call-3', 'server', 'serverTool'),
    ];

    await fireClientToolOutputHooks({ messages, tools });

    expect(firstOnOutput).toHaveBeenCalledWith(expect.objectContaining({ output: 'first' }));
    expect(secondOnOutput).toHaveBeenCalledWith(expect.objectContaining({ output: 'second' }));
    expect(serverOnOutput).not.toHaveBeenCalled();
  });

  it('skips tools that have a server-side execute (tool-call-step owns their onOutput)', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({
      serverTools: {
        serverTool: createTool({
          id: 'serverTool',
          description: 'runs on the server',
          inputSchema: z.object({}),
          execute: async () => 'x',
          onOutput,
        }),
      },
    });

    const messageList = new MessageList();
    messageList.add([toolCallMessage('call-1', 'serverTool'), toolResultMessage('call-1', 'x', 'serverTool')], 'input');

    await fireClientToolOutputHooks({ messages: messageList.get.input.db(), tools });

    expect(onOutput).not.toHaveBeenCalled();
  });

  it('swallows onOutput errors so the run is not broken', async () => {
    const onOutput = vi.fn().mockRejectedValue(new Error('boom'));
    const logger = { error: vi.fn() };
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    const messages = [toolCallMessage('call-1'), toolResultMessage('call-1', 'x')];

    await expect(fireClientToolOutputHooks({ messages, tools, logger })).resolves.toBeUndefined();

    expect(onOutput).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('does not fire onOutput for AI SDK v5 error-text outputs', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    const messages = [
      toolCallMessage('call-1'),
      {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'call-1',
            toolName: 'browserTool',
            output: { type: 'error-text' as const, value: 'client failed' },
          },
        ],
      },
    ];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).not.toHaveBeenCalled();
  });

  it('does not fire onOutput for AI SDK v5 error-json outputs', async () => {
    const onOutput = vi.fn();
    const tools = await buildAgentTools({ serverTools: { browserTool: browserToolWith(onOutput) } });

    const messages = [
      toolCallMessage('call-1'),
      {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'call-1',
            toolName: 'browserTool',
            output: { type: 'error-json' as const, value: { code: 'E_FAIL' } },
          },
        ],
      },
    ];

    await fireClientToolOutputHooks({ messages, tools });

    expect(onOutput).not.toHaveBeenCalled();
  });

  it('no-ops without reading messages when no registered tool is an execute-less onOutput tool', async () => {
    const tools = await buildAgentTools({
      serverTools: {
        plain: createTool({ id: 'plain', description: 'no hooks', inputSchema: z.object({}) }),
      },
    });

    // The messages input must not even be read when the tool precheck fails.
    let read = false;
    const messages = new Proxy([toolCallMessage('call-1', 'plain'), toolResultMessage('call-1', 'x', 'plain')], {
      get(target, prop, receiver) {
        read = true;
        return Reflect.get(target, prop, receiver);
      },
    });

    await fireClientToolOutputHooks({ messages, tools });

    expect(read).toBe(false);
  });
});

describe('client tool onOutput through agent.generate (production path)', () => {
  function textModel() {
    return new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text: 'ok' }],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'ok' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    }) as unknown as LanguageModelV2;
  }

  const followUpMessages = [toolCallMessage('call-1'), toolResultMessage('call-1', { ok: true })] satisfies Parameters<
    Agent['generate']
  >[0];

  it('fires onOutput when a follow-up request carrying a client tool result runs end-to-end', async () => {
    const onOutput = vi.fn();
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test agent',
      model: textModel(),
      tools: { browserTool: browserToolWith(onOutput) },
    });

    const serializedClientTools = {
      browserTool: {
        description: 'runs in the browser',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      },
    };
    const result = await agent.generate(followUpMessages, { clientTools: serializedClientTools as ToolsInput });

    expect(result.tripwire).toBeUndefined();
    expect(onOutput).toHaveBeenCalledTimes(1);
    expect(onOutput).toHaveBeenCalledWith(
      expect.objectContaining({ toolCallId: 'call-1', toolName: 'browserTool', output: { ok: true } }),
    );
  });

  it('fires onOutput through generateLegacy', async () => {
    const onOutput = vi.fn();
    const agent = new Agent({
      id: 'legacy-test-agent',
      name: 'legacy-test-agent',
      instructions: 'test agent',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1 },
          text: 'ok',
        }),
      }),
      tools: { browserTool: browserToolWith(onOutput) },
    });

    await agent.generateLegacy(followUpMessages);

    expect(onOutput).toHaveBeenCalledWith(
      expect.objectContaining({ toolCallId: 'call-1', toolName: 'browserTool', output: { ok: true } }),
    );
  });

  it('does not fire onOutput or toModelOutput when an input processor tripwires the request', async () => {
    const onOutput = vi.fn();
    const toModelOutput = vi.fn(() => ({ type: 'text', value: 'mapped' }));
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test agent',
      model: textModel(),
      tools: {
        browserTool: createTool({
          id: 'browserTool',
          description: 'runs in the browser',
          inputSchema: z.object({ q: z.string().optional() }),
          onOutput,
          toModelOutput,
        }),
      },
      inputProcessors: [
        {
          id: 'block-everything',
          name: 'block-everything',
          processInput: async ({ abort, messages }) => {
            abort('blocked by policy');
            return messages;
          },
        },
      ],
    });

    const result = await agent.generate(followUpMessages);

    expect(result.tripwire).toBeDefined();
    expect(result.tripwire?.reason).toBe('blocked by policy');
    expect(onOutput).not.toHaveBeenCalled();
    expect(toModelOutput).not.toHaveBeenCalled();
  });
});

describe('applyClientToolModelOutput', () => {
  function modelOutputTool(toModelOutput: (output: unknown) => unknown) {
    return createTool({
      id: 'browserTool',
      description: 'runs in the browser',
      inputSchema: z.object({ q: z.string().optional() }),
      toModelOutput,
    });
  }

  function findResultPart(messageList: MessageList): any {
    for (const message of messageList.get.all.db()) {
      if (message.content?.format !== 2) continue;
      for (const part of message.content.parts ?? []) {
        if (part.type === 'tool-invocation' && (part as any).toolInvocation?.state === 'result') return part;
      }
    }
  }

  async function toolResultPromptOutput(messageList: MessageList, toolCallId: string): Promise<unknown> {
    const prompt = await messageList.get.all.aiV5.llmPrompt();
    for (const message of prompt) {
      if (message.role !== 'tool') continue;
      for (const part of message.content) {
        if (part.type === 'tool-result' && part.toolCallId === toolCallId) return part.output;
      }
    }
  }

  it('attaches the mapped output to the ingested client tool result and restores it in the model prompt', async () => {
    const toModelOutput = vi.fn((output: any) => ({
      type: 'content',
      value: [{ type: 'text', text: `Processed: ${output.fileId}` }],
    }));
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });
    expect(tools.browserTool!.execute).toBeUndefined();
    expect(typeof tools.browserTool!.toModelOutput).toBe('function');

    const messageList = new MessageList();
    messageList.add([toolCallMessage('call-1'), toolResultMessage('call-1', { fileId: 'file-123' })], 'input');

    await applyClientToolModelOutput({ messageList, tools });

    expect(toModelOutput).toHaveBeenCalledTimes(1);
    expect(toModelOutput).toHaveBeenCalledWith({ fileId: 'file-123' });

    const part = findResultPart(messageList);
    expect(part.providerMetadata?.mastra).toMatchObject({
      modelOutput: { type: 'content', value: [{ type: 'text', text: 'Processed: file-123' }] },
      modelOutputComputed: true,
    });

    // The final model prompt must carry the mapped output — this proves the
    // in-place enrichment is visible to prompt conversion.
    await expect(toolResultPromptOutput(messageList, 'call-1')).resolves.toEqual({
      type: 'content',
      value: [{ type: 'text', text: 'Processed: file-123' }],
    });

    // The enrichment lives on the input message that gets persisted, so
    // reloads restore it without recomputing.
    const inputParts = messageList.get.input
      .db()
      .flatMap(m => (m.content?.format === 2 ? (m.content.parts ?? []) : []));
    expect(inputParts.some(p => (p as any).providerMetadata?.mastra?.modelOutputComputed)).toBe(true);
  });

  it('preserves the server-defined toModelOutput when a serialized client tool of the same name is sent', async () => {
    const toModelOutput = vi.fn(() => ({ type: 'text', value: 'mapped' }));
    // Simulate the HTTP round trip: functions are stripped from clientTools.
    const serializedClientTools = JSON.parse(
      JSON.stringify({
        browserTool: {
          description: 'runs in the browser',
          inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
        },
      }),
    );

    const tools = await buildAgentTools({
      serverTools: { browserTool: modelOutputTool(toModelOutput) },
      clientTools: serializedClientTools,
    });

    // The client entry overwrites the server tool in convertTools; the server
    // mapping must survive the merge.
    expect(tools.browserTool!.execute).toBeUndefined();
    expect(typeof tools.browserTool!.toModelOutput).toBe('function');
  });

  it('does not recompute for already-enriched parts', async () => {
    const toModelOutput = vi.fn(() => ({ type: 'text', value: 'mapped' }));
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });

    const messageList = new MessageList();
    messageList.add([toolCallMessage('call-1'), toolResultMessage('call-1', 'raw')], 'input');

    await applyClientToolModelOutput({ messageList, tools });
    await applyClientToolModelOutput({ messageList, tools });

    expect(toModelOutput).toHaveBeenCalledTimes(1);
  });

  it('marks the part computed without recomputing when toModelOutput opts out with a nullish return', async () => {
    const toModelOutput = vi.fn(() => undefined);
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });

    const messageList = new MessageList();
    messageList.add([toolCallMessage('call-1'), toolResultMessage('call-1', { keep: 'raw' })], 'input');

    await applyClientToolModelOutput({ messageList, tools });
    await applyClientToolModelOutput({ messageList, tools });

    expect(toModelOutput).toHaveBeenCalledTimes(1);
    const part = findResultPart(messageList);
    expect(part.providerMetadata?.mastra?.modelOutputComputed).toBe(true);
    expect(part.providerMetadata?.mastra?.modelOutput).toBeUndefined();

    // The raw result still reaches the model.
    await expect(toolResultPromptOutput(messageList, 'call-1')).resolves.toMatchObject({
      value: { keep: 'raw' },
    });
  });

  it('swallows toModelOutput errors and keeps the raw result', async () => {
    const toModelOutput = vi.fn(() => {
      throw new Error('boom');
    });
    const logger = { error: vi.fn() };
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });

    const messageList = new MessageList();
    messageList.add([toolCallMessage('call-1'), toolResultMessage('call-1', { keep: 'raw' })], 'input');

    await expect(applyClientToolModelOutput({ messageList, tools, logger })).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
    const part = findResultPart(messageList);
    expect(part.providerMetadata?.mastra?.modelOutputComputed).toBeUndefined();
    await expect(toolResultPromptOutput(messageList, 'call-1')).resolves.toMatchObject({
      value: { keep: 'raw' },
    });
  });

  it('leaves tools with a server-side execute untouched (execution path owns their mapping)', async () => {
    const toModelOutput = vi.fn(() => ({ type: 'text', value: 'mapped' }));
    const tools = await buildAgentTools({
      serverTools: {
        serverTool: createTool({
          id: 'serverTool',
          description: 'runs on the server',
          inputSchema: z.object({}),
          execute: async () => 'x',
          toModelOutput,
        }),
      },
    });

    const messageList = new MessageList();
    messageList.add([toolCallMessage('call-1', 'serverTool'), toolResultMessage('call-1', 'x', 'serverTool')], 'input');

    await applyClientToolModelOutput({ messageList, tools });

    expect(toModelOutput).not.toHaveBeenCalled();
  });

  it('unwraps the AI SDK v5 `{ type, value }` envelope before mapping', async () => {
    const toModelOutput = vi.fn((output: any) => ({ type: 'text', value: `mapped:${output.ok}` }));
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });

    const messageList = new MessageList();
    messageList.add(
      [
        toolCallMessage('call-1'),
        {
          role: 'tool' as const,
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: 'call-1',
              toolName: 'browserTool',
              output: { type: 'json' as const, value: { ok: true } },
            },
          ],
        },
      ],
      'input',
    );

    await applyClientToolModelOutput({ messageList, tools });

    expect(toModelOutput).toHaveBeenCalledWith({ ok: true });
  });

  it('skips stored results that still carry an AI SDK v5 error envelope', async () => {
    const toModelOutput = vi.fn(() => ({ type: 'text', value: 'mapped' }));
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });

    // Live ingestion unwraps the v5 envelope, but DB-format messages re-sent
    // by a client can still carry it on the stored result.
    const messageList = new MessageList();
    messageList.add(
      {
        id: 'msg-1',
        role: 'assistant' as const,
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-1',
                toolName: 'browserTool',
                args: {},
                result: { type: 'error-text', value: 'it failed' },
              },
            },
          ],
        },
      },
      'input',
    );

    await applyClientToolModelOutput({ messageList, tools });

    expect(toModelOutput).not.toHaveBeenCalled();
  });

  it('does not re-map results in memory-recalled history', async () => {
    const toModelOutput = vi.fn(() => ({ type: 'text', value: 'mapped' }));
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });

    // History loaded from memory either already carries the cached mapping or
    // predates the feature; mutations to it are never persisted, so mapping it
    // would re-run user code on every request.
    const messageList = new MessageList();
    messageList.add(
      {
        id: 'msg-history-1',
        role: 'assistant' as const,
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-old',
                toolName: 'browserTool',
                args: {},
                result: { fileId: 'file-old' },
              },
            },
          ],
        },
      },
      'memory',
    );

    await applyClientToolModelOutput({ messageList, tools });

    expect(toModelOutput).not.toHaveBeenCalled();
  });

  it('ignores provider-defined tools even without an execute function', async () => {
    const toModelOutput = vi.fn(() => ({ type: 'text', value: 'mapped' }));
    // Provider-executed tools come out of conversion execute-less too, but the
    // provider round trip owns their results.
    const tools = {
      providerTool: {
        type: 'provider-defined',
        id: 'test.providerTool',
        description: 'runs on the provider',
        parameters: z.object({}),
        toModelOutput,
      } as unknown as CoreTool,
    };

    const messageList = new MessageList();
    messageList.add(
      [toolCallMessage('call-1', 'providerTool'), toolResultMessage('call-1', { ok: true }, 'providerTool')],
      'input',
    );

    await applyClientToolModelOutput({ messageList, tools });

    expect(toModelOutput).not.toHaveBeenCalled();
  });

  it('does not recompute after the enriched message round-trips through JSON storage', async () => {
    const toModelOutput = vi.fn(() => ({ type: 'text', value: 'mapped' }));
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });

    const messageList = new MessageList();
    messageList.add([toolCallMessage('call-1'), toolResultMessage('call-1', { fileId: 'file-123' })], 'input');
    await applyClientToolModelOutput({ messageList, tools });
    expect(toModelOutput).toHaveBeenCalledTimes(1);

    // Simulate persistence + reload: the input message is saved with the
    // enrichment; a later request re-sends it as DB-format input.
    const persisted = JSON.parse(JSON.stringify(messageList.get.input.db()));
    const reloaded = new MessageList();
    reloaded.add(persisted, 'input');

    await applyClientToolModelOutput({ messageList: reloaded, tools });

    expect(toModelOutput).toHaveBeenCalledTimes(1);
    const part = findResultPart(reloaded);
    expect(part.providerMetadata?.mastra?.modelOutput).toEqual({ type: 'text', value: 'mapped' });
  });

  it('normalizes image-url shorthand into media content (execution-path parity)', async () => {
    const toModelOutput = vi.fn(() => ({
      type: 'content',
      value: [{ type: 'image-url', url: 'data:image/png;base64,AAAA' }],
    }));
    const tools = await buildAgentTools({ serverTools: { browserTool: modelOutputTool(toModelOutput) } });

    const messageList = new MessageList();
    messageList.add([toolCallMessage('call-1'), toolResultMessage('call-1', { fileId: 'f-1' })], 'input');

    await applyClientToolModelOutput({ messageList, tools });

    const part = findResultPart(messageList);
    expect(part.providerMetadata?.mastra?.modelOutput).toEqual({
      type: 'content',
      value: [{ type: 'media', data: 'data:image/png;base64,AAAA', mediaType: 'image/png' }],
    });
  });
});

describe('client tool toModelOutput through agent.generate (production path)', () => {
  it('sends the mapped output to the model for a client-supplied tool result', async () => {
    const prompts: any[] = [];
    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        prompts.push(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          content: [{ type: 'text' as const, text: 'ok' }],
          warnings: [],
        };
      },
    }) as unknown as LanguageModelV2;

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test agent',
      model,
      tools: {
        browserTool: createTool({
          id: 'browserTool',
          description: 'runs in the browser',
          inputSchema: z.object({ q: z.string().optional() }),
          toModelOutput: (output: any) => ({
            type: 'content',
            value: [{ type: 'text', text: `Screenshot uploaded as ${output.fileId}` }],
          }),
        }),
      },
    });

    const serializedClientTools = {
      browserTool: {
        description: 'runs in the browser',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      },
    };
    const result = await agent.generate(
      [toolCallMessage('call-1'), toolResultMessage('call-1', { fileId: 'file-9' })],
      {
        clientTools: serializedClientTools as ToolsInput,
      },
    );

    expect(result.tripwire).toBeUndefined();
    const toolResults = prompts
      .flat()
      .filter((m: any) => m.role === 'tool')
      .flatMap((m: any) => m.content)
      .filter((p: any) => p.type === 'tool-result' && p.toolCallId === 'call-1');
    expect(toolResults.length).toBeGreaterThan(0);
    expect(toolResults[0]!.output).toEqual({
      type: 'content',
      value: [{ type: 'text', text: 'Screenshot uploaded as file-9' }],
    });
  });
});
