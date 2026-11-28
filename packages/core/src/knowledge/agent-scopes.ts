import type { KnowledgeScopeDeclarations, CompiledKnowledgeScopes } from './declarations';
import { bindKnowledgePattern } from './declarations';
import { decodeKnowledgeScopeValue } from './scope-address';

/** Agent identity declarations. Identities grant nothing until an access rule names them. @experimental */
export function knowledgeAgentScopes(): KnowledgeScopeDeclarations {
  return Object.fromEntries(
    [
      'agent:$agentId',
      'agent:$agentId:org:$orgId',
      'agent:$agentId:user:$resourceId',
      'agent:persona:role:$role',
      'agent:persona:role:$role:org:$orgId',
      'agent:persona:role:$role:user:$resourceId',
      'agent:persona:team:$teamId',
    ].map(key => [key, { mint: 'run-identity', access: [] }]),
  );
}

/** @internal */
export function mintKnowledgeAgentScopes(
  compiled: CompiledKnowledgeScopes,
  scopes: readonly string[],
  agent: { agentId?: string; resourceId?: string; persona?: unknown } | undefined,
): string[] {
  const params: Record<string, string> = {};
  if (agent?.agentId) params.agentId = agent.agentId;
  if (agent?.resourceId) params.resourceId = agent.resourceId;
  const persona = agent?.persona;
  if (persona && typeof persona === 'object') {
    for (const [field, param] of [
      ['role', 'role'],
      ['teamId', 'teamId'],
    ] as const) {
      const value = (persona as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.length > 0) params[param] = value;
    }
  }
  const orgs = scopes
    .filter(scope => /^org:[^:]+$/.test(scope))
    .map(scope => decodeKnowledgeScopeValue(scope.slice(4)))
    .filter(value => value !== null);
  const minted: string[] = [];
  for (const declaration of compiled.declarations.values()) {
    if (declaration.declaration.mint !== 'run-identity') continue;
    const bindings = declaration.pattern.params.includes('orgId')
      ? orgs.map(orgId => ({ ...params, orgId }))
      : [params];
    for (const binding of bindings) {
      const address = bindKnowledgePattern(declaration.pattern, binding);
      if (address) minted.push(address);
    }
  }
  return minted;
}
