import { Knowledge, knowledgeMemoryScopes, knowledgePersonaScopes } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { MastraCompositeStore } from '@mastra/core/storage';
import type { KnowledgeStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * `knowledgePersonaScopes()` on a real store: each agent's `#persona` page pins into that agent's runs
 * only, a role's `#rules` into every agent of that role, a team's into every agent on that team. The
 * identities are minted from the run's agent id and `metadata.persona`.
 */
export function createKnowledgePersonaScopeTests(
  createStore: () => Promise<KnowledgeStorage> | KnowledgeStorage,
): void {
  describe('Knowledge persona scopes', () => {
    let knowledge: Knowledge;

    beforeEach(async () => {
      const store = await createStore();
      await store.init();
      await store.dangerouslyClearAll();
      const storage = new MastraCompositeStore({ id: 'persona-scopes', domains: { knowledge: store } });
      knowledge = new Knowledge({
        storage,
        tools: true,
        pinnedContext: true,
        scopes: { ...knowledgeMemoryScopes(), ...knowledgePersonaScopes() },
      });
      await knowledge.upsertPage({ scope: 'agent:sam', path: 'persona', name: 'Persona', body: 'Sam is calm.' });
      await knowledge.upsertPage({
        scope: 'agent:persona:role:support',
        path: 'rules',
        name: 'Rules',
        body: 'Refund.',
      });
      await knowledge.upsertPage({ scope: 'agent:persona:team:billing', path: 'rules', name: 'Rules', body: 'Bill.' });
    });

    const pinsFor = async (agentId: string, persona: Record<string, string>) => {
      const context = {
        requestContext: new RequestContext(),
        agent: { agentId, resourceId: `user-${agentId}`, threadId: `thread-${agentId}`, persona },
      };
      return (await knowledge.__deliveredPins(context as never)).map(pin => pin.scope).sort();
    };

    it('pins #persona to its own agent and #rules to every agent of that role or team', async () => {
      expect(await pinsFor('sam', { role: 'support', teamId: 'billing' })).toEqual([
        'agent:persona:role:support',
        'agent:persona:team:billing',
        'agent:sam',
      ]);
      expect(await pinsFor('pat', { role: 'support' })).toEqual(['agent:persona:role:support']);
      expect(await pinsFor('kim', { role: 'sales', teamId: 'billing' })).toEqual(['agent:persona:team:billing']);
      expect(await pinsFor('lee', {})).toEqual([]);
    });

    it('lets only a host-passed :edit form write role rules', async () => {
      const write = (principals: string[]) =>
        knowledge.createTools({ principals }).knowledge_page!.execute!(
          { op: 'write', scope: 'agent:persona:role:support', name: 'Escalation', body: 'Call.' } as never,
          {} as never,
        );
      await expect(write(['agent:persona:role:support'])).rejects.toThrow();
      await expect(write(['agent:persona:role:support:edit'])).resolves.toBeDefined();
    });
  });
}
