import { describe, expect, it } from 'vitest';
import { compileKnowledgeScopes } from '../declarations';
import { knowledgeAgentScopes, knowledgePersonaScopes } from '../index';

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
});
