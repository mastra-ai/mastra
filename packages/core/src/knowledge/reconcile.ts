import type {
  KnowledgeGrantRole,
  KnowledgeStructureGrant,
  KnowledgeStructurePlan,
  KnowledgeStructureScope,
} from '../storage/domains/knowledge';

export interface KnowledgeScopeAccessConfig {
  principal: 'self' | 'parent' | string;
  role: KnowledgeGrantRole;
  canSuggest?: boolean;
}

/**
 * A child scope created alongside every scope materialized from its pattern. `address` and string
 * principals substitute `$param` values from the matched address, and `$self` with the materialized
 * scope's address. In `access`, `self` and `parent` both resolve to the materialized scope.
 * Children are created once and are not retrofitted when the template changes.
 */
export interface KnowledgeScopeChildTemplate {
  address: string;
  name: string;
  description?: string;
  /** Defaults to an owner grant for the materialized scope. */
  access?: KnowledgeScopeAccessConfig[];
}

export interface KnowledgeScopeTypeConfig {
  access?: KnowledgeScopeAccessConfig[];
  description?: string;
  children?: KnowledgeScopeChildTemplate[];
  /**
   * Pattern of the scope type this one nests under, e.g. `org:$orgId` for `project:$projectId`.
   * When a run's scopes are materialized (see {@link planKnowledgeRunScopes}), the parent's value
   * comes from the run's own scope of that type. A scope's parent is fixed when it is created.
   */
  parent?: string;
  /**
   * Host-vouched identity: scopes of this type come only from a run's trusted scopes or the host,
   * never from child templates or importers.
   */
  identity?: boolean;
}

/** Scope types keyed by address pattern. Core configures none; see {@link memoryScopeTypes}. */
export type KnowledgeScopeTypesConfig = Record<string, KnowledgeScopeTypeConfig>;

export interface MaterializeKnowledgeScopeInput {
  address: string;
  name?: string;
  parentAddresses?: string[];
  contextualScopeAddress: string;
  parameters?: Record<string, string>;
}

/**
 * Opt-in scope types for Memory's identity: `org` → `resource` → `thread`, each owned by itself.
 * Spread into `new Knowledge({ scopes: { ...memoryScopeTypes, ... } })`.
 */
export const memoryScopeTypes: KnowledgeScopeTypesConfig = {
  'org:$orgId': { identity: true, access: [{ principal: 'self', role: 'owner' }] },
  'resource:$resourceId': { identity: true, parent: 'org:$orgId', access: [{ principal: 'self', role: 'owner' }] },
  'thread:$threadId': {
    identity: true,
    parent: 'resource:$resourceId',
    access: [{ principal: 'self', role: 'owner' }],
  },
};

// Materializing an unmatched (custom) address creates the scope; it confers no ownership.
// Hosts that want owners on custom scopes configure a `custom` scope type.
const DEFAULT_CUSTOM_SCOPE_TYPE: KnowledgeScopeTypeConfig = {};

export function validateKnowledgeScopeTypes(
  scopeTypes: KnowledgeScopeTypesConfig | undefined,
): KnowledgeScopeTypesConfig {
  const types = scopeTypes ?? {};
  for (const [pattern, config] of Object.entries(types)) {
    assertScopeDescriptionWithinBound(config?.description);
    for (const child of config?.children ?? []) {
      if (!child.address.trim()) throw new Error(`Knowledge child scope template in ${pattern} must have an address`);
      if (!child.name.trim()) throw new Error(`Knowledge child scope ${child.address} in ${pattern} must have a name`);
      assertScopeDescriptionWithinBound(child.description);
      for (const access of child.access ?? []) {
        if (access.role === 'mirror' && access.canSuggest !== undefined) {
          throw new Error(`Knowledge mirror grant in ${pattern} cannot override suggest capability`);
        }
      }
    }
  }
  const patterns = Object.keys(types).filter(pattern => pattern !== 'custom');
  for (const [index, pattern] of patterns.entries()) {
    assertPattern(pattern);
    for (const other of patterns.slice(index + 1)) {
      if (patternsOverlap(pattern, other)) {
        throw new Error(`Knowledge scope patterns overlap: ${pattern} and ${other}`);
      }
    }
    for (const access of types[pattern]?.access ?? []) {
      if (access.role === 'mirror' && access.canSuggest !== undefined) {
        throw new Error(`Knowledge mirror grant in ${pattern} cannot override suggest capability`);
      }
    }
    assertParentType(pattern, types);
  }
  return types;
}

function assertParentType(pattern: string, types: Record<string, KnowledgeScopeTypeConfig>): void {
  const seen = new Set([pattern]);
  let current = pattern;
  for (let parent = types[current]?.parent; parent !== undefined; parent = types[current]?.parent) {
    if (!types[parent] || parent === 'custom') {
      throw new Error(`Knowledge scope type ${current} names parent ${parent}, which is not a configured scope type`);
    }
    if (seen.has(parent)) throw new Error(`Knowledge scope type parents contain a cycle at ${parent}`);
    seen.add(parent);
    current = parent;
  }
}

/** Scope descriptions share the node description bound, counted in UTF-16 code units. */
const MAX_KNOWLEDGE_SCOPE_DESCRIPTION_LENGTH = 400;

function assertScopeDescriptionWithinBound(description: unknown): void {
  if (typeof description === 'string' && description.length > MAX_KNOWLEDGE_SCOPE_DESCRIPTION_LENGTH) {
    throw new Error(
      `Knowledge node description exceeds the ${MAX_KNOWLEDGE_SCOPE_DESCRIPTION_LENGTH} UTF-16 code unit limit`,
    );
  }
}

export function validateKnowledgeStructurePlan(plan: KnowledgeStructurePlan): KnowledgeStructurePlan {
  const addresses = new Set<string>();
  for (const scope of plan.scopes) {
    assertAddress(scope.address);
    if (!scope.name.trim()) throw new Error(`Knowledge scope ${scope.address} must have a name`);
    assertScopeDescriptionWithinBound(scope.metadata?.description);
    if (addresses.has(scope.address)) throw new Error(`Duplicate Knowledge scope address: ${scope.address}`);
    addresses.add(scope.address);
    const parents = new Set<string>();
    for (const parent of scope.parentAddresses ?? []) {
      assertAddress(parent);
      if (parents.has(parent)) throw new Error(`Duplicate parent ${parent} for Knowledge scope ${scope.address}`);
      parents.add(parent);
    }
    const grantRefs = new Set<string>();
    for (const grant of scope.grants ?? []) {
      assertAddress(grant.scopeRefAddress);
      if (grantRefs.has(grant.scopeRefAddress)) {
        throw new Error(`Duplicate grant scope ${grant.scopeRefAddress} for Knowledge scope ${scope.address}`);
      }
      grantRefs.add(grant.scopeRefAddress);
      if (grant.role === 'mirror' && grant.canSuggest !== undefined) {
        throw new Error(`Knowledge mirror grant for ${scope.address} cannot override suggest capability`);
      }
    }
  }

  const dependencies = new Map(plan.scopes.map(scope => [scope.address, scope.parentAddresses ?? []]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (address: string) => {
    if (visiting.has(address)) throw new Error(`Knowledge scope hierarchy contains a cycle at ${address}`);
    if (visited.has(address)) return;
    visiting.add(address);
    for (const parent of dependencies.get(address) ?? []) {
      if (dependencies.has(parent)) visit(parent);
    }
    visiting.delete(address);
    visited.add(address);
  };
  for (const address of dependencies.keys()) visit(address);

  return plan;
}

export function materializeKnowledgeScopePlan(
  scopeTypes: KnowledgeScopeTypesConfig | undefined,
  input: MaterializeKnowledgeScopeInput,
): KnowledgeStructurePlan {
  assertAddress(input.address);
  assertAddress(input.contextualScopeAddress);
  const types = validateKnowledgeScopeTypes(scopeTypes);
  const matches = Object.entries(types)
    .filter(([pattern]) => pattern !== 'custom')
    .map(([pattern, config]) => ({ pattern, config, parameters: matchPattern(pattern, input.address) }))
    .filter(
      (match): match is { pattern: string; config: KnowledgeScopeTypeConfig; parameters: Record<string, string> } =>
        Boolean(match.parameters),
    );
  if (matches.length > 1) {
    throw new Error(`Knowledge scope address ${input.address} matches multiple configured patterns`);
  }

  const match = matches[0];
  const config = match?.config ?? types.custom ?? DEFAULT_CUSTOM_SCOPE_TYPE;
  const parameters = { ...input.parameters, ...match?.parameters };
  for (const [key, value] of Object.entries(match?.parameters ?? {})) {
    if (input.parameters?.[key] !== undefined && input.parameters[key] !== value) {
      throw new Error(`Host-vouched Knowledge scope parameter ${key} does not match address ${input.address}`);
    }
  }

  const grants = (config.access ?? []).flatMap<KnowledgeStructureGrant>(access => {
    const principal = resolvePrincipal(access.principal, input, parameters);
    if (!principal) return [];
    return [{ scopeRefAddress: principal, role: access.role, canSuggest: access.canSuggest }];
  });

  const childParameters = { ...parameters, self: input.address };
  const children = (config.children ?? []).map<KnowledgeStructureScope>(child => ({
    address: assertChildAddress(substituteParameters(child.address, childParameters), types),
    name: child.name.trim(),
    metadata: child.description ? { description: child.description } : undefined,
    parentAddresses: [input.address],
    grants: (child.access ?? [{ principal: 'self', role: 'owner' }]).map<KnowledgeStructureGrant>(access => ({
      scopeRefAddress:
        access.principal === 'self' || access.principal === 'parent'
          ? input.address
          : substituteParameters(access.principal, childParameters),
      role: access.role,
      canSuggest: access.canSuggest,
    })),
  }));

  return validateKnowledgeStructurePlan({
    retrofit: false,
    scopes: [
      {
        address: input.address,
        name: input.name?.trim() || input.address.split(':').at(-1)!,
        metadata: config.description ? { description: config.description } : undefined,
        parentAddresses: input.parentAddresses,
        grants,
      },
      ...children,
    ],
  });
}

/** A run's own resource and thread are agent identity even when no Knowledge scope type uses them. */
const AGENT_IDENTITY_SCOPE_PATTERNS = ['resource:$resourceId', 'thread:$threadId'];

function identityScopePatterns(types: Record<string, KnowledgeScopeTypeConfig>): string[] {
  return [
    ...AGENT_IDENTITY_SCOPE_PATTERNS,
    ...Object.entries(types).flatMap(([pattern, config]) => (config.identity ? [pattern] : [])),
  ];
}

/**
 * Child templates must not mint identity scopes (those are host-vouched) or addresses owned by
 * another configured scope type: the child would get the template's grants instead of that type's
 * access and children, and a later materialization of it would find it existing and never repair it.
 */
function assertChildAddress(address: string, types: Record<string, KnowledgeScopeTypeConfig>): string {
  assertAddress(address);
  if (identityScopePatterns(types).some(pattern => matchPattern(pattern, address))) {
    throw new Error(`Knowledge child scope template cannot create identity scope ${address}`);
  }
  const owner = Object.keys(types).find(pattern => pattern !== 'custom' && matchPattern(pattern, address));
  if (owner) {
    throw new Error(
      `Knowledge child scope template cannot create ${address}: it matches configured scope type ${owner}, so materialize it through that type`,
    );
  }
  return address;
}

function substituteParameters(template: string, parameters: Record<string, string>): string {
  return template.replace(/\$([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    const value = parameters[name];
    if (!value) throw new Error(`Missing host-vouched Knowledge scope parameter: ${name}`);
    return value;
  });
}

function matchPattern(pattern: string, address: string): Record<string, string> | null {
  const patternSegments = pattern.split(':');
  const addressSegments = address.split(':');
  if (patternSegments.length !== addressSegments.length) return null;
  const parameters: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index++) {
    const expected = patternSegments[index]!;
    const actual = addressSegments[index]!;
    if (expected.startsWith('$')) {
      if (!actual) return null;
      parameters[expected.slice(1)] = actual;
    } else if (expected !== actual) {
      return null;
    }
  }
  return parameters;
}

function resolvePrincipal(
  principal: KnowledgeScopeAccessConfig['principal'],
  input: MaterializeKnowledgeScopeInput,
  parameters: Record<string, string>,
): string | null {
  if (principal === 'self') return input.contextualScopeAddress;
  if (principal === 'parent') {
    if (input.parentAddresses?.length !== 1) {
      throw new Error(`Knowledge scope ${input.address} requires exactly one parent to resolve its parent grant`);
    }
    return input.parentAddresses[0]!;
  }
  return substituteParameters(principal, parameters);
}

function assertPattern(pattern: string): void {
  if (!pattern.trim() || pattern !== pattern.trim() || pattern.split(':').some(segment => !segment)) {
    throw new Error(`Invalid Knowledge scope pattern: ${pattern}`);
  }
  const parameters = pattern
    .split(':')
    .filter(segment => segment.startsWith('$'))
    .map(segment => segment.slice(1));
  if (parameters.some(parameter => !/^[A-Za-z][A-Za-z0-9_]*$/.test(parameter))) {
    throw new Error(`Invalid Knowledge scope pattern: ${pattern}`);
  }
  if (new Set(parameters).size !== parameters.length) {
    throw new Error(`Knowledge scope pattern repeats a parameter: ${pattern}`);
  }
}

function patternsOverlap(first: string, second: string): boolean {
  const firstSegments = first.split(':');
  const secondSegments = second.split(':');
  return (
    firstSegments.length === secondSegments.length &&
    firstSegments.every(
      (segment, index) =>
        segment.startsWith('$') || secondSegments[index]!.startsWith('$') || segment === secondSegments[index],
    )
  );
}

function assertAddress(address: string): void {
  if (!address.trim()) throw new Error('Knowledge scope addresses must not be empty');
  if (address !== address.trim() || address.split(':').some(segment => !segment)) {
    throw new Error(`Invalid Knowledge scope address: ${address}`);
  }
}

/** One scope a run holds, as {@link planKnowledgeRunScopes} plans it. */
export interface KnowledgeRunScopePlan extends MaterializeKnowledgeScopeInput {
  /** The configured scope type pattern the address matched, e.g. `org:$orgId`. */
  pattern: string;
  /** The parent scope's address when the type nests under another held type. */
  parentAddress?: string;
}

/**
 * Plans which scopes a run holds from its trusted scope addresses (`<type>:<value>`, such as the
 * agent scopes Core marks for the run). A configured scope type made of `<type>:$param` pairs is
 * held when the run holds a scope of every type it names and its `parent` type is held too; its
 * parameters come from those scopes. Scope types matching no configured pattern are ignored.
 * Returned parent-first, ready for `materializeScope`.
 */
export function planKnowledgeRunScopes(
  scopeTypes: KnowledgeScopeTypesConfig | undefined,
  runScopes: readonly string[],
): KnowledgeRunScopePlan[] {
  const types = validateKnowledgeScopeTypes(scopeTypes);
  const held = new Map<string, Set<string>>();
  for (const scope of runScopes) {
    const separator = scope.indexOf(':');
    if (separator <= 0 || separator === scope.length - 1) continue;
    const type = scope.slice(0, separator);
    const values = held.get(type) ?? new Set<string>();
    values.add(scope.slice(separator + 1));
    held.set(type, values);
  }

  const resolved = new Map<string, KnowledgeRunScopePlan | null>();
  const resolve = (pattern: string): KnowledgeRunScopePlan | null => {
    if (resolved.has(pattern)) return resolved.get(pattern)!;
    resolved.set(pattern, null);
    const segments = pattern.split(':');
    if (segments.length % 2 !== 0) return null;
    const parameters: Record<string, string> = {};
    const address: string[] = [];
    for (let index = 0; index < segments.length; index += 2) {
      const type = segments[index]!;
      const parameter = segments[index + 1]!;
      if (type.startsWith('$') || !parameter.startsWith('$')) return null;
      const values = held.get(type);
      if (!values) return null;
      if (values.size > 1) {
        throw new Error(
          `Knowledge run scopes hold more than one ${type}: ${[...values].map(v => `${type}:${v}`).join(', ')}`,
        );
      }
      const [value] = values as Set<string>;
      if (value!.includes(':')) return null;
      parameters[parameter.slice(1)] = value!;
      address.push(type, value!);
    }
    const config = types[pattern]!;
    const parent = config.parent ? resolve(config.parent) : undefined;
    if (parent === null) return null;
    const plan: KnowledgeRunScopePlan = {
      pattern,
      address: address.join(':'),
      // A run holds this scope itself, so it vouches for itself: `self` grants go to it, never to its parent.
      contextualScopeAddress: address.join(':'),
      parameters,
      ...(parent ? { parentAddress: parent.address, parentAddresses: [parent.address] } : {}),
    };
    resolved.set(pattern, plan);
    return plan;
  };

  const plans = Object.keys(types)
    .filter(pattern => pattern !== 'custom')
    .flatMap(pattern => resolve(pattern) ?? []);
  const depth = (plan: KnowledgeRunScopePlan): number => {
    let count = 0;
    for (let current = plan; current.parentAddress; count++) {
      current = plans.find(candidate => candidate.address === current.parentAddress)!;
    }
    return count;
  };
  return plans.sort((first, second) => depth(first) - depth(second));
}
