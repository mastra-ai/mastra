import { hostname } from 'node:os';

import { describe, expect, it } from 'vitest';

import { localKnowledgeOrgId, resolveKnowledgeScopeIdentity } from './knowledge-scope.js';

describe('resolveKnowledgeScopeIdentity', () => {
  it('derives the local org from the machine only, not the checkout', () => {
    expect(localKnowledgeOrgId('beast')).toMatch(/^mastracode-[0-9a-f]{12}$/);
    expect(localKnowledgeOrgId('beast')).toBe(localKnowledgeOrgId('beast'));
    expect(localKnowledgeOrgId('beast')).not.toBe(localKnowledgeOrgId('other'));
    expect(localKnowledgeOrgId()).toBe(localKnowledgeOrgId(hostname()));
  });

  it('defaults TUI/studio sessions to the machine org regardless of project', () => {
    const expected = { resolved: true, organizationId: localKnowledgeOrgId() };
    expect(resolveKnowledgeScopeIdentity(undefined)).toEqual(expected);
    expect(resolveKnowledgeScopeIdentity({ projectPath: '/tmp/p' } as never)).toEqual(expected);
    expect(resolveKnowledgeScopeIdentity({ projectPath: '/tmp/other' } as never)).toEqual(expected);
  });

  it('anchors Factory project sessions on the seeded org and project ids', () => {
    expect(resolveKnowledgeScopeIdentity({ factoryOrgId: 'org-1', factoryProjectId: 'proj-1' } as never)).toEqual({
      resolved: true,
      organizationId: 'org-1',
      knowledgeResourceId: 'proj-1',
    });
  });

  it('trims the org id the way the Factory seeder stores it', () => {
    expect(resolveKnowledgeScopeIdentity({ factoryOrgId: ' org-1 ' } as never)).toEqual({
      resolved: true,
      organizationId: 'org-1',
      knowledgeResourceId: undefined,
    });
  });

  it('keeps the session resource for an org-only Factory session', () => {
    expect(resolveKnowledgeScopeIdentity({ factoryOrgId: 'org-1' } as never)).toEqual({
      resolved: true,
      organizationId: 'org-1',
      knowledgeResourceId: undefined,
    });
  });

  it('fails closed for Factory-owned sessions without a resolved org', () => {
    expect(resolveKnowledgeScopeIdentity({ factoryProjectId: 'proj-1' } as never)).toEqual({
      resolved: false,
      knowledgeResourceId: 'proj-1',
    });
    expect(resolveKnowledgeScopeIdentity({ factoryProjectId: 'proj-1', factoryOrgId: '   ' } as never)).toEqual({
      resolved: false,
      knowledgeResourceId: 'proj-1',
    });
    expect(resolveKnowledgeScopeIdentity({ factoryOrgUnresolved: true } as never)).toEqual({
      resolved: false,
      knowledgeResourceId: undefined,
    });
  });
});
