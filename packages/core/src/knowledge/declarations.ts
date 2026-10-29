/**
 * Knowledge scope declarations: the scope types (patterns such as `team:$orgId:$teamId`) and concrete
 * addresses a Knowledge instance knows, who gets which role on them, where their pages sit in the
 * tree, and which child scopes, pages and pins come with them. Compiled and checked once at
 * construction so typos fail at startup instead of silently granting nothing.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */

/** @experimental */
export type KnowledgeRole = 'viewer' | 'contributor' | 'editor' | 'owner';

/** Roles from weakest to strongest; a role implies every role before it. @experimental */
export const KNOWLEDGE_ROLES: readonly KnowledgeRole[] = ['viewer', 'contributor', 'editor', 'owner'];

/** @experimental */
export function knowledgeRoleAtLeast(role: KnowledgeRole | null | undefined, min: KnowledgeRole): boolean {
  return role != null && KNOWLEDGE_ROLES.indexOf(role) >= KNOWLEDGE_ROLES.indexOf(min);
}

/** @experimental */
export function strongerKnowledgeRole(a: KnowledgeRole | null | undefined, b: KnowledgeRole): KnowledgeRole {
  return a != null && KNOWLEDGE_ROLES.indexOf(a) >= KNOWLEDGE_ROLES.indexOf(b) ? a : b;
}

/**
 * Runs holding `principal` get `role` on the declared scope. `self` is the scope itself; `$params` in
 * the principal are bound from the scope's address, or through its `belongsTo`.
 *
 * @experimental
 */
export interface KnowledgeAccessRule {
  principal: 'self' | (string & {});
  role: KnowledgeRole;
}

/** @experimental */
export interface KnowledgeScopeDeclaration {
  /** Shown to the model and in UIs. */
  description?: string;
  access?: KnowledgeAccessRule[];
  /** Tree placement only; grants nothing. A scope pattern, e.g. `org:$orgId`. */
  belongsTo?: string;
  /** Child scopes created with this scope, at `<address>/<name>`. */
  children?: Array<{ name: string; description?: string; access?: KnowledgeAccessRule[] }>;
  /** Keyed pages created with this scope. */
  pages?: Array<{ key: string; name: string; description?: string }>;
  /** Config pins (page refs) delivered to runs holding this scope. */
  pins?: string[];
  /** Ordering of stored pins delivered through this scope; higher first. Default 0. */
  pinPriority?: number;
}

/** @experimental */
export type KnowledgeScopeDeclarations = Record<string, KnowledgeScopeDeclaration>;

/** @experimental */
export class KnowledgeDeclarationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeDeclarationError';
  }
}

/**
 * Declarations for Memory's identity scopes and a tenant scope: `thread:$threadId` (self owner,
 * placed under the resource), `resource:$resourceId` (self owner, placed under the tenant) and the
 * tenant pattern (default `org:$orgId`, self editor). `org: false` leaves the tenant out; `orgRole:
 * 'contributor'` makes the tenant append-only.
 *
 * @experimental
 */
export function knowledgeMemoryScopes(
  options: { org?: string | false; orgRole?: 'editor' | 'contributor' } = {},
): KnowledgeScopeDeclarations {
  const org = options.org ?? 'org:$orgId';
  const declarations: KnowledgeScopeDeclarations = {
    'thread:$threadId': {
      access: [{ principal: 'self', role: 'owner' }],
      belongsTo: 'resource:$resourceId',
      pinPriority: 2,
    },
    'resource:$resourceId': {
      access: [{ principal: 'self', role: 'owner' }],
      ...(org ? { belongsTo: org } : {}),
      pinPriority: 1,
    },
  };
  if (org) declarations[org] = { access: [{ principal: 'self', role: options.orgRole ?? 'editor' }], pinPriority: 0 };
  return declarations;
}

type Segment = { param: string } | { literal: string };

/** A parsed scope pattern or concrete address. */
export interface KnowledgeScopePattern {
  key: string;
  type: string;
  segments: Segment[];
  params: string[];
  /**
   * Whether the last segment's value may hold `/`. True for types without template children, so a
   * Memory id like `user/123` fills `resource:$resourceId`; false where `<address>/<name>` would
   * read as a child scope.
   */
  slashInLast: boolean;
}

/** How a rule's principal reaches its target scopes. */
export type KnowledgeRuleReach =
  /** The principal is the scope itself. */
  | { kind: 'self' }
  /** The target's params bound from the principal give an exact address (concrete target or every param bound). */
  | { kind: 'exact' }
  /** The principal binds a leading run of the target's params: every target address with that prefix. */
  | { kind: 'prefix' }
  /** The principal binds the target's `belongsTo`: every target scope placed under that scope. */
  | { kind: 'belongsTo' };

export interface CompiledKnowledgeRule {
  /** Null for `self`. */
  principal: KnowledgeScopePattern | null;
  role: KnowledgeRole;
  reach: KnowledgeRuleReach;
}

export interface CompiledKnowledgeDeclaration {
  /** The declaration key, stored on materialized scope pages. */
  key: string;
  pattern: KnowledgeScopePattern;
  declaration: KnowledgeScopeDeclaration;
  rules: CompiledKnowledgeRule[];
  belongsTo?: KnowledgeScopePattern;
  /** Set on template children: the parent declaration and the child's name. */
  child?: { parent: CompiledKnowledgeDeclaration; name: string };
  children: CompiledKnowledgeDeclaration[];
}

export interface KnowledgeScopeMatch {
  declaration: string;
  compiled: CompiledKnowledgeDeclaration;
  params: Record<string, string>;
  /** Extra rules from a concrete-address declaration of this exact address. */
  concreteRules: CompiledKnowledgeRule[];
  concrete?: KnowledgeScopeDeclaration;
}

export interface CompiledKnowledgeScopes {
  /** Every declaration, including template children, by key. */
  declarations: Map<string, CompiledKnowledgeDeclaration>;
  /** Concrete-address declarations and their compiled rules, by address. */
  concrete: Map<string, { declaration: KnowledgeScopeDeclaration; rules: CompiledKnowledgeRule[] }>;
  match(address: string): KnowledgeScopeMatch | null;
}

const TYPE_PATTERN = /^[a-z][a-z0-9_-]*$/;
const PARAM_PATTERN = /^\$[A-Za-z_][A-Za-z0-9_]*$/;
const CHILD_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function parsePattern(key: string, what: string): KnowledgeScopePattern {
  const colon = key.indexOf(':');
  const type = colon === -1 ? key : key.slice(0, colon);
  if (colon === -1 || !TYPE_PATTERN.test(type)) {
    throw new KnowledgeDeclarationError(`${what} "${key}" must look like type:value with a lowercase type.`);
  }
  const segments: Segment[] = key
    .slice(colon + 1)
    .split(':')
    .map(part => {
      if (!part || part.includes('/')) {
        throw new KnowledgeDeclarationError(`${what} "${key}" has an empty or invalid segment.`);
      }
      if (part.startsWith('$')) {
        if (!PARAM_PATTERN.test(part))
          throw new KnowledgeDeclarationError(`${what} "${key}" has an invalid param ${part}.`);
        return { param: part.slice(1) };
      }
      return { literal: part };
    });
  const params = segments.flatMap(segment => ('param' in segment ? [segment.param] : []));
  if (new Set(params).size !== params.length) {
    throw new KnowledgeDeclarationError(`${what} "${key}" repeats a param.`);
  }
  return { key, type, segments, params, slashInLast: false };
}

function matchPattern(pattern: KnowledgeScopePattern, address: string): Record<string, string> | null {
  const prefix = `${pattern.type}:`;
  if (!address.startsWith(prefix)) return null;
  const parts = address.slice(prefix.length).split(':');
  const lastStart = pattern.segments.length - 1;
  if (parts.some((part, i) => part.includes('/') && (i < lastStart || !pattern.slashInLast))) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.segments.length; i++) {
    const segment = pattern.segments[i]!;
    const last = i === pattern.segments.length - 1;
    if ('literal' in segment) {
      if (parts[i] !== segment.literal) return null;
      if (last && parts.length !== pattern.segments.length) return null;
      continue;
    }
    const value = last ? parts.slice(i).join(':') : parts[i];
    if (!value || (last && parts.slice(i).some(part => !part))) return null;
    params[segment.param] = value;
  }
  return params;
}

/**
 * Whether `value` can fill a segment: never empty, and holding `:` or `/` only in the last segment
 * (`/` only where the type has no template children). A value like `a:b` bound into a middle segment
 * would shift every later segment and reach another tenant's scopes.
 */
function fitsSegment(value: string, last: boolean, slashInLast: boolean): boolean {
  if (value === '') return false;
  if (!last) return !value.includes(':') && !value.includes('/');
  return slashInLast || !value.includes('/');
}

/** Fills a pattern's params; returns null when one is missing or can't fill its segment. */
export function bindKnowledgePattern(pattern: KnowledgeScopePattern, params: Record<string, string>): string | null {
  const values: string[] = [];
  for (const [i, segment] of pattern.segments.entries()) {
    if ('literal' in segment) {
      values.push(segment.literal);
      continue;
    }
    const value = params[segment.param];
    if (value === undefined || !fitsSegment(value, i === pattern.segments.length - 1, pattern.slashInLast)) return null;
    values.push(value);
  }
  return `${pattern.type}:${values.join(':')}`;
}

/**
 * The address prefix a partial binding reaches: segments up to the last bound param, ending at a
 * segment boundary. Only valid for a leading run of bound params. Returns null when a bound value
 * can't fill its segment (a prefix always ends before the last segment, so no `:` is allowed).
 */
export function knowledgePatternPrefix(pattern: KnowledgeScopePattern, params: Record<string, string>): string | null {
  let prefix = `${pattern.type}:`;
  for (const segment of pattern.segments) {
    if ('literal' in segment) {
      prefix += `${segment.literal}:`;
      continue;
    }
    const value = params[segment.param];
    if (value === undefined) break;
    if (!fitsSegment(value, false, false)) return null;
    prefix += `${value}:`;
  }
  return prefix;
}

/** Sample address for a pattern, used to check that a principal pattern fits its declared type. */
function sampleAddress(pattern: KnowledgeScopePattern): string {
  return bindKnowledgePattern(pattern, Object.fromEntries(pattern.params.map((param, i) => [param, `p${i}`])))!;
}

/**
 * Compiles and checks declarations: one pattern per type, valid keys, every rule principal of a
 * declared type with params the target can bind, and every rule reach indexable (an address prefix
 * or a `belongsTo` parent).
 *
 * @experimental
 */
export function compileKnowledgeScopes(declarations: KnowledgeScopeDeclarations): CompiledKnowledgeScopes {
  const byType = new Map<string, CompiledKnowledgeDeclaration>();
  const all = new Map<string, CompiledKnowledgeDeclaration>();
  const concreteEntries: Array<[string, KnowledgeScopeDeclaration]> = [];

  for (const [key, declaration] of Object.entries(declarations)) {
    const pattern = parsePattern(key, 'Knowledge scope key');
    if (pattern.params.length === 0) {
      concreteEntries.push([key, declaration]);
      continue;
    }
    const existing = byType.get(pattern.type);
    if (existing) {
      throw new KnowledgeDeclarationError(
        `Knowledge scope type "${pattern.type}" is declared twice ("${existing.key}" and "${key}"); declare one pattern per type.`,
      );
    }
    const compiled: CompiledKnowledgeDeclaration = { key, pattern, declaration, rules: [], children: [] };
    byType.set(pattern.type, compiled);
    all.set(key, compiled);
  }

  const concrete = new Map<string, { declaration: KnowledgeScopeDeclaration; rules: CompiledKnowledgeRule[] }>();
  for (const [address, declaration] of concreteEntries) {
    const pattern = parsePattern(address, 'Knowledge scope key');
    const owner = byType.get(pattern.type);
    if (owner && !matchPattern(owner.pattern, address)) {
      throw new KnowledgeDeclarationError(
        `Knowledge scope "${address}" doesn't fit its type's pattern "${owner.key}".`,
      );
    }
    if (owner) {
      const unsupported = (['belongsTo', 'children', 'pages'] as const).filter(
        field => declaration[field] !== undefined,
      );
      if (unsupported.length) {
        throw new KnowledgeDeclarationError(
          `Knowledge scope "${address}" is an address of "${owner.key}" and can only add description, access, pins and pinPriority; declare ${unsupported.join(', ')} on "${owner.key}".`,
        );
      }
    } else {
      const compiled: CompiledKnowledgeDeclaration = { key: address, pattern, declaration, rules: [], children: [] };
      all.set(address, compiled);
    }
    concrete.set(address, { declaration, rules: [] });
  }

  for (const compiled of [...all.values()]) {
    const names = new Set<string>();
    for (const child of compiled.declaration.children ?? []) {
      if (names.has(child.name)) {
        throw new KnowledgeDeclarationError(
          `Knowledge child scope "${child.name}" of "${compiled.key}" is declared twice.`,
        );
      }
      names.add(child.name);
      if (!CHILD_NAME_PATTERN.test(child.name)) {
        throw new KnowledgeDeclarationError(
          `Knowledge child scope "${child.name}" of "${compiled.key}" must be lowercase letters, digits, - or _.`,
        );
      }
      const key = `${compiled.key}/${child.name}`;
      const childCompiled: CompiledKnowledgeDeclaration = {
        key,
        pattern: compiled.pattern,
        declaration: { description: child.description, access: child.access },
        rules: [],
        child: { parent: compiled, name: child.name },
        children: [],
      };
      compiled.children.push(childCompiled);
      all.set(key, childCompiled);
    }
  }

  const slashInLast = (type: string) => !byType.get(type)?.declaration.children?.length;
  for (const compiled of byType.values()) compiled.pattern.slashInLast = slashInLast(compiled.pattern.type);
  const typedPattern = (key: string, what: string) => {
    const pattern = parsePattern(key, what);
    pattern.slashInLast = slashInLast(pattern.type);
    return pattern;
  };

  const compiledScopes: CompiledKnowledgeScopes = {
    declarations: all,
    concrete,
    match(address) {
      const slash = address.lastIndexOf('/');
      if (slash !== -1) {
        const parent = compiledScopes.match(address.slice(0, slash));
        const child = parent?.compiled.children.find(candidate => candidate.child!.name === address.slice(slash + 1));
        if (parent && child)
          return { declaration: child.key, compiled: child, params: parent.params, concreteRules: [] };
      }
      const colon = address.indexOf(':');
      if (colon === -1) return null;
      const extra = concrete.get(address);
      const typed = byType.get(address.slice(0, colon));
      if (typed) {
        const params = matchPattern(typed.pattern, address);
        if (!params) return null;
        return {
          declaration: typed.key,
          compiled: typed,
          params,
          concreteRules: extra?.rules ?? [],
          ...(extra ? { concrete: extra.declaration } : {}),
        };
      }
      const standalone = all.get(address);
      if (!standalone) return null;
      return { declaration: address, compiled: standalone, params: {}, concreteRules: [] };
    },
  };

  const principalPattern = (principal: string, target: string): KnowledgeScopePattern => {
    const pattern = typedPattern(principal, `Knowledge rule principal on "${target}"`);
    if (!compiledScopes.match(sampleAddress(pattern))) {
      throw new KnowledgeDeclarationError(
        `Knowledge rule principal "${principal}" on "${target}" is not a declared scope type; declare it or fix the typo.`,
      );
    }
    return pattern;
  };

  const compileRules = (
    target: string,
    rules: KnowledgeAccessRule[] | undefined,
    targetParams: string[],
    belongsTo: KnowledgeScopePattern | undefined,
    isConcrete: boolean,
  ): CompiledKnowledgeRule[] =>
    (rules ?? []).map(rule => {
      if (!KNOWLEDGE_ROLES.includes(rule.role)) {
        throw new KnowledgeDeclarationError(`Knowledge rule on "${target}" has unknown role "${rule.role}".`);
      }
      if (rule.principal === 'self') return { principal: null, role: rule.role, reach: { kind: 'self' } };
      const principal = principalPattern(rule.principal, target);
      const bound = principal.params;
      const unbindable = bound.filter(param => !targetParams.includes(param) && !belongsTo?.params.includes(param));
      if (unbindable.length) {
        throw new KnowledgeDeclarationError(
          `Knowledge rule principal "${rule.principal}" on "${target}" uses ${unbindable.map(p => `$${p}`).join(', ')}, which "${target}" can't bind from its address or belongsTo.`,
        );
      }
      if (isConcrete || (bound.length === targetParams.length && bound.every(param => targetParams.includes(param)))) {
        return { principal, role: rule.role, reach: { kind: 'exact' } };
      }
      const leading = targetParams.slice(0, bound.length);
      if (bound.every(param => leading.includes(param)))
        return { principal, role: rule.role, reach: { kind: 'prefix' } };
      if (
        belongsTo &&
        belongsTo.params.length === bound.length &&
        bound.every(param => belongsTo.params.includes(param))
      ) {
        return { principal, role: rule.role, reach: { kind: 'belongsTo' } };
      }
      throw new KnowledgeDeclarationError(
        `Knowledge rule principal "${rule.principal}" on "${target}" would reach scopes that aren't an address prefix; reorder "${target}"'s params so the bound ones come first, or bind them through belongsTo.`,
      );
    });

  for (const compiled of all.values()) {
    const parentDeclaration = compiled.child?.parent.declaration ?? compiled.declaration;
    if (!compiled.child && parentDeclaration.belongsTo) {
      const belongsTo = typedPattern(parentDeclaration.belongsTo, `Knowledge belongsTo on "${compiled.key}"`);
      if (!compiledScopes.match(sampleAddress(belongsTo))) {
        throw new KnowledgeDeclarationError(
          `Knowledge belongsTo "${parentDeclaration.belongsTo}" on "${compiled.key}" is not a declared scope type.`,
        );
      }
      compiled.belongsTo = belongsTo;
    }
    compiled.rules = compileRules(
      compiled.key,
      compiled.declaration.access,
      compiled.pattern.params,
      compiled.belongsTo,
      compiled.pattern.params.length === 0,
    );
  }
  for (const [address, entry] of concrete) {
    const match = compiledScopes.match(address)!;
    if (match.compiled.key === address) continue;
    entry.rules = compileRules(address, entry.declaration.access, Object.keys(match.params), undefined, true);
  }
  return compiledScopes;
}
