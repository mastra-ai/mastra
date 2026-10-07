import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { askUserTool, createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Resuming a suspended sub-agent delegation must not re-save earlier turns'
 * parts into new assistant messages.
 *
 * When the delegation resumes via `resumeData` + `suspendedToolRunId`,
 * `removeToolMetadata` re-adds the earlier saved assistant messages (to clear
 * their suspension metadata) with source `response`. `MessageMerger` then
 * merges their parts into the assistant message currently being streamed, so
 * each resume re-saves earlier turns' tool calls and text under new message
 * IDs.
 *
 * Expected: every toolCallId appears in exactly one saved assistant message,
 * no matter how many resumes happen on the thread.
 */

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const finish = (finishReason: 'stop' | 'tool-calls') => ({ type: 'finish' as const, finishReason, usage });

type ScriptStep = (prompt: unknown) => unknown[];

function scriptedModel(script: ScriptStep[]) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const step = script[calls++];
      if (!step) throw new Error(`Model call ${calls} is not scripted`);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...step(prompt)] as any),
      };
    },
  });
}

/** Pull the suspended tool identity out of the auto-resume system prompt. */
function suspendedTool(prompt: unknown) {
  const system = JSON.stringify(prompt);
  const toolCallId = system.match(/\\"toolCallId\\":\\"([^\\"]+)/)?.[1];
  const runId = system.match(/\\"runId\\":\\"([^\\"]+)/)?.[1];
  if (!toolCallId || !runId) throw new Error('The auto-resume prompt names no suspended tool');
  return { suspendedToolCallId: toolCallId, suspendedToolRunId: runId };
}

const displayProductsTool = createTool({
  id: 'displayProductsTool',
  description: 'Show the customer a product carousel.',
  inputSchema: z.object({ products: z.array(z.string()) }),
  execute: async input => input,
});

const delegate = (toolCallId: string, extra: object = {}) => ({
  type: 'tool-call' as const,
  toolCallId,
  toolName: 'agent-shop',
  input: JSON.stringify({ prompt: 'Buy the senior food', ...extra }),
});

const askUser = (toolCallId: string, question: string) => ({
  type: 'tool-call' as const,
  toolCallId,
  toolName: 'askUserTool',
  input: JSON.stringify({ question, options: [{ label: 'Yes' }, { label: 'No' }] }),
});

const text = (id: string, value: string) => [
  { type: 'text-start' as const, id },
  { type: 'text-delta' as const, id, delta: value },
  { type: 'text-end' as const, id },
];

function buildAgents(storage: InMemoryStore) {
  const shop = new Agent({
    id: 'shop',
    name: 'Shop',
    description: 'Handles purchases.',
    instructions: 'Handle the purchase.',
    model: scriptedModel([
      () => [askUser('ask-1', 'Which size?'), finish('tool-calls')],
      () => [askUser('ask-2', 'Auto-Delivery?'), finish('tool-calls')],
      () => [...text('s0', 'Added the 12kg bag to your cart.'), finish('stop')],
    ]),
    tools: { askUserTool },
    memory: new MockMemory({ storage }),
    defaultOptions: { autoResumeSuspendedTools: true },
  });

  const owner = new Agent({
    id: 'owner',
    name: 'Owner',
    instructions: 'Recommend food, delegate purchases to the shop agent.',
    model: scriptedModel([
      () => [
        ...text('v0', 'Here is a food that suits a senior dog.'),
        {
          type: 'tool-call' as const,
          toolCallId: 'carousel-1',
          toolName: 'displayProductsTool',
          input: JSON.stringify({ products: ['senior-food'] }),
        },
        delegate('delegate-1'),
        finish('tool-calls'),
      ],
      prompt => [delegate('delegate-2', { resumeData: '12kg', ...suspendedTool(prompt) }), finish('tool-calls')],
      prompt => [delegate('delegate-3', { resumeData: 'Yes', ...suspendedTool(prompt) }), finish('tool-calls')],
      () => [...text('v1', 'Done, the 12kg bag is in your cart.'), finish('stop')],
    ]),
    tools: { displayProductsTool },
    agents: { shop },
    memory: new MockMemory({ storage }),
    defaultOptions: { autoResumeSuspendedTools: true },
  });

  new Mastra({ agents: { owner, shop }, logger: false, storage });
  return owner;
}

async function savedAssistantMessages(storage: InMemoryStore) {
  const memoryStore = await storage.getStore('memory');
  const { threads } = await memoryStore!.listThreads({ perPage: false });
  const saved = (
    await Promise.all(threads.map(({ id: threadId }) => memoryStore!.listMessages({ threadId, perPage: false })))
  ).flatMap(({ messages }) => messages);
  return saved.filter(message => message.role === 'assistant');
}

function toolCallIdOwners(assistants: Awaited<ReturnType<typeof savedAssistantMessages>>) {
  const owners = new Map<string, string[]>();
  for (const message of assistants) {
    const parts: any[] = (message.content as any)?.parts ?? [];
    const idsInMessage = new Set<string>(
      parts.filter(p => p.type === 'tool-invocation').map(p => p.toolInvocation.toolCallId as string),
    );
    for (const toolCallId of idsInMessage) {
      owners.set(toolCallId, [...(owners.get(toolCallId) ?? []), message.id]);
    }
  }
  return owners;
}

describe('sub-agent delegation auto-resume persistence', () => {
  it('saves each tool call in exactly one assistant message across resumes', async () => {
    const storage = new InMemoryStore();
    const owner = buildAgents(storage);
    const memory = { thread: 'thread-1', resource: 'user-1' };

    for (const content of ['I want to buy the senior food', '12kg', 'Yes']) {
      const stream = await owner.stream(content, { memory });
      for await (const _chunk of stream.fullStream) {
        // drain
      }
    }

    const assistants = await savedAssistantMessages(storage);
    const owners = toolCallIdOwners(assistants);

    const duplicated = [...owners.entries()].filter(([, messageIds]) => messageIds.length > 1);
    if (duplicated.length > 0) {
      for (const message of assistants) {
        console.log(
          JSON.stringify(
            {
              id: message.id,
              threadId: message.threadId,
              parts: ((message.content as any)?.parts ?? []).map((p: any) =>
                p.type === 'tool-invocation'
                  ? { type: p.type, toolCallId: p.toolInvocation.toolCallId, state: p.toolInvocation.state }
                  : { type: p.type, text: p.text },
              ),
            },
            null,
            2,
          ),
        );
      }
    }
    expect(duplicated).toEqual([]);

    // Every scripted tool call was saved exactly once.
    for (const toolCallId of ['carousel-1', 'delegate-1', 'delegate-2', 'delegate-3', 'ask-1', 'ask-2']) {
      expect(owners.get(toolCallId)?.length).toBe(1);
    }
  });
});
