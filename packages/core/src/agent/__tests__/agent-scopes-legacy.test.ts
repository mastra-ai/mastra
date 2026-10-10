import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { MASTRA_SCOPES_KEY, RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

function legacyAgent(scopes?: string[]) {
  const memory = new MockMemory({ storage: new InMemoryStore() });
  const agent = new Agent({
    id: 'legacy-scopes',
    name: 'Legacy Scopes',
    instructions: 'Test',
    model: new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
        text: 'ok',
      }),
    }),
    memory,
    scopes,
  });
  return { agent, memory };
}

describe('agent scopes on legacy runs', () => {
  it('generateLegacy reads memory identity from agent and request context scopes', async () => {
    const { agent, memory } = legacyAgent(['resource:u1']);
    await agent.generateLegacy('hello', {
      requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['thread:t1']]]),
    });
    const thread = await memory.getThreadById({ threadId: 't1' });
    expect(thread?.resourceId).toBe('u1');
  });

  it('generateLegacy throws when agent scopes conflict with memory options', async () => {
    const { agent } = legacyAgent(['thread:a']);
    await expect(agent.generateLegacy('hello', { memory: { resource: 'u1', thread: 'b' } })).rejects.toMatchObject({
      id: 'AGENT_SCOPES_CONFLICT',
    });
  });
});
