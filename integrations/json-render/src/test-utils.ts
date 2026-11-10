import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { JSON_RENDER_STATE, JsonRenderProcessor } from './index';

export const catalog = defineCatalog(schema, {
  components: {
    Card: { props: z.object({ title: z.string() }), description: 'A card with a title' },
    Text: { props: z.object({ text: z.string() }), description: 'A line of text' },
    Toggle: { props: z.object({ label: z.string(), checked: z.boolean() }), description: 'A checkbox' },
    Button: { props: z.object({ label: z.string() }), description: 'A button' },
  },
  actions: {
    ask: { params: z.object({ message: z.string() }), description: 'Send the agent a message for the user' },
  },
});

export const weatherCard = {
  root: 'card',
  elements: {
    card: { type: 'Card', props: { title: 'Paris' }, children: ['text'] },
    text: { type: 'Text', props: { text: '18°C and sunny' }, children: [] },
  },
};

/** The ```spec block json-render's prompt asks the model to write for a spec. */
export function specBlock(spec: { root: string; state?: Record<string, unknown>; elements: Record<string, unknown> }) {
  const lines = [
    { op: 'add', path: '/root', value: spec.root },
    ...(spec.state ? [{ op: 'add', path: '/state', value: spec.state }] : []),
    ...Object.entries(spec.elements).map(([key, element]) => ({ op: 'add', path: `/elements/${key}`, value: element })),
  ];
  return ['```spec', ...lines.map(line => JSON.stringify(line)), '```'].join('\n');
}

/** A model that writes each reply in turn, cut into small deltas the way providers stream text, or calls a tool. */
export function modelWriting(...replies: (string | { call: string })[]) {
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const reply = replies[prompts.length - 1] ?? 'Done';
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      if (typeof reply !== 'string') {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'tool-call' as const, toolCallId: `call-${prompts.length}`, toolName: reply.call, input: '{}' },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ]),
          rawCall: { rawPrompt: [], rawSettings: {} },
        };
      }
      const deltas = reply.match(/[\s\S]{1,7}/g) ?? [];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't' },
          ...deltas.map(delta => ({ type: 'text-delta' as const, id: 't', delta })),
          { type: 'text-end' as const, id: 't' },
          { type: 'finish' as const, finishReason: 'stop' as const, usage },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
      };
    },
  });
  return { model, prompts };
}

/** The conversation a model call was given, each message reduced to its role and text. */
export function modelSaw(prompt: unknown) {
  return (prompt as { role: string; content: string | { type: string; text?: string }[] }[])
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role,
      text:
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter(part => part.type === 'text')
              .map(part => part.text)
              .join(''),
    }));
}

/** A message the user sends, with the state their interface holds when they send it. */
export type Turn = string | { text: string; state: Record<string, unknown> };

/** The agent an app would run: the json-render processor on both sides, with memory. */
export function createAgent(model: MockLanguageModelV2, tools: ToolsInput = {}) {
  const memory = new Memory({ storage: new InMemoryStore() });
  const processor = new JsonRenderProcessor({ catalog });
  const agent = new Agent({
    id: 'ui',
    name: 'ui',
    instructions: 'Compose interfaces',
    model,
    memory,
    tools,
    inputProcessors: [processor],
    outputProcessors: [processor],
    maxProcessorRetries: 1,
  });
  return { agent, memory };
}

/** Sends each turn on one thread; returns what the last turn streamed and the saved thread. */
export async function chat(
  model: MockLanguageModelV2 | { model: MockLanguageModelV2; tools: ToolsInput },
  ...turns: Turn[]
) {
  const { agent, memory } = 'tools' in model ? createAgent(model.model, model.tools) : createAgent(model);
  let streamed: { type: string; payload?: any; data?: unknown }[] = [];
  for (const turn of turns) {
    const { text, state } = typeof turn === 'string' ? { text: turn, state: undefined } : turn;
    const stream = await agent.stream(text, {
      memory: { thread: 't1', resource: 'r1' },
      requestContext: state && new RequestContext([[JSON_RENDER_STATE, state]]),
    });
    streamed = [];
    for await (const chunk of stream.fullStream) streamed.push(chunk as any);
  }
  const { messages } = await memory.recall({ threadId: 't1', resourceId: 'r1' });
  return { streamed, messages, agent };
}
