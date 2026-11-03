import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { PlatformMemory, PlatformMemoryClient } from '@mastra/platform-memory';
import { PostgresStore } from '@mastra/pg';
import { describe, expect, it } from 'vitest';
import { PlatformKnowledge } from './index';

const envFile = process.env.PLATFORM_DUAL_LIVE;
const databaseUrl = process.env.KNOWLEDGE_TEST_DATABASE_URL;

describe.runIf(envFile && databaseUrl)('one Agent with Memory and Knowledge on shared local Platform', () => {
  it('matches OSS agent search, read, write and memory continuity', async () => {
    const { apiUrl, instanceId, knowledgeInstanceId, token } = JSON.parse(readFileSync(envFile!, 'utf8')) as {
      apiUrl: string; instanceId: string; knowledgeInstanceId: string; token: string;
    };
    const id = randomUUID();
    const scope = `org:${id}`;
    const scopes = { ...knowledgeMemoryScopes(), 'docs:$instanceId': { access: [] } };
    const directStore = new PostgresStore({ id: `dual-direct-${id}`, connectionString: databaseUrl! });
    const direct = new Knowledge({ scopes, tools: { read: true }, storage: directStore });
    const remote = new PlatformKnowledge({ scopes, apiUrl, instanceId: knowledgeInstanceId, accessToken: token });
    const client = new PlatformMemoryClient({ apiUrl, instanceId, accessToken: token });
    const runs = [
      { knowledge: direct, memory: new Memory({ storage: new InMemoryStore() }) },
      { knowledge: remote, memory: new PlatformMemory({ client, workingMemory: 'off' }) },
    ];
    try {
      const outcomes: Array<{ first: string; second: string; found: boolean; remembered: boolean }> = [];
      for (const { knowledge, memory } of runs) {
        const page = await knowledge.upsertPage({ scope, path: 'dual-guide', name: 'Dual guide', body: 'The shared blue lantern is on the desk.' });
        const read = await knowledge.readScopeFor([scope]);
        const store = await knowledge.getStorage();
        expect((await store.getPage({ id: page.page.id, read }))?.body).toContain('blue lantern');
        const prompts: string[] = [];
        let step = 0;
        const model = new MockLanguageModelV2({
          doGenerate: async ({ prompt }) => {
            prompts.push(JSON.stringify(prompt));
            const search = step++ % 2 === 0;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: search ? 'tool-calls' : 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              content: search
                ? [{ type: 'tool-call', toolCallId: `search-${step}`, toolName: 'knowledge_search', input: JSON.stringify({ query: 'blue lantern' }) }]
                : [{ type: 'text', text: 'The blue lantern is on the desk.' }],
              warnings: [],
            } as never;
          },
        });
        const agent = new Agent({ id: `dual-${id}`, name: 'Dual parity', instructions: 'Use Knowledge to answer.', model, knowledge, memory, scopes: [scope] });
        const thread = `${id}-${knowledge === direct ? 'direct' : 'hosted'}`;
        const first = await agent.generate('Find the blue lantern.', { maxSteps: 2, memory: { thread, resource: id } });
        const second = await agent.generate('Where was it?', { maxSteps: 2, memory: { thread, resource: id } });
        outcomes.push({
          first: first.text,
          second: second.text,
          found: JSON.stringify(first.steps.flatMap(s => s.toolResults)).includes('Dual guide'),
          remembered: prompts.slice(2).some(p => p.includes('Find the blue lantern.')),
        });
      }
      expect(outcomes[0]).toEqual(outcomes[1]);
      expect(outcomes[1]).toEqual({ first: 'The blue lantern is on the desk.', second: 'The blue lantern is on the desk.', found: true, remembered: true });
    } finally {
      await directStore.close();
    }
  }, 120_000);
});
