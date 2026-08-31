import { isDeepStrictEqual } from 'node:util';

import {
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  type KnowledgeGrantRole,
  type KnowledgeNode,
  type KnowledgeScopeGrant,
  type KnowledgeScopeIds,
  type KnowledgeStorage,
} from '../../storage/domains/knowledge';
import { assertKnowledgeGrantRole } from '../access/grants';
import { assertKnowledgeScopeCapabilities, assertKnowledgeTargetCapability } from '../access/mutations';
import type { KnowledgeAccessFrontier } from '../access/types';
import { materializeKnowledgeScopePlan, type KnowledgeScopeTypesConfig } from '../reconcile';

export interface CreateKnowledgeScopeInput {
  address: string;
  name?: string;
  parentAddresses: string[];
  contextualScopeAddress: string;
  parameters?: Record<string, string>;
  vouchedScopeIds: KnowledgeScopeIds;
}

export interface CreateKnowledgeRootScopeInput {
  address: string;
  name?: string;
  contextualScopeAddress: string;
  parameters?: Record<string, string>;
}

export interface ShareKnowledgeScopeInput {
  scopeId: string;
  granteeScopeId: string;
  role: KnowledgeGrantRole;
  canSuggest?: boolean;
  vouchedScopeIds: KnowledgeScopeIds;
}

export interface RevokeKnowledgeScopeAccessInput {
  scopeId: string;
  granteeScopeId: string;
  vouchedScopeIds: KnowledgeScopeIds;
}

export interface DeleteGovernedKnowledgeNodeInput {
  id: string;
  version: number;
  deletedBy: string;
  vouchedScopeIds: KnowledgeScopeIds;
}

export interface RestoreGovernedKnowledgeNodeInput {
  id: string;
  version: number;
  vouchedScopeIds: KnowledgeScopeIds;
}

export interface RestoreKnowledgeRootScopeInput {
  id: string;
  version: number;
}

export class KnowledgeScopeGovernance {
  constructor(
    private readonly storage: KnowledgeStorage,
    private readonly scopeTypes: KnowledgeScopeTypesConfig | undefined,
    private readonly evaluateAccess: (vouchedScopeIds: KnowledgeScopeIds) => Promise<KnowledgeAccessFrontier>,
  ) {}

  async create(input: CreateKnowledgeScopeInput) {
    if (input.parentAddresses.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
    const plan = materializeKnowledgeScopePlan(this.scopeTypes, input);
    const parentScopeIds = await this.#resolveLiveScopeAddresses(input.parentAddresses);
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    assertKnowledgeScopeCapabilities({
      frontier,
      scopeIds: parentScopeIds,
      capability: 'createChildren',
      targetType: 'scope',
    });
    const existing = await this.#existingCreationResult(plan);
    if (existing) return existing;
    const result = await this.storage.reconcileStructure(plan, {
      expectedAccessEpoch: frontier.accessEpoch,
      expectedAbsentScopeAddresses: [input.address],
    });
    if (result.deletedScopeAddresses?.includes(input.address)) {
      throw new KnowledgeNotFoundError('scope', input.address);
    }
    return result;
  }

  async createRoot(input: CreateKnowledgeRootScopeInput) {
    const plan = materializeKnowledgeScopePlan(this.scopeTypes, { ...input, parentAddresses: [] });
    const existing = await this.#existingCreationResult(plan);
    if (existing) return existing;
    const result = await this.storage.reconcileStructure(plan, {
      expectedAbsentScopeAddresses: [input.address],
    });
    if (result.deletedScopeAddresses?.includes(input.address)) {
      throw new KnowledgeNotFoundError('scope', input.address);
    }
    return result;
  }

  async share(input: ShareKnowledgeScopeInput) {
    assertKnowledgeGrantRole(input.role);
    if (input.role === 'mirror' && input.canSuggest !== undefined) {
      throw new Error('Knowledge mirror grants cannot override suggest capability');
    }
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    await this.#assertManagedScope(frontier, input.scopeId);
    await this.#assertLiveScope(input.granteeScopeId);
    const grant: KnowledgeScopeGrant = {
      scopeNodeId: input.scopeId,
      scopeRefId: input.granteeScopeId,
      role: input.role,
      canSuggest: input.canSuggest,
    };
    return this.storage.upsertScopeGrant(grant, { expectedAccessEpoch: frontier.accessEpoch });
  }

  async revoke(input: RevokeKnowledgeScopeAccessInput) {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    await this.#assertManagedScope(frontier, input.scopeId);
    return this.storage.removeScopeGrant({
      scopeNodeId: input.scopeId,
      scopeRefId: input.granteeScopeId,
      expectedAccessEpoch: frontier.accessEpoch,
    });
  }

  async delete(input: DeleteGovernedKnowledgeNodeInput): Promise<KnowledgeNode> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    const node = await this.storage.getNode(input.id);
    if (!node) throw new KnowledgeNotFoundError('node', input.id);
    const scopeIds = await this.storage.getNodeScopeIds(node.id);
    assertKnowledgeTargetCapability({
      frontier,
      scopeIds: node.isScope ? [node.id] : scopeIds,
      capability: 'manageAccess',
      targetType: 'node',
      targetId: node.id,
    });
    return this.storage.deleteNode({
      id: node.id,
      version: input.version,
      deletedBy: input.deletedBy,
      expectedAccessEpoch: frontier.accessEpoch,
    });
  }

  async restore(input: RestoreGovernedKnowledgeNodeInput): Promise<KnowledgeNode> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    const node = await this.storage.getNodeIncludingDeleted(input.id);
    if (!node?.deletedAt) throw new KnowledgeNotFoundError('node', input.id);
    const parentScopeIds = await this.storage.getNodeScopeIds(node.id);
    if (node.isScope && parentScopeIds.length === 0) throw new KnowledgeNotFoundError('scope', node.id);
    assertKnowledgeTargetCapability({
      frontier,
      scopeIds: parentScopeIds,
      capability: 'manageAccess',
      targetType: node.isScope ? 'scope' : 'node',
      targetId: node.id,
    });
    if (node.isScope) {
      const retainedGrant = (await this.storage.listScopeGrants({ includeDeleted: true })).find(
        grant =>
          grant.scopeNodeId === node.id &&
          Boolean(frontier.scopes[grant.scopeRefId]) &&
          (grant.role === 'owner' ||
            (grant.role === 'mirror' && Boolean(frontier.scopes[grant.scopeRefId]?.manageAccess))),
      );
      if (!retainedGrant) throw new KnowledgeNotFoundError('scope', node.id);
    }
    return this.storage.restoreNode({
      id: node.id,
      version: input.version,
      expectedAccessEpoch: frontier.accessEpoch,
    });
  }

  async restoreRoot(input: RestoreKnowledgeRootScopeInput): Promise<KnowledgeNode> {
    const node = await this.storage.getNodeIncludingDeleted(input.id);
    if (!node?.deletedAt || !node.isScope || (await this.storage.getNodeScopeIds(node.id)).length !== 0) {
      throw new KnowledgeNotFoundError('scope', input.id);
    }
    return this.storage.restoreNode({ id: node.id, version: input.version });
  }

  async #existingCreationResult(plan: ReturnType<typeof materializeKnowledgeScopePlan>) {
    const desired = plan.scopes[0]!;
    const address = await this.storage.getScopeAddress(desired.address);
    if (!address) return undefined;
    const node = await this.storage.getNode(address.scopeNodeId);
    if (!node?.isScope) throw new KnowledgeNotFoundError('scope', desired.address);
    const parentScopeIds = await this.#resolveLiveScopeAddresses(desired.parentAddresses ?? []);
    const currentParentScopeIds = await this.storage.getNodeScopeIds(node.id);
    const desiredGrants = await Promise.all(
      (desired.grants ?? []).map(async grant => {
        const reference = await this.storage.getScopeAddress(grant.scopeRefAddress);
        if (!reference) throw new KnowledgeNotFoundError('scope', grant.scopeRefAddress);
        return {
          scopeNodeId: node.id,
          scopeRefId: reference.scopeNodeId,
          role: grant.role,
          canSuggest: grant.canSuggest,
        } satisfies KnowledgeScopeGrant;
      }),
    );
    const currentGrants = (await this.storage.listScopeGrants()).filter(grant => grant.scopeNodeId === node.id);
    const sortGrants = (grants: KnowledgeScopeGrant[]) =>
      grants.map(grant => ({ ...grant })).sort((left, right) => left.scopeRefId.localeCompare(right.scopeRefId));
    if (
      node.name !== desired.name ||
      node.kind !== desired.kind ||
      !isDeepStrictEqual(node.metadata, desired.metadata) ||
      !isDeepStrictEqual(currentParentScopeIds, [...parentScopeIds].sort()) ||
      !isDeepStrictEqual(sortGrants(currentGrants), sortGrants(desiredGrants))
    ) {
      throw new KnowledgeConflictError(`Conflicting Knowledge scope creation: ${desired.address}`);
    }
    return {
      scopes: { [desired.address]: node.id },
      createdScopeIds: [],
      deletedScopeAddresses: [],
      changed: false,
      accessEpoch: await this.storage.getAccessEpoch(),
    };
  }

  async #assertManagedScope(frontier: KnowledgeAccessFrontier, scopeId: string) {
    await this.#assertLiveScope(scopeId);
    assertKnowledgeScopeCapabilities({
      frontier,
      scopeIds: [scopeId],
      capability: 'manageAccess',
      targetType: 'scope',
    });
  }

  async #assertLiveScope(scopeId: string) {
    const scope = await this.storage.getNode(scopeId);
    if (!scope?.isScope) throw new KnowledgeNotFoundError('scope', scopeId);
  }

  async #resolveLiveScopeAddresses(addresses: readonly string[]): Promise<string[]> {
    const scopeIds: string[] = [];
    for (const address of addresses) {
      const resolved = await this.storage.getScopeAddress(address);
      if (!resolved) throw new KnowledgeNotFoundError('scope', address);
      await this.#assertLiveScope(resolved.scopeNodeId);
      scopeIds.push(resolved.scopeNodeId);
    }
    return scopeIds;
  }
}
