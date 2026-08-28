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

export interface KnowledgeScopeTypeConfig {
  access?: KnowledgeScopeAccessConfig[];
  description?: string;
}

export type KnowledgeScopeTypesConfig = Record<string, KnowledgeScopeTypeConfig>;

export interface MaterializeKnowledgeScopeInput {
  address: string;
  name?: string;
  parentAddresses?: string[];
  contextualScopeAddress: string;
  parameters?: Record<string, string>;
}

const BUILT_IN_SCOPE_TYPES: KnowledgeScopeTypesConfig = {
  'org:$orgId': { access: [{ principal: 'self', role: 'owner' }] },
  'resource:$resourceId': { access: [{ principal: 'self', role: 'owner' }] },
  'thread:$threadId': { access: [{ principal: 'self', role: 'owner' }] },
  custom: { access: [{ principal: 'self', role: 'owner' }] },
};

export function validateKnowledgeScopeTypes(
  scopeTypes: KnowledgeScopeTypesConfig | undefined,
): KnowledgeScopeTypesConfig {
  const types = { ...BUILT_IN_SCOPE_TYPES, ...scopeTypes };
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
  }
  return types;
}

export function validateKnowledgeStructurePlan(plan: KnowledgeStructurePlan): KnowledgeStructurePlan {
  const addresses = new Set<string>();
  for (const scope of plan.scopes) {
    assertAddress(scope.address);
    if (!scope.name.trim()) throw new Error(`Knowledge scope ${scope.address} must have a name`);
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
  const config = match?.config ?? types.custom ?? BUILT_IN_SCOPE_TYPES.custom!;
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

  return validateKnowledgeStructurePlan({
    scopes: [
      {
        address: input.address,
        name: input.name?.trim() || input.address.split(':').at(-1)!,
        description: config.description,
        parentAddresses: input.parentAddresses,
        grants,
      },
    ],
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
  return principal.replace(/\$([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    const value = parameters[name];
    if (!value) throw new Error(`Missing host-vouched Knowledge scope parameter: ${name}`);
    return value;
  });
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
