import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable/create-durable-agent';
import { MessageList } from '../../agent/message-list';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';

import { TokenLimiterProcessor } from './token-limiter';
import { ToolResultTokenLimiter } from './tool-result-token-limiter';

const TOOL_CALL_ID = 'call-1';

function listWithPendingCall() {
  const messageList = new MessageList();
  messageList.add(
    {
      id: 'a1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: TOOL_CALL_ID, toolName: 'lookup', args: {} },
          },
        ],
      },
    },
    'response',
  );
  return messageList;
}

function storedResult(messageList: MessageList): unknown {
  for (const message of messageList.get.all.db()) {
    for (const part of message.content.parts) {
      if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === TOOL_CALL_ID) {
        return part.toolInvocation.state === 'result' ? part.toolInvocation.result : undefined;
      }
    }
  }
  return undefined;
}

async function run(limiter: ToolResultTokenLimiter, result: unknown, messageList = listWithPendingCall()) {
  await limiter.processToolResult!({
    result,
    toolCallId: TOOL_CALL_ID,
    toolName: 'lookup',
    args: {},
    messageList,
  } as any);
  return storedResult(messageList);
}

describe('ToolResultTokenLimiter', () => {
  it('rejects a limit that is not a positive integer', () => {
    expect(() => new ToolResultTokenLimiter(0)).toThrow();
    expect(() => new ToolResultTokenLimiter({ limit: 1.5 })).toThrow();
  });

  it('leaves results within the limit alone', async () => {
    expect(await run(new ToolResultTokenLimiter(100), 'short result')).toBeUndefined();
  });

  it('truncates an oversized string result to the limit with a marker', async () => {
    const limited = await run(new ToolResultTokenLimiter(50), 'word '.repeat(3000));
    expect(typeof limited).toBe('string');
    expect(limited).toMatch(/\[truncated: showing \d+ of \d+ tokens\]$/);
    expect(estimateTokenCount(limited as string)).toBeLessThanOrEqual(50);
  });

  it('limits object results by their JSON text, including bigint values', async () => {
    const limited = await run(new ToolResultTokenLimiter(50), { id: 1n, body: 'word '.repeat(3000) });
    expect(limited).toMatch(/^\{"id":"1"/);
    expect(estimateTokenCount(limited as string)).toBeLessThanOrEqual(50);
  });

  it('leaves media and unserializable results alone', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const limiter = new ToolResultTokenLimiter(5);
    expect(await run(limiter, { data: 'x'.repeat(10000), mediaType: 'image/png' })).toBeUndefined();
    expect(await run(limiter, circular)).toBeUndefined();
  });

  it('never exceeds the limit across varied text and limits', async () => {
    const inputs = [
      'word '.repeat(3000),
      'ünïcödé 😀 漢字テキスト, '.repeat(800),
      'a'.repeat(20000),
      '{"k":[1,2,3],"s":"x\\n"} '.repeat(1000),
      'path/to/file.ts:123 -> ok;\n'.repeat(1000),
    ];
    for (const input of inputs) {
      for (const limit of [1, 5, 12, 13, 20, 37, 50, 200, 1000]) {
        const limited = await run(new ToolResultTokenLimiter(limit), input);
        expect(estimateTokenCount(limited as string)).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('returns an empty string when the limit is too small for the marker', async () => {
    expect(await run(new ToolResultTokenLimiter(1), 'word '.repeat(3000))).toBe('');
  });

  it('skips a same-stream provider-executed result that has no message-list entry yet', async () => {
    const messageList = new MessageList();
    const update = vi.spyOn(messageList, 'updateToolInvocation');
    await new ToolResultTokenLimiter(10).processToolResult!({
      result: 'word '.repeat(500),
      toolCallId: TOOL_CALL_ID,
      toolName: 'web_search',
      args: {},
      providerExecuted: true,
      messageList,
    } as any);
    expect(update).not.toHaveBeenCalled();
  });

  it('limits a deferred provider-executed result whose call is already in the message list', async () => {
    const messageList = listWithPendingCall();
    await new ToolResultTokenLimiter(50).processToolResult!({
      result: 'word '.repeat(500),
      toolCallId: TOOL_CALL_ID,
      toolName: 'lookup',
      args: {},
      providerExecuted: true,
      messageList,
    } as any);
    expect(storedResult(messageList)).toContain('[truncated: showing');
  });

  it('limits the result an earlier processor wrote to the message list', async () => {
    const messageList = listWithPendingCall();
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: TOOL_CALL_ID,
        toolName: 'lookup',
        args: {},
        result: `REDACTED ${'word '.repeat(3000)}`,
      },
    });
    const limited = await run(new ToolResultTokenLimiter(50), `SECRET ${'word '.repeat(3000)}`, messageList);
    expect(limited).toMatch(/^REDACTED/);
    expect(limited).toMatch(/\[truncated: showing \d+ of \d+ tokens\]$/);
    expect(limited).not.toContain('SECRET');
  });
});

function createToolLoopModel() {
  const prompts: LanguageModelV2Prompt[] = [];
  const hasToolResult = (prompt: LanguageModelV2Prompt) =>
    prompt.some(m => Array.isArray(m.content) && (m.content as any[]).some(c => c.type === 'tool-result'));
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const chunks: any[] = hasToolResult(prompt)
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'ok' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            { type: 'tool-call', toolCallId: TOOL_CALL_ID, toolName: 'lookup', input: '{"q":"x"}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...chunks]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

function lookupTool(result: string) {
  return createTool({
    id: 'lookup',
    description: 'Look something up',
    inputSchema: z.object({ q: z.string() }),
    execute: async () => result,
  });
}

const redactor = {
  id: 'redactor',
  name: 'redactor',
  processToolResult: async ({ messageList, toolCallId, toolName, args, result }: any) => {
    const current = typeof result === 'string' ? result : '';
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId,
        toolName,
        args,
        result: `REDACTED ${current.replace('SECRET-TOKEN', '')}`,
      },
    });
  },
};

async function runDurable(agent: Agent) {
  void new Mastra({ agents: { [agent.id]: agent }, storage: new InMemoryStore() });
  const pubsub = new EventEmitterPubSub();
  try {
    const out = await createDurableAgent({ agent, pubsub }).stream('question', { maxSteps: 3 });
    for await (const _chunk of out.fullStream) {
      // drain
    }
  } finally {
    await pubsub.close();
  }
}

const promptText = (prompt: LanguageModelV2Prompt | undefined) => JSON.stringify(prompt ?? []);

describe('ToolResultTokenLimiter through an agent', () => {
  it('keeps the current run tool result that TokenLimiter would otherwise drop (#24110)', async () => {
    const build = (outputProcessors: any[]) => {
      const { model, prompts } = createToolLoopModel();
      const agent = new Agent({
        id: 'tool-result-limit',
        name: 'tool-result-limit',
        instructions: 'Answer briefly.',
        model,
        tools: { lookup: lookupTool(`DATA ${'result '.repeat(3000)}`) },
        inputProcessors: [new TokenLimiterProcessor(1000)],
        outputProcessors,
      });
      return { agent, prompts };
    };

    const without = build([]);
    await (await without.agent.stream('question', { maxSteps: 3 })).consumeStream();
    // TokenLimiter dropped the result, so the model never saw it and called the tool again.
    expect(without.prompts).toHaveLength(3);
    expect(promptText(without.prompts[1])).not.toContain('tool-result');
    expect(promptText(without.prompts[2])).not.toContain('tool-result');

    const withLimiter = build([new ToolResultTokenLimiter(200)]);
    await (await withLimiter.agent.stream('question', { maxSteps: 3 })).consumeStream();
    expect(withLimiter.prompts).toHaveLength(2);
    const second = promptText(withLimiter.prompts[1]);
    expect(second).toContain('tool-result');
    expect(second).toContain('DATA result');
    expect(second).toContain('[truncated: showing');
  });

  it('lets a processor after the limiter replace the limited result with one built from the original', async () => {
    const { model, prompts } = createToolLoopModel();
    const agent = new Agent({
      id: 'limit-then-redact',
      name: 'limit-then-redact',
      instructions: 'Answer briefly.',
      model,
      tools: { lookup: lookupTool(`SECRET-TOKEN ${'result '.repeat(3000)}`) },
      outputProcessors: [new ToolResultTokenLimiter(50), redactor as any],
    });
    await runDurable(agent);
    const prompt = promptText(prompts.at(-1));
    expect(prompt).toContain('REDACTED');
    expect(prompt).not.toContain('SECRET-TOKEN');
    // The redactor rebuilt its value from the original `result` argument, so the limit no longer applies.
    expect(prompt).not.toContain('[truncated: showing');
  });

  it('limits the redacted result when a redactor runs before the limiter in a durable agent', async () => {
    const { model, prompts } = createToolLoopModel();
    const agent = new Agent({
      id: 'redact-then-limit',
      name: 'redact-then-limit',
      instructions: 'Answer briefly.',
      model,
      tools: { lookup: lookupTool(`SECRET-TOKEN ${'result '.repeat(3000)}`) },
      outputProcessors: [redactor as any, new ToolResultTokenLimiter(50)],
    });
    await runDurable(agent);
    const prompt = promptText(prompts.at(-1));
    expect(prompt).toContain('REDACTED');
    expect(prompt).toContain('[truncated: showing');
    expect(prompt).not.toContain('SECRET-TOKEN');
  });

  it.each(['default', 'durable'] as const)('limits a tool that has a toModelOutput mapper (%s)', async engine => {
    const { model, prompts } = createToolLoopModel();
    const tool = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => `DATA ${'result '.repeat(3000)}`,
      toModelOutput: (output: unknown) => ({ type: 'text', value: `mapped: ${String(output)}` }),
    });
    const agent = new Agent({
      id: `mapped-limit-${engine}`,
      name: 'mapped-limit',
      instructions: 'Answer briefly.',
      model,
      tools: { lookup: tool },
      outputProcessors: [new ToolResultTokenLimiter(50)],
    });
    if (engine === 'durable') await runDurable(agent);
    else await (await agent.stream('question', { maxSteps: 3 })).consumeStream();
    const prompt = promptText(prompts.at(-1));
    expect(prompt).toContain('mapped: ');
    expect(prompt).toContain('[truncated: showing');
  });

  it('hands toModelOutput the truncated text when an object result is limited', async () => {
    const { model } = createToolLoopModel();
    const seen: unknown[] = [];
    const tool = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => ({ items: Array.from({ length: 2000 }, (_, id) => ({ id })) }),
      toModelOutput: (output: unknown) => {
        seen.push(output);
        return { type: 'text', value: 'mapped' };
      },
    });
    const agent = new Agent({
      id: 'mapped-object-limit',
      name: 'mapped-object-limit',
      instructions: 'Answer briefly.',
      model,
      tools: { lookup: tool },
      outputProcessors: [new ToolResultTokenLimiter(50)],
    });
    await (await agent.stream('question', { maxSteps: 3 })).consumeStream();
    expect(seen).toHaveLength(1);
    expect(typeof seen[0]).toBe('string');
    expect(seen[0]).toContain('[truncated: showing');
  });
});
