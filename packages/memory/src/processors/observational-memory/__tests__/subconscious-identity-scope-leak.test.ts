import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { MASTRA_SCOPES_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../..';
import { Subconscious } from '../subconscious';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function browsingModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'knowledge_browse', input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
      };
    },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('Knowledge writes under run identity scopes', () => {
  it('materializes only the Core-derived org/resource/thread rungs, never a leaked identity scope', async () => {
    const storage = new InMemoryStore();
    const knowledge = new Knowledge({ id: 'default', storage });
    const materialized: string[] = [];
    const seenScopes: unknown[] = [];
    const materializeScope = knowledge.materializeScope.bind(knowledge);
    vi.spyOn(knowledge, 'materializeScope').mockImplementation(async input => {
      materialized.push(input.address);
      return materializeScope(input);
    });
    const memory = new Memory({
      storage,
      knowledge,
      vector: {
        indexSeparator: '_',
        listIndexes: async () => [],
        createIndex: async () => {},
        upsert: async ({ ids }: { ids: string[] }) => ids,
        deleteVectors: async () => {},
        query: async () => [],
      } as any,
      embedder: {
        doEmbed: async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1]) }),
      } as any,
      options: {
        observationalMemory: {
          model: 'google/gemini-2.5-flash',
          experimental_subconscious: new Subconscious({ tools: true }),
        },
      },
    });
    const agent = new Agent({
      id: 'identity-agent',
      name: 'Identity Agent',
      instructions: 'Test agent',
      model: browsingModel(),
      memory,
      scopes: ['resource:res-1', 'thread:t-1'],
      inputProcessors: [
        {
          id: 'record-tool-scopes',
          processInputStep: async ({ requestContext }: any) => {
            seenScopes.push(requestContext?.get(MASTRA_SCOPES_KEY));
            return undefined;
          },
        } as any,
      ],
    });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    const output = await agent.stream('browse', { requestContext });
    const result = await output.getFullOutput();
    expect(result.toolResults).toHaveLength(1);
    expect(JSON.stringify(result.toolResults)).not.toContain('isError":true');

    // Identity scopes stay out of what downstream code reads as run scopes...
    for (const scopes of seenScopes) {
      expect((scopes as string[] | undefined) ?? []).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^(resource|thread):/)]),
      );
    }
    // ...and the Knowledge write lands only on rungs derived from the run's memory identity.
    expect(materialized).toEqual(['org:acme', 'resource:res-1', 'resource:res-1:thread:t-1']);
  });
});
