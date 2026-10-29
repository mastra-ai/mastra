import { describe, expect, it } from 'vitest';
import {
  bindKnowledgePattern,
  compileKnowledgeScopes,
  KnowledgeDeclarationError,
  knowledgeMemoryScopes,
  knowledgePatternPrefix,
  knowledgeRunScopes,
  knowledgeScopeAddress,
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
    expect(compiled.match('role:acme:admin:x')).toBeNull();
  });

  it('loads disjoint patterns of the same type and resolves their unique declaration', () => {
    const roles = ['admin', 'support', 'sales', 'member'];
    const multi = compileKnowledgeScopes(Object.fromEntries(roles.map(role => [`role:$orgId:${role}`, {}])));
    for (const role of roles) {
      expect(multi.match(`role:acme:${role}`)).toMatchObject({
        declaration: `role:$orgId:${role}`,
        params: { orgId: 'acme' },
      });
    }
    expect(multi.match('role:acme:admin:x')).toBeNull();
    expect(multi.match('role:acme:unknown')).toBeNull();
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

  it('encodes middle-segment colons without reaching another tenant', () => {
    expect(compiled.match('org:a:b')!.params).toEqual({ orgId: 'a:b' });
    expect(knowledgePatternPrefix(team, { orgId: 'a:b' })).toBe('team:a%3Ab:');
    expect(bindKnowledgePattern(team, { orgId: 'a:b', teamId: 'support' })).toBe('team:a%3Ab:support');
    expect(knowledgePatternPrefix(team, { orgId: 'a' })).toBe('team:a:');
  });

  it('preserves final colons and encodes reserved characters in every param', () => {
    expect(bindKnowledgePattern(team, { orgId: 'a', teamId: 'b:c' })).toBe('team:a:b:c');
    expect(bindKnowledgePattern(team, { orgId: 'a', teamId: 'b/c' })).toBe('team:a:b%2Fc');
    expect(knowledgePatternPrefix(account, { orgId: 'a/b' })).toBe('account:a%2Fb:');
  });

  it("doesn't match an undeclared child as a param value", () => {
    expect(compiled.match('account:acme:1/internal')!.declaration).toBe('account:$orgId:$accountId/internal');
    expect(compiled.match('account:acme:1/foo')).toBeNull();
  });

  it('round-trips Memory ids while keeping raw run scopes distinct from canonical addresses', () => {
    const raw = ['resource:https://x/y#z', 'resource:a/b', 'resource:a%2Fb'];
    expect(knowledgeRunScopes(compiled, raw)).toEqual([
      'resource:https:%2F%2Fx%2Fy%23z',
      'resource:a%2Fb',
      'resource:a%252Fb',
    ]);
    expect(raw[0]).toBe('resource:https://x/y#z');
    expect(compiled.match('resource:https:%2F%2Fx%2Fy%23z')?.params).toEqual({ resourceId: 'https://x/y#z' });
    expect(knowledgeScopeAddress('resource:$resourceId', { resourceId: 'https://x/y#z' })).toBe(
      'resource:https:%2F%2Fx%2Fy%23z',
    );
    expect(knowledgeRunScopes(compiled, [...raw])).toEqual(knowledgeRunScopes(compiled, raw));
  });

  it('keeps raw slash and hash out of canonical addresses, including types without children', () => {
    expect(compiled.match('team:a/b:eng')).toBeNull();
    expect(compiled.match('resource:a/b')).toBeNull();
    expect(compiled.match('resource:a#b')).toBeNull();
    expect(knowledgePatternPrefix(team, { orgId: 'a/b' })).toBe('team:a%2Fb:');
    expect(bindKnowledgePattern(account, { orgId: 'acme', accountId: 'x/internal' })).toBe('account:acme:x%2Finternal');
    expect(compiled.match('account:acme:x%2Finternal')?.compiled.child).toBeUndefined();
    expect(compiled.match('account:acme:x/y')).toBeNull();
  });

  it('provides an explicit canonical helper, never interpreting percent as an ingress escape', () => {
    expect(knowledgeScopeAddress('team:$orgId:$teamId', { orgId: 'a:b', teamId: 'c/d#e%2F' })).toBe(
      'team:a%3Ab:c%2Fd%23e%252F',
    );
    expect(knowledgeRunScopes(compiled, ['team:a:b:c'])).toEqual(['team:a:b:c']);
    expect(() => knowledgeScopeAddress('team:$orgId:$teamId', { orgId: 'a', teamId: '' })).toThrow(
      KnowledgeDeclarationError,
    );
    expect(() => compileKnowledgeScopes({ 'org:$orgId': {}, 'org:a#b': {} })).toThrow(KnowledgeDeclarationError);
  });
});

describe('compileKnowledgeScopes: validation', () => {
  it('refuses overlapping patterns for one type', () => {
    expect(() => compileKnowledgeScopes({ 'team:$orgId:$teamId': {}, 'team:$teamId': {} })).toThrow(
      KnowledgeDeclarationError,
    );
  });

  it('names both overlapping patterns, including final-parameter overlap with longer patterns', () => {
    for (const [left, right] of [
      ['role:$orgId:$role', 'role:$orgId:admin'],
      ['kb:$orgId:$name', 'kb:$orgId:public'],
      ['role:$orgId', 'role:$orgId:admin'],
    ]) {
      let error: unknown;
      try {
        compileKnowledgeScopes({ [left!]: {}, [right!]: {} });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(KnowledgeDeclarationError);
      expect((error as Error).message).toContain(left);
      expect((error as Error).message).toContain(right);
    }
  });

  it('refuses concrete addresses without a matching declared pattern', () => {
    expect(() => compileKnowledgeScopes({ 'role:acme:admin': {} })).toThrow(/role:acme:admin.*pattern/);
    expect(() => compileKnowledgeScopes({ 'role:$orgId:support': {}, 'role:acme:admin': {} })).toThrow(
      /role:acme:admin.*pattern/,
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
