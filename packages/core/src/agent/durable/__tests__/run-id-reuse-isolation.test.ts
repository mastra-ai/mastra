import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

function model(prompts: string[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }: { prompt: LanguageModelV2Prompt }) => {
      prompts.push(JSON.stringify(prompt));
      const parts = prompt.some(m => m.role === 'tool')
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            { type: 'tool-call', toolCallId: `call-${prompts.length}`, toolName: 'lookup', input: '{"q":"a"}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

type Kind = 'durable' | 'evented';

/** Runs one tenant's agent in its own Mastra app, always with the same runId. */
async function runTenant(name: string, kind: Kind, tripwire: boolean) {
  const storage = new InMemoryStore();
  const prompts: string[] = [];
  const agent = new Agent({
    id: 'support',
    name: 'support',
    instructions: 'help',
    model: model(prompts),
    memory: new MockMemory({ storage }),
    outputProcessors: tripwire
      ? [
          {
            id: 'trip',
            processOutputStream: async ({ part, abort }: any) => {
              if (part.type === 'text-delta') abort('tripwire');
              return part;
            },
          } as any,
        ]
      : [],
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'lookup',
        inputSchema: z.object({ q: z.string() }),
        execute: async () => ({ secret: `${name}-tool-secret` }),
      }),
    },
  });
  const runner =
    kind === 'durable'
      ? createDurableAgent({ agent, pubsub: new EventEmitterPubSub() })
      : createEventedAgent({ agent });
  new Mastra({ agents: { support: runner } as never, storage, logger: false });

  const { output, cleanup } = await (runner as any).stream(`${name} private message`, {
    runId: 'shared-run-id',
    memory: { thread: `${name}-thread`, resource: `${name}-user` },
  });
  for await (const _ of output.fullStream);
  await cleanup?.();
  return prompts;
}

describe('runId reuse across Mastra apps', () => {
  // The first run ends on a tripwire while its workflow is still finishing in the
  // background; the second run starts immediately with the same runId.
  it.each<[Kind, Kind]>([
    ['durable', 'durable'],
    ['durable', 'evented'],
    ['evented', 'evented'],
    ['evented', 'durable'],
  ])("%s -> %s: the second app's model never sees the first app's run", async (first, second) => {
    await runTenant('alice', first, true);
    const bobPrompts = await runTenant('bob', second, false);

    expect(bobPrompts.length).toBeGreaterThan(0);
    expect(bobPrompts.join('\n')).not.toMatch(/alice/);
  });
});
