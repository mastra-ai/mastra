/**
 * Knowledge scope declarations: the scope types (patterns such as `team:$orgId:$teamId`) and concrete
 * addresses a Knowledge instance knows, who gets which role on them, where their pages sit in the
 * tree, and which child scopes, pages and pins come with them. Compiled and checked once at
 * construction so typos fail at startup instead of silently granting nothing.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */

import { knowledgePageKeyProblem } from '@internal/core/knowledge-compat';
import { parseKnowledgePageRef } from '../storage/domains/knowledge/pages';
import { decodeKnowledgeScopeValue, encodeKnowledgeScopeValue } from './scope-address';

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
  /** Keyed pages created with this scope; they may nest (`pages` inside a page, same scope). */
  pages?: KnowledgePageTemplate[];
  /** Config pins (page refs) delivered to runs holding this scope. */
  pins?: string[];
  /** Ordering of stored pins delivered through this scope; higher first. Default 0. */
  pinPriority?: number;
}

/**
 * A keyed page created with its scope. `key` is unique among its siblings and can't contain `/`, `#`
 * or `%`; nested `pages` sit under it, addressed `<scope>#<key>/<child key>`.
 * @experimental
 */
export interface KnowledgePageTemplate {
  key: string;
  name: string;
  description?: string;
  pages?: KnowledgePageTemplate[];
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
      if (!part || part.includes('/') || part.includes('#')) {
        throw new KnowledgeDeclarationError(
          `${what} "${key}" has an empty or invalid segment; segments can't contain "/" or "#".`,
        );
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
  // A pattern's literals match raw run scopes as written, so an escape in one would let a raw scope
  // pass for a different decoded value. Concrete addresses and principals are canonical: `%` there is an escape.
  if (params.length > 0 && segments.some(segment => 'literal' in segment && segment.literal.includes('%'))) {
    throw new KnowledgeDeclarationError(
      `${what} "${key}" has a literal containing "%"; only params take encoded values.`,
    );
  }
  return { key, type, segments, params };
}

/** Binds raw param values from a canonical address; null when it isn't canonical or doesn't fit. */
export function matchKnowledgePattern(pattern: KnowledgeScopePattern, address: string): Record<string, string> | null {
  return matchPattern(pattern, address, false);
}

function matchPattern(pattern: KnowledgeScopePattern, address: string, raw: boolean): Record<string, string> | null {
  const prefix = `${pattern.type}:`;
  if (!address.startsWith(prefix)) return null;
  const parts = address.slice(prefix.length).split(':');
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
    if (!value) return null;
    const decoded = raw ? value : decodeKnowledgeScopeValue(value, last);
    if (decoded === null) return null;
    params[segment.param] = decoded;
  }
  return params;
}

/**
 * A canonical address from raw param values. For Knowledge APIs, templates, pins and tools only:
 * NOT for Agent scopes, which always take raw addresses and treat every percent sign literally.
 * @experimental
 */
export function knowledgeScopeAddress(pattern: string, params: Record<string, string>): string {
  const bound = bindKnowledgePattern(parsePattern(pattern, 'Knowledge scope pattern'), params);
  if (bound === null)
    throw new KnowledgeDeclarationError(`Knowledge scope pattern "${pattern}" needs non-empty values for every param.`);
  return bound;
}

/** Encode raw Agent scopes at Knowledge run startup; never feed the result back into Agent scopes. @internal */
export function knowledgeRunScopes(compiled: CompiledKnowledgeScopes, scopes: readonly string[]): string[] {
  return [
    ...new Set(
      scopes.map(scope => {
        for (const declaration of compiled.declarations.values()) {
          if (declaration.child) continue;
          const params = matchPattern(declaration.pattern, scope, true);
          if (params) return bindKnowledgePattern(declaration.pattern, params)!;
        }
        throw new KnowledgeDeclarationError(
          `Knowledge run scope "${scope}" does not match a declared scope type. Declare it in Knowledge \`scopes\` (for Memory's resource:/thread: scopes, spread \`...knowledgeMemoryScopes()\`).`,
        );
      }),
    ),
  ];
}

/** Encodes raw param values into a pattern; null when a value is missing or empty. */
export function bindKnowledgePattern(pattern: KnowledgeScopePattern, params: Record<string, string>): string | null {
  const values: string[] = [];
  for (const [i, segment] of pattern.segments.entries()) {
    if ('literal' in segment) {
      values.push(segment.literal);
      continue;
    }
    const value = params[segment.param];
    if (value === undefined || value === '') return null;
    values.push(encodeKnowledgeScopeValue(value, i === pattern.segments.length - 1));
  }
  return `${pattern.type}:${values.join(':')}`;
}

/**
 * The address prefix a partial binding reaches: segments up to the last bound param, ending at a
 * segment boundary. Only valid for a leading run of bound params; reserved characters in raw
 * values (including colons) are encoded so they cannot change tenant or segment boundaries.
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
    if (value === '') return null;
    prefix += `${encodeKnowledgeScopeValue(value, false)}:`;
  }
  return prefix;
}

/** Sample address for a pattern, used to check that a principal pattern fits its declared type. */
function sampleAddress(pattern: KnowledgeScopePattern): string {
  return bindKnowledgePattern(pattern, Object.fromEntries(pattern.params.map((param, i) => [param, `p${i}`])))!;
}

function patternsOverlap(a: KnowledgeScopePattern, b: KnowledgeScopePattern): boolean {
  if (a.type !== b.type) return false;
  for (let i = 0; i < Math.min(a.segments.length, b.segments.length); i++) {
    const left = a.segments[i]!;
    const right = b.segments[i]!;
    if ('literal' in left && 'literal' in right && left.literal !== right.literal) return false;
  }
  if (a.segments.length === b.segments.length) return true;
  const shorter = a.segments.length < b.segments.length ? a : b;
  return 'param' in shorter.segments[shorter.segments.length - 1]!;
}

/**
 * Compiles and checks declarations: disjoint patterns per type, valid keys, every rule principal of a
 * declared type with params the target can bind, and every rule reach indexable (an address prefix
 * or a `belongsTo` parent).
 *
 * @experimental
 */
export function compileKnowledgeScopes(declarations: KnowledgeScopeDeclarations): CompiledKnowledgeScopes {
  const byType = new Map<string, CompiledKnowledgeDeclaration[]>();
  const all = new Map<string, CompiledKnowledgeDeclaration>();
  const concreteEntries: Array<[string, KnowledgeScopeDeclaration]> = [];

  for (const [key, declaration] of Object.entries(declarations)) {
    const pattern = parsePattern(key, 'Knowledge scope key');
    if (pattern.params.length === 0) {
      concreteEntries.push([key, declaration]);
      continue;
    }
    const existing = byType.get(pattern.type) ?? [];
    const overlap = existing.find(candidate => patternsOverlap(candidate.pattern, pattern));
    if (overlap) {
      throw new KnowledgeDeclarationError(
        `Knowledge scope patterns "${overlap.key}" and "${key}" overlap; patterns of a type must be pairwise disjoint.`,
      );
    }
    const compiled: CompiledKnowledgeDeclaration = { key, pattern, declaration, rules: [], children: [] };
    byType.set(pattern.type, [...existing, compiled]);
    all.set(key, compiled);
  }

  const concrete = new Map<string, { declaration: KnowledgeScopeDeclaration; rules: CompiledKnowledgeRule[] }>();
  for (const [address, declaration] of concreteEntries) {
    const pattern = parsePattern(address, 'Knowledge scope key');
    const owner = byType.get(pattern.type)?.find(candidate => matchKnowledgePattern(candidate.pattern, address));
    if (!owner) {
      throw new KnowledgeDeclarationError(
        `Knowledge scope "${address}" doesn't match a declared pattern; declare its pattern first.`,
      );
    }
    const unsupported = (['belongsTo', 'children', 'pages'] as const).filter(field => declaration[field] !== undefined);
    if (unsupported.length) {
      throw new KnowledgeDeclarationError(
        `Knowledge scope "${address}" is an address of "${owner.key}" and can only add description, access, pins and pinPriority; declare ${unsupported.join(', ')} on "${owner.key}".`,
      );
    }
    concrete.set(address, { declaration, rules: [] });
  }

  const checkTemplates = (owner: string, templates: KnowledgePageTemplate[] | undefined, under: string) => {
    const keys = new Set<string>();
    for (const template of templates ?? []) {
      const problem = knowledgePageKeyProblem(template.key);
      if (problem) throw new KnowledgeDeclarationError(`${problem} (page template on "${owner}").`);
      if (keys.has(template.key)) {
        throw new KnowledgeDeclarationError(
          `Knowledge page template key "${template.key}" on "${owner}" is declared twice under ${under}; keys are unique among siblings.`,
        );
      }
      keys.add(template.key);
      checkTemplates(owner, template.pages, `"${template.key}"`);
    }
  };
  for (const compiled of all.values()) checkTemplates(compiled.key, compiled.declaration.pages, 'the scope');

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

  const typedPattern = (key: string, what: string) => parsePattern(key, what);

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
      for (const typed of byType.get(address.slice(0, colon)) ?? []) {
        const params = matchKnowledgePattern(typed.pattern, address);
        if (!params) continue;
        return {
          declaration: typed.key,
          compiled: typed,
          params,
          concreteRules: extra?.rules ?? [],
          ...(extra ? { concrete: extra.declaration } : {}),
        };
      }
      return null;
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

  const checkPins = (owner: string, pins: string[] | undefined, params: string[]) => {
    for (const ref of pins ?? []) {
      const parsed = parseKnowledgePageRef(ref);
      if (!parsed) {
        throw new KnowledgeDeclarationError(
          `Knowledge config pin "${ref}" on "${owner}" must be "<scope>#<key>[/<key>…]" naming a keyed page, e.g. "policy:$orgId#refund-policy" or "org:$orgId#policies/refund"; keys can't be empty or contain "/", "#" or "%".`,
        );
      }
      const pattern = typedPattern(parsed.scope, `Knowledge config pin scope on "${owner}"`);
      if (!compiledScopes.match(sampleAddress(pattern))) {
        throw new KnowledgeDeclarationError(
          `Knowledge config pin "${ref}" on "${owner}" points at an undeclared scope type; declare it or fix the typo.`,
        );
      }
      const unbound = pattern.params.filter(param => !params.includes(param));
      if (unbound.length) {
        throw new KnowledgeDeclarationError(
          `Knowledge config pin "${ref}" on "${owner}" uses ${unbound.map(p => `$${p}`).join(', ')}, which "${owner}" can't bind; pin params come from the holding scope's address.`,
        );
      }
    }
  };
  for (const compiled of all.values()) {
    if (!compiled.child) checkPins(compiled.key, compiled.declaration.pins, compiled.pattern.params);
  }
  for (const [address, entry] of concrete) {
    checkPins(address, entry.declaration.pins, Object.keys(compiledScopes.match(address)!.params));
  }
  return compiledScopes;
}
