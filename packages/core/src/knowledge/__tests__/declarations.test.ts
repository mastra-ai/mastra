import { describe, expect, it } from 'vitest';
import {
  bindKnowledgePattern,
  compileKnowledgeScopes,
  KnowledgeDeclarationError,
  knowledgeMemoryScopes,
  knowledgePatternPrefix,
} from '../declarations';

const scopes = {
  ...knowledgeMemoryScopes(),
  'team:$orgId:$teamId': {
    description: 'A team',
    access: [
      { principal: 'self', role: 'editor' as const },
      { principal: 'org:$orgId', role: 'viewer' as const },
    ],
    belongsTo: 'org:$orgId',
  },
  'role:$orgId:admin': { description: 'Org administrators' },
  'policy:$orgId': {
    access: [
      { principal: 'org:$orgId', role: 'viewer' as const },
      { principal: 'role:$orgId:admin', role: 'owner' as const },
    ],
  },
  'account:$orgId:$accountId': {
    access: [{ principal: 'self', role: 'editor' as const }],
    children: [{ name: 'internal', access: [{ principal: 'role:$orgId:admin', role: 'editor' as const }] }],
  },
  'feature:$orgId:$featureId': {},
  'feature:acme:a': { access: [{ principal: 'team:acme:eng', role: 'editor' as const }] },
};

describe('compileKnowledgeScopes: matching', () => {
  const compiled = compileKnowledgeScopes(scopes);

  it('binds params, with the last param taking the rest of the value', () => {
    expect(compiled.match('team:acme:support')).toMatchObject({
      declaration: 'team:$orgId:$teamId',
      params: { orgId: 'acme', teamId: 'support' },
    });
    expect(compiled.match('resource:user:123')).toMatchObject({
      declaration: 'resource:$resourceId',
      params: { resourceId: 'user:123' },
    });
    expect(compiled.match('team:acme:support:emea')?.params).toEqual({ orgId: 'acme', teamId: 'support:emea' });
  });

  it('matches literal segments exactly', () => {
    expect(compiled.match('role:acme:admin')?.params).toEqual({ orgId: 'acme' });
    expect(compiled.match('role:acme:member')).toBeNull();
  });

  it('matches template children by their parent and name', () => {
    expect(compiled.match('account:acme:1/internal')).toMatchObject({
      declaration: 'account:$orgId:$accountId/internal',
      params: { orgId: 'acme', accountId: '1' },
    });
  });

  it('keeps the pattern as the declaration of a concrete address and adds its rules', () => {
    expect(compiled.match('feature:acme:a')).toMatchObject({ declaration: 'feature:$orgId:$featureId' });
  });

  it('returns null for undeclared types and empty values', () => {
    expect(compiled.match('project:x')).toBeNull();
    expect(compiled.match('team:acme:')).toBeNull();
    expect(compiled.match('team')).toBeNull();
  });
});

describe('binding params into patterns', () => {
  const compiled = compileKnowledgeScopes(scopes);
  const team = compiled.declarations.get('team:$orgId:$teamId')!.pattern;
  const account = compiled.declarations.get('account:$orgId:$accountId')!.pattern;

  it("won't bind a ':' value into a middle segment, which would reach another tenant", () => {
    // org:a:b has orgId "a:b"; as a prefix it would be team:a:b:, matching team:a:b:support (org a).
    expect(compiled.match('org:a:b')!.params).toEqual({ orgId: 'a:b' });
    expect(knowledgePatternPrefix(team, { orgId: 'a:b' })).toBeNull();
    expect(bindKnowledgePattern(team, { orgId: 'a:b', teamId: 'support' })).toBeNull();
    expect(knowledgePatternPrefix(team, { orgId: 'a' })).toBe('team:a:');
  });

  it("allows ':' only in the last segment and '/' nowhere", () => {
    expect(bindKnowledgePattern(team, { orgId: 'a', teamId: 'b:c' })).toBe('team:a:b:c');
    expect(bindKnowledgePattern(team, { orgId: 'a', teamId: 'b/c' })).toBeNull();
    expect(knowledgePatternPrefix(account, { orgId: 'a/b' })).toBeNull();
  });

  it("doesn't match an undeclared child as a param value", () => {
    expect(compiled.match('account:acme:1/internal')!.declaration).toBe('account:$orgId:$accountId/internal');
    expect(compiled.match('account:acme:1/foo')).toBeNull();
    expect(compiled.match('resource:user/1')).toBeNull();
  });
});

describe('compileKnowledgeScopes: validation', () => {
  it('refuses two patterns for one type', () => {
    expect(() => compileKnowledgeScopes({ 'team:$orgId:$teamId': {}, 'team:$teamId': {} })).toThrow(
      KnowledgeDeclarationError,
    );
  });

  it('refuses a rule principal of an undeclared type', () => {
    expect(() =>
      compileKnowledgeScopes({ 'team:$teamId': { access: [{ principal: 'orgg:$teamId', role: 'viewer' }] } }),
    ).toThrow(/orgg:\$teamId.*not a declared scope type/);
  });

  it('refuses a principal param the target address cannot bind', () => {
    expect(() =>
      compileKnowledgeScopes({
        'org:$orgId': {},
        'team:$teamId': { access: [{ principal: 'org:$orgId', role: 'viewer' }] },
      }),
    ).toThrow(/\$orgId/);
  });

  it('refuses a rule whose reach is not a prefix and suggests a fix', () => {
    expect(() =>
      compileKnowledgeScopes({
        'y:$b': {},
        'x:$a:$b': { access: [{ principal: 'y:$b', role: 'viewer' }] },
      }),
    ).toThrow(/reorder.*belongsTo/);
  });

  it('accepts a param bound through belongsTo', () => {
    expect(() =>
      compileKnowledgeScopes({
        'org:$orgId': {},
        'role:$orgId:admin': {},
        'resource:$resourceId': {
          belongsTo: 'org:$orgId',
          access: [{ principal: 'role:$orgId:admin', role: 'viewer' }],
        },
      }),
    ).not.toThrow();
  });

  it('refuses a belongsTo of an undeclared type', () => {
    expect(() => compileKnowledgeScopes({ 'team:$teamId': { belongsTo: 'org:$orgId' } })).toThrow(/belongsTo/);
  });

  it('refuses duplicate child names', () => {
    expect(() =>
      compileKnowledgeScopes({ 'account:$id': { children: [{ name: 'internal' }, { name: 'internal' }] } }),
    ).toThrow(/declared twice/);
  });

  it('refuses belongsTo, children or pages on a concrete address of a typed scope', () => {
    for (const extra of [
      { belongsTo: 'org:$orgId' },
      { children: [{ name: 'x' }] },
      { pages: [{ key: 'k', name: 'K' }] },
    ]) {
      expect(() => compileKnowledgeScopes({ ...knowledgeMemoryScopes(), 'org:acme': extra })).toThrow(
        /can only add description, access, pins and pinPriority/,
      );
    }
    expect(() =>
      compileKnowledgeScopes({ ...knowledgeMemoryScopes(), 'org:acme': { description: 'Acme', pins: ['org:acme#p'] } }),
    ).not.toThrow();
  });

  it('refuses an invalid key', () => {
    expect(() => compileKnowledgeScopes({ 'Team:$x': {} })).toThrow(KnowledgeDeclarationError);
    expect(() => compileKnowledgeScopes({ 'team:': {} })).toThrow(KnowledgeDeclarationError);
  });
});

describe('knowledgeMemoryScopes', () => {
  it('declares thread, resource and org with the default roles, placement and pin priority', () => {
    const declared = knowledgeMemoryScopes();
    expect(declared['thread:$threadId']).toMatchObject({
      access: [{ principal: 'self', role: 'owner' }],
      belongsTo: 'resource:$resourceId',
    });
    expect(declared['resource:$resourceId']).toMatchObject({
      access: [{ principal: 'self', role: 'owner' }],
      belongsTo: 'org:$orgId',
    });
    expect(declared['org:$orgId']).toMatchObject({ access: [{ principal: 'self', role: 'editor' }] });
    expect(declared['thread:$threadId']!.pinPriority!).toBeGreaterThan(declared['resource:$resourceId']!.pinPriority!);
    expect(declared['resource:$resourceId']!.pinPriority!).toBeGreaterThan(declared['org:$orgId']!.pinPriority!);
  });

  it('renames the tenant scope, makes it append-only, or leaves it out', () => {
    expect(knowledgeMemoryScopes({ org: 'workspace:$workspaceId' })['resource:$resourceId']!.belongsTo).toBe(
      'workspace:$workspaceId',
    );
    expect(knowledgeMemoryScopes({ orgRole: 'contributor' })['org:$orgId']!.access).toEqual([
      { principal: 'self', role: 'contributor' },
    ]);
    const noOrg = knowledgeMemoryScopes({ org: false });
    expect(Object.keys(noOrg).sort()).toEqual(['resource:$resourceId', 'thread:$threadId']);
    expect(noOrg['resource:$resourceId']!.belongsTo).toBeUndefined();
  });
});
