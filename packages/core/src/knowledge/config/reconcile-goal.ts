import { isDeepStrictEqual } from 'node:util';

import type {
  KnowledgeStructurePlan,
  KnowledgeStructureReconcileResult,
  KnowledgeStorage,
} from '../../storage/domains/knowledge';

export type KnowledgeReconcileCheckpoint = 'compiled' | 'applying' | 'applied' | 'judging' | 'complete';

export interface KnowledgeReconcileGoalState {
  version: 1;
  descriptionHash: string;
  plan: KnowledgeStructurePlan;
  checkpoint: KnowledgeReconcileCheckpoint;
  progression: KnowledgeReconcileCheckpoint[];
  attempts: number;
  preExistingScopes: Record<string, string>;
  result?: KnowledgeStructureReconcileResult;
  judgePassed?: boolean;
  lastError?: string;
}

export interface KnowledgeReconcileGoalStore {
  load(key: string): Promise<KnowledgeReconcileGoalState | undefined>;
  save(key: string, state: KnowledgeReconcileGoalState): Promise<void>;
}

export interface KnowledgeReconcileGoalResult {
  state: KnowledgeReconcileGoalState;
  result: KnowledgeStructureReconcileResult;
}

export async function runKnowledgeReconcileGoal(input: {
  key: string;
  descriptionHash: string;
  store: KnowledgeReconcileGoalStore;
  compile: () => Promise<KnowledgeStructurePlan>;
  apply: (plan: KnowledgeStructurePlan) => Promise<KnowledgeStructureReconcileResult>;
  inspectScope: (address: string) => Promise<{ id: string; deleted: boolean } | null>;
  judge?: (state: KnowledgeReconcileGoalState) => Promise<boolean>;
  maxAttempts?: number;
}): Promise<KnowledgeReconcileGoalResult> {
  let state = await input.store.load(input.key);
  if (state && state.descriptionHash !== input.descriptionHash) {
    throw new Error(`Knowledge reconcile goal ${input.key} has a mismatched description hash`);
  }

  if (!state) {
    const plan = await input.compile();
    const preExistingScopes: Record<string, string> = {};
    for (const scope of plan.scopes) {
      const existing = await input.inspectScope(scope.address);
      if (existing && !existing.deleted) preExistingScopes[scope.address] = existing.id;
    }
    state = {
      version: 1,
      descriptionHash: input.descriptionHash,
      plan,
      checkpoint: 'compiled',
      progression: ['compiled'],
      attempts: 0,
      preExistingScopes,
    };
    await input.store.save(input.key, state);
  }

  if (state.checkpoint === 'complete') {
    if (!state.result) throw new Error(`Knowledge reconcile goal ${input.key} completed without a result`);
    return { state, result: state.result };
  }

  const maxAttempts = input.maxAttempts ?? 2;
  if (state.attempts >= maxAttempts) {
    throw new Error(
      `Knowledge reconcile goal ${input.key} exhausted its retry budget${state.lastError ? `: ${state.lastError}` : ''}`,
    );
  }

  let lastError: unknown;
  while (state.attempts < maxAttempts) {
    state = { ...state, attempts: state.attempts + 1, lastError: undefined };
    await input.store.save(input.key, state);
    try {
      if (state.checkpoint === 'compiled' || state.checkpoint === 'applying') {
        state = advance(state, 'applying');
        await input.store.save(input.key, state);
        const preExisting = new Set(Object.keys(state.preExistingScopes));
        const result = await input.apply({
          scopes: state.plan.scopes.filter(scope => !preExisting.has(scope.address)),
        });
        state = advance(state, 'applied', {
          result: { ...result, scopes: { ...state.preExistingScopes, ...result.scopes } },
          lastError: undefined,
        });
        await input.store.save(input.key, state);
      }

      state = advance(state, 'judging');
      await input.store.save(input.key, state);
      const judgePassed = input.judge ? await input.judge(state) : true;
      if (!judgePassed) throw new Error('Knowledge reconciliation graph-state judge rejected the applied plan');

      state = advance(state, 'complete', { judgePassed: true, lastError: undefined });
      await input.store.save(input.key, state);
      if (!state.result) throw new Error(`Knowledge reconcile goal ${input.key} finished without an apply result`);
      return { state, result: state.result };
    } catch (error) {
      lastError = error;
      const resumeCheckpoint = state.result ? 'applied' : 'applying';
      state = advance(state, resumeCheckpoint, { judgePassed: false, lastError: sanitizeError(error) });
      await input.store.save(input.key, state);
    }
  }

  throw lastError;
}

export async function judgeKnowledgeStructurePlan(input: {
  storage: KnowledgeStorage;
  state: KnowledgeReconcileGoalState;
}): Promise<boolean> {
  const deleted = new Set(input.state.result?.deletedScopeAddresses ?? []);
  const preExisting = new Set(Object.keys(input.state.preExistingScopes));
  const resolved = new Map<string, string>();

  for (const scope of input.state.plan.scopes) {
    const address = await input.storage.getScopeAddress(scope.address);
    if (!address) {
      if (deleted.has(scope.address)) continue;
      return false;
    }
    const node = await input.storage.getNode(address.scopeNodeId);
    if (!node?.isScope) return false;
    if (!preExisting.has(scope.address)) {
      if (node.name !== scope.name || node.kind !== scope.kind || !isDeepStrictEqual(node.metadata, scope.metadata)) {
        return false;
      }
    }
    if (node.deletedAt) {
      if (!deleted.has(scope.address)) return false;
      continue;
    }
    resolved.set(scope.address, node.id);
  }

  const resolveLiveScopeId = async (address: string): Promise<string | undefined> => {
    const known = resolved.get(address);
    if (known) return known;
    const stored = await input.storage.getScopeAddress(address);
    if (!stored) return undefined;
    const node = await input.storage.getNode(stored.scopeNodeId);
    return node?.isScope && !node.deletedAt ? node.id : undefined;
  };
  const grants = await input.storage.listScopeGrants();
  for (const scope of input.state.plan.scopes) {
    if (preExisting.has(scope.address) || deleted.has(scope.address)) continue;
    const scopeId = resolved.get(scope.address);
    if (!scopeId) return false;
    const memberships = await input.storage.getNodeScopeIds(scopeId);
    const desiredMemberships: string[] = [];
    for (const parentAddress of scope.parentAddresses ?? []) {
      const parentId = await resolveLiveScopeId(parentAddress);
      if (!parentId) return false;
      desiredMemberships.push(parentId);
    }
    if (
      memberships.length !== desiredMemberships.length ||
      desiredMemberships.some(parentId => !memberships.includes(parentId))
    ) {
      return false;
    }

    const actualGrants = grants.filter(grant => grant.scopeNodeId === scopeId);
    const desiredGrants = scope.grants ?? [];
    if (actualGrants.length !== desiredGrants.length) return false;
    for (const desired of desiredGrants) {
      const scopeRefId = await resolveLiveScopeId(desired.scopeRefAddress);
      if (
        !scopeRefId ||
        !actualGrants.some(
          actual =>
            actual.scopeRefId === scopeRefId &&
            actual.role === desired.role &&
            actual.canSuggest === desired.canSuggest,
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

function advance(
  state: KnowledgeReconcileGoalState,
  checkpoint: KnowledgeReconcileCheckpoint,
  patch: Partial<KnowledgeReconcileGoalState> = {},
): KnowledgeReconcileGoalState {
  return {
    ...state,
    ...patch,
    checkpoint,
    progression: state.progression.at(-1) === checkpoint ? state.progression : [...state.progression, checkpoint],
  };
}

function sanitizeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
}
