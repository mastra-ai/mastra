import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

/**
 * A client tool leaves the stored assistant turn with a pending call. The client then sends the
 * outcome back on its copy of that assistant message, either on its own or together with the next
 * user message (`useChat` without `sendAutomaticallyWhen`). The outcome may only fill in a call the
 * stored copy still has pending; a stored outcome is never overwritten by an echo.
 */

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createModel(prompts: any[], firstTurn: 'client-call' | 'text') {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const callsTool = firstTurn === 'client-call' && prompts.length === 1;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(
          callsTool
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'call_1', toolName: 'pickColor', input: '{"hint":"warm"}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: `reply ${prompts.length}` },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
  });
}

async function setup() {
  const prompts: any[] = [];
  const memory = new MockMemory();
  const agent = new Agent({
    id: 'client-tools',
    name: 'client-tools',
    instructions: 'x',
    model: createModel(prompts, 'client-call'),
    memory,
    tools: {
      pickColor: createTool({
        id: 'pickColor',
        description: 'Asks the user to pick a color in the UI',
        inputSchema: z.object({ hint: z.string() }),
      }),
    },
  });
  const threadId = randomUUID();
  const memoryOpts = { memory: { thread: threadId, resource: 'r', options: { lastMessages: 20 } } };

  const turn1 = await agent.stream(
    [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'pick one' }] }],
    memoryOpts,
  );
  await turn1.consumeStream();
  const assistant = (await memory.recall({ threadId, resourceId: 'r', perPage: 100 })).messages.find(
    message => message.role === 'assistant',
  )!;

  const stream = async (messages: any[]) => {
    const output = await agent.stream(messages, memoryOpts);
    await output.consumeStream();
    return prompts.at(-1) as any[];
  };
  const stored = async () => (await memory.recall({ threadId, resourceId: 'r', perPage: 100 })).messages;

  return { assistant, memory, threadId, stream, stored };
}

function toolParts(messages: any[]) {
  return messages
    .flatMap(message => message.content.parts)
    .filter((part: any) => part.type === 'tool-invocation')
    .map((part: any) => part.toolInvocation);
}

function promptToolResults(prompt: any[]) {
  return prompt
    .filter(message => message.role === 'tool')
    .flatMap(message => message.content)
    .map((part: any) => part.output);
}

function promptUserText(prompt: any[]) {
  return prompt
    .filter(message => message.role === 'user')
    .flatMap(message => message.content)
    .map((part: any) => part.text);
}

function echoedAssistant(id: string, toolInvocation: Record<string, unknown>) {
  return {
    id,
    role: 'assistant' as const,
    parts: [
      {
        type: 'tool-invocation' as const,
        toolInvocation: { toolCallId: 'call_1', toolName: 'pickColor', args: { hint: 'warm' }, ...toolInvocation },
      },
    ],
  };
}

describe('client tool updates on an existing thread', () => {
  it('stores the pending client call after the first turn', async () => {
    const { assistant } = await setup();
    expect(toolParts([assistant])).toMatchObject([{ toolCallId: 'call_1', state: 'call' }]);
  });

  it('keeps a client tool result sent together with the next user message', async () => {
    const { assistant, stream, stored } = await setup();

    const prompt = await stream([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'pick one' }] },
      echoedAssistant(assistant.id, { state: 'result', result: { color: 'red' } }),
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'thanks' }] },
    ]);

    expect(promptToolResults(prompt)).toEqual([{ type: 'json', value: { color: 'red' } }]);
    expect(promptUserText(prompt)).toEqual(['pick one', 'thanks']);

    const messages = await stored();
    expect(toolParts(messages)).toMatchObject([{ toolCallId: 'call_1', state: 'result', result: { color: 'red' } }]);
    expect(messages.filter(message => message.role === 'user').map(message => message.id)).toEqual(['u1', 'u2']);
  });

  it('does not overwrite a stored result with the echo sent together with the next user message', async () => {
    const { assistant, stream, stored } = await setup();
    await stream([echoedAssistant(assistant.id, { state: 'result', result: { color: 'red' } })]);

    const prompt = await stream([
      echoedAssistant(assistant.id, { state: 'result', result: { color: 'blue' } }),
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'thanks' }] },
    ]);

    expect(promptToolResults(prompt)).toEqual([{ type: 'json', value: { color: 'red' } }]);
    expect(promptUserText(prompt)).toContain('thanks');

    const messages = await stored();
    expect(toolParts(messages)).toMatchObject([{ toolCallId: 'call_1', state: 'result', result: { color: 'red' } }]);
    expect(messages.some(message => message.id === 'u2')).toBe(true);
  });

  it('drops tool updates on an assistant message that is not stored under that id', async () => {
    const { stream, stored } = await setup();

    const prompt = await stream([
      echoedAssistant('client-folded-id', { state: 'result', result: { color: 'red' } }),
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'thanks' }] },
    ]);

    expect(promptToolResults(prompt)).toEqual([]);
    expect(promptUserText(prompt)).toContain('thanks');

    const messages = await stored();
    expect(messages.some(message => message.id === 'client-folded-id')).toBe(false);
    expect(toolParts(messages)).toMatchObject([{ toolCallId: 'call_1', state: 'call' }]);
    expect(messages.some(message => message.id === 'u2')).toBe(true);
  });

  it('does not overwrite a stored result with a stale echo on a trailing assistant message', async () => {
    const { assistant, stream, stored } = await setup();
    await stream([echoedAssistant(assistant.id, { state: 'result', result: { color: 'red' } })]);

    const prompt = await stream([echoedAssistant(assistant.id, { state: 'result', result: { color: 'blue' } })]);

    expect(promptToolResults(prompt)).toEqual([{ type: 'json', value: { color: 'red' } }]);
    expect(toolParts(await stored())).toMatchObject([
      { toolCallId: 'call_1', state: 'result', result: { color: 'red' } },
    ]);
  });

  it('keeps a client tool error sent on a trailing assistant message', async () => {
    const { assistant, stream, stored } = await setup();

    const prompt = await stream([
      echoedAssistant(assistant.id, { state: 'output-error', errorText: 'user closed the picker' }),
    ]);

    expect(JSON.stringify(promptToolResults(prompt))).toContain('user closed the picker');
    expect(toolParts(await stored())).toMatchObject([
      { toolCallId: 'call_1', state: 'output-error', errorText: 'user closed the picker' },
    ]);
  });

  describe('sent as UI messages', () => {
    // The shape `useChat` sends after `addToolOutput({ state: 'output-error', ... })`.
    const uiAssistantWithError = (id: string) => ({
      id,
      role: 'assistant' as const,
      parts: [
        {
          type: 'tool-pickColor' as const,
          toolCallId: 'call_1',
          state: 'output-error' as const,
          input: { hint: 'warm' },
          errorText: 'user closed the picker',
        },
      ],
    });

    it('keeps a client tool error on a trailing assistant message', async () => {
      const { assistant, stream, stored } = await setup();

      const prompt = await stream([
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'pick one' }] },
        uiAssistantWithError(assistant.id),
      ]);

      expect(JSON.stringify(promptToolResults(prompt))).toContain('user closed the picker');
      expect(toolParts(await stored())).toMatchObject([
        { toolCallId: 'call_1', state: 'output-error', errorText: 'user closed the picker' },
      ]);
    });

    it('keeps a client tool error sent together with the next user message', async () => {
      const { assistant, stream, stored } = await setup();

      const prompt = await stream([
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'pick one' }] },
        uiAssistantWithError(assistant.id),
        { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'never mind' }] },
      ]);

      expect(JSON.stringify(promptToolResults(prompt))).toContain('user closed the picker');
      expect(promptUserText(prompt)).toEqual(['pick one', 'never mind']);
      const messages = await stored();
      expect(toolParts(messages)).toMatchObject([
        { toolCallId: 'call_1', state: 'output-error', errorText: 'user closed the picker' },
      ]);
      expect(messages.some(message => message.id === 'u2')).toBe(true);
    });
  });

  it('seeds an empty thread with the full input, including client tool results', async () => {
    const prompts: any[] = [];
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'seed',
      name: 'seed',
      instructions: 'x',
      model: createModel(prompts, 'text'),
      memory,
    });
    const threadId = randomUUID();

    const output = await agent.stream(
      [
        { id: 'seed-u1', role: 'user', parts: [{ type: 'text', text: 'pick one' }] },
        echoedAssistant('seed-a1', { state: 'result', result: { color: 'red' } }),
        { id: 'seed-u2', role: 'user', parts: [{ type: 'text', text: 'thanks' }] },
      ],
      { memory: { thread: threadId, resource: 'r', options: { lastMessages: 20 } } },
    );
    await output.consumeStream();

    expect(promptUserText(prompts[0])).toEqual(['pick one', 'thanks']);
    expect(promptToolResults(prompts[0])).toEqual([{ type: 'json', value: { color: 'red' } }]);
    const messages = (await memory.recall({ threadId, resourceId: 'r', perPage: 100 })).messages;
    expect(messages.map(message => message.id).slice(0, 3)).toEqual(['seed-u1', 'seed-a1', 'seed-u2']);
  });
});
