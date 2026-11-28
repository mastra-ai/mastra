import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { compileKnowledgeScopes, knowledgeMemoryScopes } from '../declarations';
import { Knowledge, knowledgeAgentScopes, knowledgePersonaScopes } from '../index';

describe('knowledgePersonaScopes', () => {
  it('opts in to viewer access and short config pins on the three base scopes only', () => {
    const scopes = knowledgePersonaScopes();
    expect(() => compileKnowledgeScopes(scopes)).not.toThrow();
    for (const [key, page] of [
      ['agent:$agentId', 'persona'],
      ['agent:persona:role:$role', 'rules'],
      ['agent:persona:team:$teamId', 'rules'],
    ]) {
      expect(scopes[key!]?.access).toContainEqual({ principal: 'self', role: 'viewer' });
      expect(scopes[key!]?.pages?.map(p => p.key)).toEqual([page]);
      expect(scopes[key!]?.pinnedContext).toEqual([`${key}#${page}`]);
    }
    for (const [key, declaration] of Object.entries(knowledgeAgentScopes())) {
      if (key.includes(':org:') || key.includes(':user:')) expect(scopes[key]).toEqual(declaration);
    }
  });

  it('declares host-only edit identities without minting them', () => {
    const scopes = knowledgePersonaScopes();
    for (const [kind, param] of [
      ['role', 'role'],
      ['team', 'teamId'],
    ]) {
      const key = `agent:persona:${kind}:$${param}`;
      expect(scopes[key]?.access).toContainEqual({ principal: `${key}:edit`, role: 'editor' });
      expect(scopes[`${key}:edit`]).toEqual({ access: [] });
    }
    expect(Object.keys(scopes).filter(key => key.endsWith(':edit'))).toHaveLength(2);
  });

  it('pins #persona into its own agent only and #rules into every agent of that role or team', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore(),
      pinnedContext: true,
      scopes: { ...knowledgeMemoryScopes(), ...knowledgePersonaScopes() },
    });
    await knowledge.upsertPage({ scope: 'agent:sam', path: 'persona', name: 'Persona', body: 'Sam is calm.' });
    await knowledge.upsertPage({ scope: 'agent:persona:role:support', path: 'rules', name: 'Rules', body: 'Refund.' });
    await knowledge.upsertPage({ scope: 'agent:persona:team:billing', path: 'rules', name: 'Rules', body: 'Invoice.' });
    const pinsFor = async (agentId: string, persona: Record<string, string>) => {
      const requestContext = new RequestContext();
      setRunAgentScopes(requestContext, ['org:acme']);
      const pins = await knowledge.__deliveredPins({ requestContext, agent: { agentId, persona } } as never);
      return pins.map(pin => pin.scope).sort();
    };
    expect(await pinsFor('sam', { role: 'support', teamId: 'billing' })).toEqual([
      'agent:persona:role:support',
      'agent:persona:team:billing',
      'agent:sam',
    ]);
    expect(await pinsFor('pat', { role: 'support' })).toEqual(['agent:persona:role:support']);
    expect(await pinsFor('kim', { role: 'sales', teamId: 'billing' })).toEqual(['agent:persona:team:billing']);
    expect(await pinsFor('lee', {})).toEqual([]);
  });

  it('lets a host-passed :edit form write its role rules while a plain role holder only reads', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore(), tools: true, scopes: knowledgePersonaScopes() });
    const write = (principals: string[]) =>
      knowledge.createTools({ principals }).knowledge_page!.execute!(
        { op: 'write', scope: 'agent:persona:role:support', name: 'Escalation', body: 'Refund.' } as never,
        {},
      );
    await expect(write(['agent:persona:role:support'])).rejects.toThrow(/editor|viewer|read-only|can't/i);
    await expect(write(['agent:persona:role:support:edit'])).resolves.toBeDefined();
  });
});
