import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';

function completionModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
      warnings: [],
      content: [{ type: 'text' as const, text: '<import-complete checkpoint="cursor-1" />' }],
    }),
  });
}

describe('agentic Knowledge importer observational memory', () => {
  it('stores each run transcript in a distinct thread under one stable binding resource', async () => {
    const storage = new InMemoryStore({ id: 'agentic-import-memory' });
    const model = completionModel();
    const memory = new Memory({
      storage,
      options: {
        observationalMemory: {
          scope: 'resource',
          model,
          observation: { messageTokens: 10_000 },
        },
      },
    });
    const agent = new Agent({
      id: 'knowledge-import-agent',
      name: 'Knowledge import agent',
      instructions: 'Integrate source evidence.',
      model,
      memory,
    });
    const binding = { source: 'slack:workspace-1', scope: 'project:mastra' } as const;
    const resourceIds: string[] = [];
    const knowledge = new Knowledge({
      id: 'shipyard',
      storage,
      structure: {
        scopes: [
          { address: 'org:acme', name: 'Acme' },
          { address: binding.scope, name: 'Mastra', parentAddresses: ['org:acme'] },
        ],
      },
      importers: [
        {
          id: 'slack-distiller',
          access: { 'project:$projectId': 'edit' },
          agentic: { agent },
          handler: async context => {
            const result = await context.agentImport!({
              instructions: 'Capture durable architecture decisions only.',
              data: { messages: [] },
              checkpoint: 'cursor-1',
            });
            resourceIds.push(result.resourceId);
          },
        },
      ],
    });
    await knowledge.reconcile();
    const importer = knowledge.getImporter('slack-distiller')!;

    const first = await importer.run(binding);
    const second = await importer.run(binding);

    expect(first).toMatchObject({ status: 'succeeded', importKind: 'agentic' });
    expect(second).toMatchObject({ status: 'succeeded', importKind: 'agentic' });
    const firstThread = await memory.getThreadById({ threadId: first.transcriptThreadId! });
    const secondThread = await memory.getThreadById({ threadId: second.transcriptThreadId! });
    expect(firstThread?.id).toBe(first.transcriptThreadId);
    expect(secondThread?.id).toBe(second.transcriptThreadId);
    expect(resourceIds).toHaveLength(2);
    expect(firstThread?.resourceId).toBe(resourceIds[0]);
    expect(secondThread?.resourceId).toBe(resourceIds[1]);
    expect(resourceIds[1]).toBe(resourceIds[0]);
    expect(secondThread?.id).not.toBe(firstThread?.id);
  });
});
