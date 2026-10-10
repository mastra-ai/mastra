import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory, Subconscious } from '@mastra/memory';
import { afterEach, describe, expect, it } from 'vitest';

import { getKnowledgeOrgScopes } from './memory.js';

const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };

function textParts(delta: string) {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: 'stop', usage },
  ];
}

function scriptedModel(id: string, next: () => unknown[]) {
  return {
    specificationVersion: 'v2' as const,
    provider: 'test',
    modelId: id,
    supportedUrls: {},
    async doGenerate(): Promise<never> {
      throw new Error('stream only');
    },
    async doStream() {
      const parts = next();
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  };
}

const embedder = {
  specificationVersion: 'v1' as const,
  provider: 'test',
  modelId: 'embed',
  maxEmbeddingsPerCall: 128,
  supportsParallelCalls: true,
  async doEmbed({ values }: { values: string[] }) {
    return { embeddings: values.map(() => [0.1, 0.2, 0.3, 0.4]) };
  },
};

describe('Mastra Code Knowledge org scope', () => {
  const directories: string[] = [];
  afterEach(async () => {
    delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  });

  it('curates a local session under org:local through the agent scope alone', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const directory = await mkdtemp(join(tmpdir(), 'mastracode-org-scope-'));
    directories.push(directory);
    const url = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: 'org-scope-storage', url });
    const vector = new LibSQLVector({ id: 'org-scope-vector', url });
    await storage.init();

    let curatorCalls = 0;
    const curator = scriptedModel('curator', () => {
      curatorCalls += 1;
      if (curatorCalls > 1) return textParts('Curated.');
      return [
        { type: 'stream-start', warnings: [] },
        {
          type: 'tool-call',
          toolCallId: 'create-atlas',
          toolName: 'knowledge_create',
          input: JSON.stringify({
            name: 'Project Atlas',
            kind: 'project',
            text: '[[Maya Chen]] owns [[Project Atlas]].',
            nodeScope: 'resource',
            scope: 'resource',
          }),
        },
        { type: 'finish', finishReason: 'tool-calls', usage },
      ];
    });
    const subconscious = new Subconscious({ observation: [{ name: 'curate', model: curator as never }] });
    const memory = new Memory({
      storage,
      vector,
      embedder: embedder as never,
      options: {
        observationalMemory: {
          enabled: true,
          scope: 'thread',
          model: scriptedModel('observer', () =>
            textParts('<observations>\nMaya Chen owns Project Atlas.\n</observations>'),
          ) as never,
          experimental_subconscious: subconscious,
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const agent = new Agent({
      id: 'code-agent',
      name: 'Code Agent',
      instructions: 'Answer briefly.',
      model: scriptedModel('main', () => textParts('ok')) as never,
      memory,
      scopes: getKnowledgeOrgScopes(vector),
    });

    // A local (TUI/studio) session: no Factory org in controller state, and no organizationId key.
    const requestContext = new RequestContext([['controller', { getState: () => ({ projectPath: directory }) }]]);
    const output = await agent.stream('Maya Chen owns Project Atlas.', {
      memory: { resource: 'project-1', thread: 'session-1' },
      requestContext,
    });
    await output.consumeStream();
    await subconscious.settled();

    expect(requestContext.get('organizationId')).toBeUndefined();
    const knowledge = (await storage.getStore('knowledge'))!;
    const scope = ['org:local', 'resource:project-1', 'thread:session-1'];
    expect(await knowledge.resolveNode({ name: 'Project Atlas', scope })).toMatchObject({
      scope: ['org:local', 'resource:project-1'],
    });
  });
});
