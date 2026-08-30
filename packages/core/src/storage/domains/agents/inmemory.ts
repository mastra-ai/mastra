import { deepEqual } from '../../../utils';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import {
  compareVersionLabelNames,
  createVersionLabelConflictError,
  createVersionLabelError,
  normalizeVersionLabelPagination,
  validateVersionLabel,
  validateVersionLabelRevisionToken,
  VERSION_LABEL_ENTITY_CAPABILITIES,
} from '../version-labels';
import type {
  DeleteVersionLabelInput,
  GetVersionLabelInput,
  ListVersionLabelsByVersionInput,
  ListVersionLabelsInput,
  ListVersionLabelsOutput,
  SetVersionLabelInput,
  VersionLabelPointer,
  VersionLabelStorageChannel,
} from '../version-labels';
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
  VersionOrderBy,
  VersionSortDirection,
} from './base';
import { AgentsStorage } from './base';

export class InMemoryAgentsStorage extends AgentsStorage {
  private db: InMemoryDB;
  override readonly versionLabels: VersionLabelStorageChannel<'agent'>;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
    this.versionLabels = {
      entityType: 'agent',
      capabilities: VERSION_LABEL_ENTITY_CAPABILITIES,
      get: input => this.getVersionLabel(input),
      list: input => this.listVersionLabels(input),
      listByVersion: input => this.listVersionLabelsByVersion(input),
      set: input => this.setVersionLabel(input),
      delete: input => this.deleteVersionLabel(input),
      deleteByEntity: async input => {
        this.assertAgentEntityType(input.entityType);
        return this.deleteVersionLabelsByEntity(input.entityId);
      },
    };
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.agents.clear();
    this.db.agentVersions.clear();
    this.db.versionLabels.clear();
    this.db.versionLabelsByVersion.clear();
  }

  // ==========================================================================
  // Agent CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageAgentType | null> {
    const agent = this.db.agents.get(id);
    return agent ? this.deepCopyAgent(agent) : null;
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    const { agent } = input;

    if (this.db.agents.has(agent.id)) {
      throw new Error(`Agent with id ${agent.id} already exists`);
    }

    const now = new Date();
    // Default visibility to 'private' when an authorId is set; leave undefined for legacy unowned rows.
    const visibility = agent.visibility ?? (agent.authorId ? 'private' : undefined);
    const newAgent: StorageAgentType = {
      id: agent.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: agent.authorId,
      visibility,
      metadata: agent.metadata,
      favoriteCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.db.agents.set(agent.id, newAgent);

    // Extract config fields from the flat input (everything except agent-record fields)
    const { id: _id, authorId: _authorId, visibility: _visibility, metadata: _metadata, ...snapshotConfig } = agent;

    // Create version 1 from the config
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      agentId: agent.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    });

    // Return the thin agent record (activeVersionId remains null)
    return this.deepCopyAgent(newAgent);
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    const { id, ...updates } = input;

    const existingAgent = this.db.agents.get(id);
    if (!existingAgent) {
      throw new Error(`Agent with id ${id} not found`);
    }

    const { authorId, visibility, activeVersionId, metadata, status } = updates;

    const updatedAgent: StorageAgentType = {
      ...existingAgent,
      ...(authorId !== undefined && { authorId }),
      ...(visibility !== undefined && { visibility }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(metadata !== undefined && {
        metadata: { ...existingAgent.metadata, ...metadata },
      }),
      ...(status !== undefined && { status }),
      updatedAt: new Date(),
    };

    this.db.agents.set(id, updatedAgent);
    return this.deepCopyAgent(updatedAgent);
  }

  async delete(id: string): Promise<void> {
    // Idempotent delete - no-op if agent doesn't exist
    this.db.agents.delete(id);
    // Whole-entity deletion atomically releases its custom labels and versions.
    this.deleteVersionLabelsByEntity(id);
    this.deleteAgentVersionsByParentId(id);
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const {
      page = 0,
      perPage: perPageInput,
      orderBy,
      authorId,
      visibility,
      metadata,
      status,
      entityIds,
      pinFavoritedFor,
      favoritedOnly,
    } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 100)
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Get all agents and apply filters
    let agents = Array.from(this.db.agents.values());

    // Restrict to a set of IDs (used by ?favoritedOnly=true).
    // An empty array means "no candidates" -> empty result.
    if (entityIds !== undefined) {
      if (entityIds.length === 0) {
        return {
          agents: [],
          total: 0,
          page,
          perPage: perPageInput === false ? false : perPage,
          hasMore: false,
        };
      }
      const idSet = new Set(entityIds);
      agents = agents.filter(agent => idSet.has(agent.id));
    }

    // Filter by status
    if (status) {
      agents = agents.filter(agent => agent.status === status);
    }

    // Filter by authorId if provided
    if (authorId !== undefined) {
      agents = agents.filter(agent => agent.authorId === authorId);
    }

    // Filter by visibility if provided
    if (visibility !== undefined) {
      agents = agents.filter(agent => agent.visibility === visibility);
    }

    // Filter by metadata if provided (AND logic - all key-value pairs must match)
    if (metadata && Object.keys(metadata).length > 0) {
      agents = agents.filter(agent => {
        if (!agent.metadata) return false;
        return Object.entries(metadata).every(([key, value]) => deepEqual(agent.metadata![key], value));
      });
    }

    // Optional favorited-first ordering / favorites-only filter.
    const favoritedIds = pinFavoritedFor ? this.collectFavoritedIdsFor(pinFavoritedFor) : undefined;
    if (favoritedOnly) {
      if (favoritedIds) {
        agents = agents.filter(agent => favoritedIds.has(agent.id));
      } else {
        // Defensive: favoritedOnly with no userId can never match a real row.
        agents = [];
      }
    }

    const sortedAgents = this.sortAgents(agents, field, direction, favoritedIds);

    // Deep clone agents to avoid mutation
    const clonedAgents = sortedAgents.map(agent => this.deepCopyAgent(agent));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      agents: clonedAgents.slice(offset, offset + perPage),
      total: clonedAgents.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedAgents.length,
    };
  }

  // ==========================================================================
  // Agent Version Methods
  // ==========================================================================

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    // Check if version with this ID already exists (versions are immutable)
    if (this.db.agentVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    // Check for duplicate (agentId, versionNumber) pair
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === input.agentId && version.versionNumber === input.versionNumber) {
        throw new Error(`Version number ${input.versionNumber} already exists for agent ${input.agentId}`);
      }
    }

    const version: AgentVersion = {
      ...input,
      createdAt: new Date(),
    };

    // Deep clone before storing to prevent external mutation
    this.db.agentVersions.set(input.id, this.deepCopyVersion(version));
    return this.deepCopyVersion(version);
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    const version = this.db.agentVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    let latest: AgentVersion | null = null;
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? this.deepCopyVersion(latest) : null;
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { agentId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    // Normalize perPage for query (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by agentId
    let versions = Array.from(this.db.agentVersions.values()).filter(v => v.agentId === agentId);

    // Sort versions
    versions = this.sortVersions(versions, field, direction);

    // Deep clone versions to avoid mutation
    const clonedVersions = versions.map(v => this.deepCopyVersion(v));

    const total = clonedVersions.length;
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const paginatedVersions = clonedVersions.slice(offset, offset + perPage);

    return {
      versions: paginatedVersions,
      total,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < total,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    const version = this.db.agentVersions.get(id);
    if (!version) return;

    const blockers = this.getPointersByVersion(version.agentId, id);
    if (blockers.length > 0) {
      throw createVersionLabelError('VERSION_IN_USE_BY_LABEL', {
        entityId: version.agentId,
        versionId: id,
        labels: blockers
          .map(pointer => pointer.label)
          .sort()
          .join(','),
      });
    }

    // Idempotent delete - no-op if version doesn't exist
    this.db.agentVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    const blockers = Array.from(this.db.versionLabels.values())
      .filter(pointer => pointer.entityType === 'agent' && pointer.entityId === entityId)
      .sort((left, right) => compareVersionLabelNames(left.label, right.label));
    if (blockers.length > 0) {
      throw createVersionLabelError('VERSION_IN_USE_BY_LABEL', {
        entityId,
        labels: blockers.map(pointer => pointer.label).join(','),
      });
    }
    this.deleteAgentVersionsByParentId(entityId);
  }

  private deleteAgentVersionsByParentId(entityId: string): void {
    const idsToDelete: string[] = [];
    for (const [id, version] of this.db.agentVersions.entries()) {
      if (version.agentId === entityId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.db.agentVersions.delete(id);
    }
  }

  // ==========================================================================
  // Version label channel
  // ==========================================================================

  private versionLabelKey(entityId: string, label: string): string {
    return JSON.stringify(['agent', entityId, label]);
  }

  private versionLabelReverseKey(entityId: string, versionId: string): string {
    return JSON.stringify(['agent', entityId, versionId]);
  }

  private assertAgentEntityType(entityType: string): asserts entityType is 'agent' {
    if (entityType !== 'agent') {
      throw createVersionLabelError('VERSION_LABELS_UNSUPPORTED', { entityType });
    }
  }

  private getPointer(entityId: string, label: string): VersionLabelPointer<'agent'> | null {
    const pointer = this.db.versionLabels.get(this.versionLabelKey(entityId, label));
    return pointer ? (structuredClone(pointer) as VersionLabelPointer<'agent'>) : null;
  }

  private getPointersByVersion(entityId: string, versionId: string): VersionLabelPointer<'agent'>[] {
    const reverseKey = this.versionLabelReverseKey(entityId, versionId);
    const keys = this.db.versionLabelsByVersion.get(reverseKey);
    if (!keys) return [];
    return Array.from(keys)
      .flatMap(key => {
        const pointer = this.db.versionLabels.get(key);
        return pointer ? [structuredClone(pointer) as VersionLabelPointer<'agent'>] : [];
      })
      .sort((left, right) => compareVersionLabelNames(left.label, right.label));
  }

  private addToVersionLabelReverseIndex(pointer: VersionLabelPointer): void {
    const reverseKey = this.versionLabelReverseKey(pointer.entityId, pointer.versionId);
    const keys = this.db.versionLabelsByVersion.get(reverseKey) ?? new Set<string>();
    keys.add(this.versionLabelKey(pointer.entityId, pointer.label));
    this.db.versionLabelsByVersion.set(reverseKey, keys);
  }

  private removeFromVersionLabelReverseIndex(pointer: VersionLabelPointer): void {
    const reverseKey = this.versionLabelReverseKey(pointer.entityId, pointer.versionId);
    const keys = this.db.versionLabelsByVersion.get(reverseKey);
    if (!keys) return;
    keys.delete(this.versionLabelKey(pointer.entityId, pointer.label));
    if (keys.size === 0) this.db.versionLabelsByVersion.delete(reverseKey);
  }

  private async getVersionLabel(input: GetVersionLabelInput<'agent'>): Promise<VersionLabelPointer<'agent'> | null> {
    this.assertAgentEntityType(input.entityType);
    validateVersionLabel(input.label);
    return this.getPointer(input.entityId, input.label);
  }

  private async listVersionLabels(input: ListVersionLabelsInput<'agent'>): Promise<ListVersionLabelsOutput<'agent'>> {
    this.assertAgentEntityType(input.entityType);
    const { page, perPage, responsePerPage, offset } = normalizeVersionLabelPagination(input);
    const labels = Array.from(this.db.versionLabels.values())
      .filter(pointer => pointer.entityType === 'agent' && pointer.entityId === input.entityId)
      .sort((left, right) => compareVersionLabelNames(left.label, right.label));

    return {
      labels: labels
        .slice(offset, offset + perPage)
        .map(pointer => structuredClone(pointer) as VersionLabelPointer<'agent'>),
      total: labels.length,
      page,
      perPage: responsePerPage,
      hasMore: responsePerPage === false ? false : offset + perPage < labels.length,
    };
  }

  private async listVersionLabelsByVersion(
    input: ListVersionLabelsByVersionInput<'agent'>,
  ): Promise<VersionLabelPointer<'agent'>[]> {
    this.assertAgentEntityType(input.entityType);
    return this.getPointersByVersion(input.entityId, input.versionId);
  }

  private async setVersionLabel(input: SetVersionLabelInput<'agent'>): Promise<VersionLabelPointer<'agent'>> {
    this.assertAgentEntityType(input.entityType);
    validateVersionLabel(input.label);
    validateVersionLabelRevisionToken(input.expectedRevisionToken, { allowNull: true });

    const entity = this.db.agents.get(input.entityId);
    if (!entity) {
      throw createVersionLabelError('ENTITY_NOT_FOUND', { entityType: input.entityType, entityId: input.entityId });
    }

    const target = this.db.agentVersions.get(input.versionId);
    if (!target) {
      throw createVersionLabelError('VERSION_NOT_FOUND', {
        entityType: input.entityType,
        entityId: input.entityId,
        versionId: input.versionId,
      });
    }
    if (target.agentId !== input.entityId) {
      throw createVersionLabelError('VERSION_NOT_OWNED_BY_ENTITY', {
        entityType: input.entityType,
        entityId: input.entityId,
        versionId: input.versionId,
        versionEntityId: target.agentId,
      });
    }

    const key = this.versionLabelKey(input.entityId, input.label);
    const existing = this.db.versionLabels.get(key) as VersionLabelPointer<'agent'> | undefined;

    // Desired-state idempotency takes precedence over a stale precondition.
    if (existing?.versionId === input.versionId) return structuredClone(existing);

    if (
      (input.expectedRevisionToken === null && existing) ||
      (input.expectedRevisionToken !== null && existing?.revisionToken !== input.expectedRevisionToken)
    ) {
      throw createVersionLabelConflictError(input, existing ?? null);
    }

    const now = new Date();
    const pointer: VersionLabelPointer<'agent'> = {
      entityType: 'agent',
      entityId: input.entityId,
      label: input.label,
      versionId: input.versionId,
      revisionToken: crypto.randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) this.removeFromVersionLabelReverseIndex(existing);
    this.db.versionLabels.set(key, structuredClone(pointer));
    this.addToVersionLabelReverseIndex(pointer);
    return structuredClone(pointer);
  }

  private async deleteVersionLabel(input: DeleteVersionLabelInput<'agent'>): Promise<{ deleted: boolean }> {
    this.assertAgentEntityType(input.entityType);
    validateVersionLabel(input.label);
    validateVersionLabelRevisionToken(input.expectedRevisionToken, { allowNull: false });
    const key = this.versionLabelKey(input.entityId, input.label);
    const existing = this.db.versionLabels.get(key) as VersionLabelPointer<'agent'> | undefined;
    if (!existing) return { deleted: false };
    if (existing.revisionToken !== input.expectedRevisionToken) {
      throw createVersionLabelConflictError(input, existing);
    }

    this.db.versionLabels.delete(key);
    this.removeFromVersionLabelReverseIndex(existing);
    return { deleted: true };
  }

  private deleteVersionLabelsByEntity(entityId: string): number {
    const pointers = Array.from(this.db.versionLabels.entries()).filter(
      ([, pointer]) => pointer.entityType === 'agent' && pointer.entityId === entityId,
    );
    for (const [key, pointer] of pointers) {
      this.db.versionLabels.delete(key);
      this.removeFromVersionLabelReverseIndex(pointer);
    }
    return pointers.length;
  }

  async countVersions(agentId: string): Promise<number> {
    let count = 0;
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Deep copy a thin agent record to prevent external mutation of stored data
   */
  private deepCopyAgent(agent: StorageAgentType): StorageAgentType {
    return {
      ...agent,
      metadata: agent.metadata ? { ...agent.metadata } : agent.metadata,
    };
  }

  /**
   * Deep copy a version to prevent external mutation of stored data
   */
  private deepCopyVersion(version: AgentVersion): AgentVersion {
    return structuredClone(version);
  }

  private sortAgents(
    agents: StorageAgentType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
    favoritedIds?: Set<string>,
  ): StorageAgentType[] {
    return agents.sort((a, b) => {
      // Compound sort: favorited first, then existing orderBy, then id ASC for stable pagination.
      if (favoritedIds) {
        const aFav = favoritedIds.has(a.id) ? 1 : 0;
        const bFav = favoritedIds.has(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
      }

      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();
      if (aValue !== bValue) {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }

      // Stable tie-break for same `createdAt`/`updatedAt`.
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  /**
   * Collect the set of agent IDs favorited by the given user. Returns an empty
   * Set when the favorites domain is not wired or the user has no favorites.
   */
  private collectFavoritedIdsFor(userId: string): Set<string> {
    const favorited = new Set<string>();
    for (const row of this.db.favorites.values()) {
      if (row.userId === userId && row.entityType === 'agent') {
        favorited.add(row.entityId);
      }
    }
    return favorited;
  }

  private sortVersions(
    versions: AgentVersion[],
    field: VersionOrderBy,
    direction: VersionSortDirection,
  ): AgentVersion[] {
    return versions.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (field === 'createdAt') {
        aVal = a.createdAt.getTime();
        bVal = b.createdAt.getTime();
      } else {
        // versionNumber
        aVal = a.versionNumber;
        bVal = b.versionNumber;
      }

      return direction === 'ASC' ? aVal - bVal : bVal - aVal;
    });
  }
}
