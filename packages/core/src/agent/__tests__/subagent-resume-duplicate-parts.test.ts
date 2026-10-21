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

const lookupTool = createTool({
  id: 'lookupTool',
  description: 'Look up a record.',
  inputSchema: z.object({ query: z.string() }),
  execute: async input => input,
});

const delegate = (toolCallId: string, extra: object = {}) => ({
  type: 'tool-call' as const,
  toolCallId,
  toolName: 'agent-worker',
  input: JSON.stringify({ prompt: 'Complete the task', ...extra }),
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
  const worker = new Agent({
    id: 'worker',
    name: 'Worker',
    description: 'Completes delegated tasks.',
    instructions: 'Complete the task.',
    model: scriptedModel([
      () => [askUser('ask-1', 'Which option?'), finish('tool-calls')],
      () => [askUser('ask-2', 'Confirm?'), finish('tool-calls')],
      () => [...text('w0', 'Task complete.'), finish('stop')],
    ]),
    tools: { askUserTool },
    memory: new MockMemory({ storage }),
    defaultOptions: { autoResumeSuspendedTools: true },
  });

  const supervisor = new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Look things up, delegate tasks to the worker agent.',
    model: scriptedModel([
      () => [
        ...text('s0', 'Here is what I found.'),
        {
          type: 'tool-call' as const,
          toolCallId: 'lookup-1',
          toolName: 'lookupTool',
          input: JSON.stringify({ query: 'record' }),
        },
        delegate('delegate-1'),
        finish('tool-calls'),
      ],
      prompt => [delegate('delegate-2', { resumeData: 'Option A', ...suspendedTool(prompt) }), finish('tool-calls')],
      prompt => [delegate('delegate-3', { resumeData: 'Yes', ...suspendedTool(prompt) }), finish('tool-calls')],
      () => [...text('s1', 'All done.'), finish('stop')],
    ]),
    tools: { lookupTool },
    agents: { worker },
    memory: new MockMemory({ storage }),
    defaultOptions: { autoResumeSuspendedTools: true },
  });

  new Mastra({ agents: { supervisor, worker }, logger: false, storage });
  return supervisor;
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
    const supervisor = buildAgents(storage);
    const memory = { thread: 'thread-1', resource: 'user-1' };

    for (const content of ['Start the task', 'Option A', 'Yes']) {
      const stream = await supervisor.stream(content, { memory });
      await stream.consumeStream();
    }

    const assistantMessages = await savedAssistantMessages(storage);
    const owners = toolCallIdOwners(assistantMessages);

    const textCounts: Record<string, number> = {};
    for (const message of assistantMessages) {
      for (const part of (message.content as any)?.parts ?? []) {
        if (part.type === 'text') textCounts[part.text] = (textCounts[part.text] ?? 0) + 1;
      }
    }
    expect(textCounts).toEqual({ 'Here is what I found.': 1, 'Task complete.': 1, 'All done.': 1 });

    expect([...owners.entries()].filter(([, messageIds]) => messageIds.length > 1)).toEqual([]);
    for (const toolCallId of ['lookup-1', 'delegate-1', 'delegate-2', 'delegate-3', 'ask-1', 'ask-2']) {
      expect(owners.get(toolCallId)?.length).toBe(1);
    }

    const memoryStore = await storage.getStore('memory');
    const { messages } = await memoryStore!.listMessages({ threadId: 'thread-1', perPage: false });
    const supervisorGroups = messages
      .filter(message => message.role === 'assistant')
      .map(message =>
        ((message.content as any)?.parts ?? [])
          .filter((p: any) => p.type === 'tool-invocation')
          .map((p: any) => p.toolInvocation.toolCallId),
      )
      .filter(ids => ids.length > 0);
    expect(supervisorGroups).toEqual([['lookup-1', 'delegate-1'], ['delegate-2'], ['delegate-3']]);
  });
});
