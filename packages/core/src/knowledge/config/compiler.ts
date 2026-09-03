import { createHash } from 'node:crypto';

import type { KnowledgeStructurePlan, KnowledgeStructureScope } from '../../storage/domains/knowledge';
import { validateKnowledgeStructurePlan } from '../reconcile';

export interface KnowledgeDescriptionCompilerInput {
  description: string;
  level: 'instance' | 'scope-type';
  scopeType?: string;
}

export interface KnowledgeDescriptionCompilerContext {
  checkpoint?: unknown;
  saveCheckpoint(checkpoint: unknown): Promise<void>;
}

export interface KnowledgeDescriptionCompiler {
  compile(
    input: KnowledgeDescriptionCompilerInput,
    context: KnowledgeDescriptionCompilerContext,
  ): Promise<KnowledgeStructurePlan>;
}

export function hashKnowledgeDescription(input: KnowledgeDescriptionCompilerInput): string {
  return createHash('sha256')
    .update(JSON.stringify({ level: input.level, scopeType: input.scopeType, description: input.description.trim() }))
    .digest('hex');
}

export function validateCompiledKnowledgePlan(
  plan: KnowledgeStructurePlan,
  input: Pick<KnowledgeDescriptionCompilerInput, 'level'>,
): KnowledgeStructurePlan {
  const copy = validateKnowledgeStructurePlan(structuredClone(plan));
  const addresses = new Set(copy.scopes.map(scope => scope.address));
  const allowedExternal = input.level === 'scope-type' ? new Set(['$scope', '$self', '$parent']) : new Set<string>();
  const siblingNames = new Set<string>();

  for (const scope of copy.scopes) {
    const siblingKey = JSON.stringify([scope.name.toLocaleLowerCase(), [...(scope.parentAddresses ?? [])].sort()]);
    if (siblingNames.has(siblingKey)) {
      throw new Error(`Compiled Knowledge plan has an ambiguous sibling name: ${scope.name}`);
    }
    siblingNames.add(siblingKey);
    for (const parent of scope.parentAddresses ?? []) {
      if (!addresses.has(parent) && !allowedExternal.has(parent)) {
        throw new Error(`Compiled Knowledge plan references undeclared parent scope: ${parent}`);
      }
    }
    for (const grant of scope.grants ?? []) {
      if (!addresses.has(grant.scopeRefAddress) && !allowedExternal.has(grant.scopeRefAddress)) {
        throw new Error(`Compiled Knowledge plan references undeclared grant scope: ${grant.scopeRefAddress}`);
      }
    }
  }

  if (input.level === 'scope-type') {
    for (const scope of copy.scopes) {
      if (scope.address !== '$scope' && !scope.address.startsWith('$scope:')) {
        throw new Error(`Compiled Knowledge scope-type plan must declare paths beneath $scope: ${scope.address}`);
      }
    }
  }

  return copy;
}

export function instantiateKnowledgeScopeTypePlan(input: {
  plan: KnowledgeStructurePlan;
  address: string;
  contextualScopeAddress: string;
  parentAddresses?: string[];
  parameters?: Record<string, string>;
}): KnowledgeStructurePlan {
  const replace = (value: string): string => {
    const expanded = value.replace(/\$([A-Za-z][A-Za-z0-9_]*)/g, (match, name: string) => {
      if (name === 'scope' || name === 'self' || name === 'parent') return match;
      const parameter = input.parameters?.[name];
      if (!parameter) throw new Error(`Missing host-vouched Knowledge scope parameter: ${name}`);
      return parameter;
    });
    if (expanded === '$scope') return input.address;
    if (expanded.startsWith('$scope:')) return `${input.address}:${expanded.slice('$scope:'.length)}`;
    if (expanded === '$self') return input.contextualScopeAddress;
    if (expanded === '$parent') {
      if (input.parentAddresses?.length !== 1) {
        throw new Error(`Knowledge scope ${input.address} requires exactly one parent to resolve $parent`);
      }
      return input.parentAddresses[0]!;
    }
    return expanded;
  };

  const scopes = input.plan.scopes
    .filter(scope => scope.address !== '$scope')
    .map<KnowledgeStructureScope>(scope => ({
      ...scope,
      address: replace(scope.address),
      parentAddresses: scope.parentAddresses?.map(replace),
      grants: scope.grants?.map(grant => ({ ...grant, scopeRefAddress: replace(grant.scopeRefAddress) })),
    }));

  return validateKnowledgeStructurePlan({ scopes });
}
