import { describe, expect, it } from 'vitest';

import { knowledgeSessionTags, LOCAL_KNOWLEDGE_ORG_ID, resolveKnowledgeSessionScopes } from './knowledge-scope.js';

describe('resolveKnowledgeSessionScopes', () => {
  it('gives a local session with no host tags the fixed local org, regardless of project or machine', () => {
    const expected = { resolved: true, scopes: [{ scope: 'org:local', access: 'write' }] };
    expect(LOCAL_KNOWLEDGE_ORG_ID).toBe('local');
    expect(resolveKnowledgeSessionScopes(undefined)).toEqual(expected);
    expect(resolveKnowledgeSessionScopes({ projectPath: '/tmp/p' } as never)).toEqual(expected);
    expect(resolveKnowledgeSessionScopes({ projectPath: '/tmp/other' } as never, ['resource:u1'])).toEqual({
      resolved: true,
      scopes: ['resource:u1', { scope: 'org:local', access: 'write' }],
    });
  });

  it('adds no org:local once the host gives any shared tag, read-only included', () => {
    expect(resolveKnowledgeSessionScopes(undefined, ['team:self:x', 'agent:alex'])).toEqual({
      resolved: true,
      scopes: ['team:self:x', 'agent:alex'],
    });
    const member = [{ scope: 'org:self', access: 'read' as const }, 'team:self:x'];
    expect(resolveKnowledgeSessionScopes(undefined, member)).toEqual({ resolved: true, scopes: member });
  });

  it('requires the Factory org and project tags, trimmed the way the seeder stores them', () => {
    expect(resolveKnowledgeSessionScopes({ factoryOrgId: ' org-1 ', factoryProjectId: 'proj-1' } as never)).toEqual({
      resolved: true,
      scopes: [
        { scope: 'org:org-1', access: 'write' },
        { scope: 'project:proj-1', access: 'write' },
      ],
    });
    expect(resolveKnowledgeSessionScopes({ factoryOrgId: 'org-1' } as never, ['agent:a'])).toEqual({
      resolved: true,
      scopes: ['agent:a', { scope: 'org:org-1', access: 'write' }],
    });
  });

  it('keeps two Factory projects apart and refuses a host tag that names another org or project', () => {
    const a = resolveKnowledgeSessionScopes({ factoryOrgId: 'o', factoryProjectId: 'a' } as never);
    const b = resolveKnowledgeSessionScopes({ factoryOrgId: 'o', factoryProjectId: 'b' } as never);
    expect(a.resolved && knowledgeSessionTags(a.scopes)).toEqual(['org:o', 'project:a']);
    expect(b.resolved && knowledgeSessionTags(b.scopes)).toEqual(['org:o', 'project:b']);

    expect(resolveKnowledgeSessionScopes({ factoryOrgId: 'o', factoryProjectId: 'a' } as never, ['org:other'])).toEqual(
      {
        resolved: false,
        reason: "Scope org:other conflicts with this Factory session's org:o.",
      },
    );
    expect(resolveKnowledgeSessionScopes({ factoryOrgId: 'o', factoryProjectId: 'a' } as never, ['project:b'])).toEqual(
      { resolved: false, reason: "Scope project:b conflicts with this Factory session's project:a." },
    );
  });

  it('fails closed for Factory-owned sessions without a resolved org', () => {
    const closed = { resolved: false, reason: 'This Factory session has no resolved organization.' };
    expect(resolveKnowledgeSessionScopes({ factoryProjectId: 'proj-1' } as never)).toEqual(closed);
    expect(resolveKnowledgeSessionScopes({ factoryProjectId: 'proj-1', factoryOrgId: '   ' } as never)).toEqual(closed);
    expect(resolveKnowledgeSessionScopes({ factoryOrgUnresolved: true } as never)).toEqual(closed);
  });
});
