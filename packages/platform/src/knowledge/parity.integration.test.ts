import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { PostgresStore } from '@mastra/pg';
import { describe, expect, it } from 'vitest';
import { PlatformKnowledge } from './index';

const apiUrl = process.env.KNOWLEDGE_TEST_API_URL;
const databaseUrl = process.env.KNOWLEDGE_TEST_DATABASE_URL;
const instanceId = process.env.MASTRA_KNOWLEDGE_INSTANCE_ID;
const token = process.env.MASTRA_PLATFORM_ACCESS_TOKEN;

function searchModel() {
  let step = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: (step++ === 0 ? 'tool-calls' : 'stop') as 'tool-calls' | 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content:
        step === 1
          ? [
              {
                type: 'tool-call' as const,
                toolCallId: 'search-1',
                toolName: 'knowledge_search',
                input: JSON.stringify({ query: 'integration' }),
              },
            ]
          : [{ type: 'text' as const, text: 'Done.' }],
      warnings: [],
    }),
  });
}

describe.runIf(apiUrl && databaseUrl && instanceId && token)('Postgres and PlatformKnowledge public API parity', () => {
  const runId = randomUUID();
  const scope = `resource:${runId}`;
  const scopes = { ...knowledgeMemoryScopes(), 'docs:$instanceId': { access: [] } };
  it('matches host writes, discovery, search, reads, and agent scope denial', async () => {
    const directStore = new PostgresStore({ id: `direct-knowledge-${runId}`, connectionString: databaseUrl! });
    const direct = new Knowledge({ scopes, storage: directStore, tools: true });
    // The instance serves the declarations, Memory's among them; PlatformKnowledge declares none.
    const remote = new PlatformKnowledge({ tools: true, apiUrl, instanceId, accessToken: token });
    try {
      for (const knowledge of [direct, remote]) {
        const rootScope = `org:${randomUUID()}`;
        const page = await knowledge.upsertPage({
          scope: rootScope,
          path: 'integration-guide',
          name: 'Integration guide',
          body: 'Knowledge integration works',
          author: 'host',
        });
        expect(page.page.name).toBe('Integration guide');
        const store = await knowledge.getStorage();
        const read = await knowledge.readScopeFor([rootScope]);
        expect((await store.listPages({ read })).pages.map(p => p.name)).toContain('Integration guide');
        expect((await store.searchPages({ query: 'integration', read })).map(hit => hit.page.name)).toContain(
          'Integration guide',
        );
        expect((await store.getPage({ id: page.page.id, read }))?.body).toBe('Knowledge integration works');
        const unchanged = await knowledge.upsertPage({
          scope: rootScope,
          path: 'integration-guide',
          name: 'Integration guide',
          body: 'Knowledge integration works',
        });
        expect(unchanged.status).toBe('unchanged');
        const updated = await knowledge.upsertPage({
          scope: rootScope,
          path: 'integration-guide',
          name: 'Integration guide',
          body: 'Knowledge integration works again',
        });
        expect(updated.status).toBe('updated');
        const when = new Date('2026-01-02T03:04:05Z');
        const note = await knowledge.addNote({
          scope: rootScope,
          path: 'integration-guide',
          text: 'Confirmed by host',
          when,
        });
        expect((await store.getNote({ id: note.id, read }))?.when).toEqual(when);
        const agent = new Agent({
          id: `reader-${randomUUID()}`,
          name: 'Reader',
          instructions: 'Search knowledge.',
          model: searchModel(),
          knowledge,
          scopes: [rootScope],
        });
        const result = await agent.generate('Find the integration guide.', {
          maxSteps: 2,
          memory: { thread: 'thread-1', resource: runId },
        });
        expect(JSON.stringify(result.steps.flatMap(step => step.toolResults))).toContain('Integration guide');
        const denied = await knowledge.readScopeFor([scope]);
        expect(await store.searchPages({ query: 'integration', read: denied })).toHaveLength(0);
      }
    } finally {
      await directStore.close();
    }
  });

  it('rejects invalid project credentials and foreign instances before storage access', async () => {
    for (const options of [
      { accessToken: 'wrong', instanceId },
      { accessToken: token, instanceId: 'foreign-instance' },
    ]) {
      const knowledge = new PlatformKnowledge({ apiUrl, ...options });
      await expect(knowledge.getStorage().then(store => store.listPages({ read: 'all' }))).rejects.toThrow();
    }
  });
});
