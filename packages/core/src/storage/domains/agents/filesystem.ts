import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import type { StorageMastraRef } from '../../base';
import type { FilesystemDB } from '../../filesystem-db';
import { FilesystemVersionedHelpers } from '../../filesystem-versioned';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
} from '../../types';
import {
  createVersionLabelConflictError,
  createVersionLabelError,
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
import type { AgentVersion, CreateVersionInput, ListVersionsInput, ListVersionsOutput } from './base';
import { AgentsStorage } from './base';
import { FilesystemAgentVersionLabelRegistry } from './filesystem-version-labels';

const filesystemMutationTails = new Map<string, Promise<void>>();

async function runInFilesystemCriticalSection<T>(scope: string, operation: () => Promise<T>): Promise<T> {
  const previous = filesystemMutationTails.get(scope) ?? Promise.resolve();
  let release!: () => void;
  const lock = new Promise<void>(resolve => {
    release = resolve;
  });
  const tail = previous.then(
    () => lock,
    () => lock,
  );
  filesystemMutationTails.set(scope, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (filesystemMutationTails.get(scope) === tail) filesystemMutationTails.delete(scope);
  }
}

/**
 * Fields persisted for filesystem-stored agents.
 * Only fields that `applyStoredOverrides` actually uses plus the
 * minimum required by the storage schema (`name`, `model`).
 */
const PERSISTED_SNAPSHOT_FIELDS = new Set([
  'name',
  'instructions',
  'model',
  'tools',
  'integrationTools',
  'toolProviders',
  'mcpClients',
  'requestContextSchema',
]);

/**
 * Fields always excluded from per-entity (code-mode) JSON files regardless
 * of editor config. `model`/`name` are not editable from Studio for
 * code-defined agents, so they should not appear in the committed override
 * JSON — they would otherwise look like settable fields in code review and
 * could drift from the source-of-truth declaration in code.
 */
const CODE_MODE_EXCLUDED_FIELDS = new Set(['model', 'name']);

/**
 * Fields that depend on per-agent editor ownership.
 * When the agent's editor config does not own a given field (e.g.
 * descriptions-only mode does not own raw instructions), it should be
 * omitted from the on-disk per-entity JSON entirely.
 */
const OWNED_FIELDS_BY_GROUP = {
  instructions: ['instructions'],
  tools: ['tools', 'integrationTools', 'mcpClients'],
} as const;

function ownershipFromEditorConfig(editorConfig: unknown): {
  ownsInstructions: boolean;
  ownsTools: boolean;
} {
  if (editorConfig === false) {
    return { ownsInstructions: false, ownsTools: false };
  }
  if (editorConfig === undefined || editorConfig === null) {
    // Code agents without explicit editor config behave as fully editable.
    return { ownsInstructions: true, ownsTools: true };
  }
  if (typeof editorConfig !== 'object') {
    return { ownsInstructions: false, ownsTools: false };
  }
  const cfg = editorConfig as { instructions?: unknown; tools?: unknown };
  const ownsInstructions = cfg.instructions === true;
  const toolsCfg = cfg.tools;
  const ownsTools =
    toolsCfg === true ||
    (typeof toolsCfg === 'object' && toolsCfg !== null && (toolsCfg as { description?: unknown }).description === true);
  return { ownsInstructions, ownsTools };
}

function stripUnusedFields<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (PERSISTED_SNAPSHOT_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result as T;
}

function isAgentNotFoundError(error: unknown, entityId: string): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { id?: unknown; message?: unknown; details?: { status?: unknown; agentId?: unknown } };
  return (
    maybeError.id === 'MASTRA_GET_AGENT_BY_AGENT_ID_NOT_FOUND' ||
    (maybeError.details?.status === 404 && maybeError.details?.agentId === entityId) ||
    maybeError.message === `Agent with id ${entityId} not found`
  );
}

/**
 * Filesystem-backed agent storage.
 *
 * Version history normally lives only in memory; disk keeps just the published
 * snapshots. Custom version labels are hard references, so the label registry
 * (`agent-version-labels.json`) retains an exact copy of every labeled agent and
 * its versions and re-injects that copy on hydrate, superseding the synthetic
 * snapshot reconstruction.
 *
 * CONTRACT: every write path that mutates a labeled agent or its versions must
 * refresh the retained registry state inside its critical section (see
 * `refreshRetainedEntity` and the registry commits in `update`, `createVersion`,
 * `deleteVersion`, and `delete`). A new write path that skips the refresh will
 * silently revert the agent to stale retained state on the next restart.
 */
export class FilesystemAgentsStorage extends AgentsStorage {
  private helpers: FilesystemVersionedHelpers<StorageAgentType, AgentVersion>;
  private readonly versionLabelRegistry: FilesystemAgentVersionLabelRegistry;
  private readonly mutationPath: string;
  private readonly isCodeAgent: (entityId: string) => boolean;
  private storageMastra?: StorageMastraRef;
  override readonly versionLabels: VersionLabelStorageChannel<'agent'>;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    const getCodeAgent = (entityId: string) => {
      try {
        const agent = this.storageMastra?.getAgentById?.(entityId);
        return agent?.source === 'code' ? agent : undefined;
      } catch (error) {
        if (isAgentNotFoundError(error, entityId)) {
          return undefined;
        }
        throw error;
      }
    };
    this.isCodeAgent = (entityId: string): boolean => Boolean(getCodeAgent(entityId));
    const editorConfigFor = (entityId: string): unknown => getCodeAgent(entityId)?.__getEditorConfig?.();
    this.helpers = new FilesystemVersionedHelpers({
      db,
      entitiesFile: 'agents.json',
      parentIdField: 'agentId',
      name: 'FilesystemAgentsStorage',
      versionMetadataFields: ['id', 'agentId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
      perEntityFilesDir: 'agents',
      // Per-entity layout is used only for code-mode agents — i.e. agents
      // that are declared in code (`source === 'code'`). For db-mode and
      // user-created stored agents we keep the shared `agents.json` layout.
      shouldPersistToPerEntityFile: entity => this.isCodeAgent(entity.id),
      perEntitySnapshotFilter: (snapshot, entity) => {
        const { ownsInstructions, ownsTools } = ownershipFromEditorConfig(editorConfigFor(entity.id));
        const excludedByOwnership = new Set<string>();
        if (!ownsInstructions) {
          for (const field of OWNED_FIELDS_BY_GROUP.instructions) excludedByOwnership.add(field);
        }
        if (!ownsTools) {
          for (const field of OWNED_FIELDS_BY_GROUP.tools) excludedByOwnership.add(field);
        }
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(snapshot)) {
          if (CODE_MODE_EXCLUDED_FIELDS.has(key)) continue;
          if (excludedByOwnership.has(key)) continue;
          result[key] = value;
        }
        return result;
      },
    });
    this.versionLabelRegistry = new FilesystemAgentVersionLabelRegistry({ db, helpers: this.helpers });
    this.mutationPath = resolve(db.dir);
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
        return this.deleteVersionLabelsByEntity(input.entityId, true);
      },
    };
  }

  __registerMastra(mastra: StorageMastraRef): void {
    this.storageMastra = mastra;
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
    this.versionLabelRegistry.hydrate();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.withMutation(async () => {
      await this.helpers.dangerouslyClearAll();
      await this.versionLabelRegistry.clear();
    });
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    this.versionLabelRegistry.hydrate();
    return this.helpers.getById(id);
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    return this.withMutation(async () => {
      const { agent } = input;
      const now = new Date();
      // Default visibility to 'private' when an authorId is set; leave undefined for legacy unowned rows.
      const visibility = agent.visibility ?? (agent.authorId ? 'private' : undefined);
      const entity: StorageAgentType = {
        id: agent.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: agent.authorId,
        visibility,
        metadata: agent.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await this.helpers.createEntity(agent.id, entity);

      const { id: _id, authorId: _authorId, visibility: _visibility, metadata: _metadata, ...snapshotConfig } = agent;
      const filtered = stripUnusedFields(snapshotConfig);
      await this.createVersionUnlocked({
        id: crypto.randomUUID(),
        agentId: agent.id,
        versionNumber: 1,
        ...filtered,
        changedFields: Object.keys(filtered),
        changeMessage: 'Initial version',
      } as CreateVersionInput);

      return structuredClone(entity);
    });
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    return this.withMutation(async () => {
      const { id, ...updates } = input;
      // Strip snapshot config fields that don't belong on the entity record
      const entityUpdates: Record<string, unknown> = {};
      const entityFields = new Set(['authorId', 'visibility', 'metadata', 'activeVersionId', 'status']);
      for (const [key, value] of Object.entries(updates)) {
        if (entityFields.has(key)) {
          entityUpdates[key] = value;
        }
      }
      const updated = await this.helpers.updateEntity(id, entityUpdates);
      if (this.versionLabelRegistry.hasPointers(id)) {
        await this.versionLabelRegistry.commit(() => this.refreshRetainedEntity(id));
      }
      return updated;
    });
  }

  async delete(id: string): Promise<void> {
    await this.withMutation(async () => {
      const hasPointers = this.versionLabelRegistry.hasPointers(id);
      await this.helpers.deleteEntity(id);
      if (hasPointers) {
        await this.versionLabelRegistry.commit(() => {
          this.versionLabelRegistry.deleteByEntity(id);
        });
      }
    });
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    this.versionLabelRegistry.hydrate();
    const { page, perPage, orderBy, authorId, visibility, metadata, status } = args || {};
    const result = await this.helpers.listEntities({
      page,
      perPage,
      orderBy,
      listKey: 'agents',
      filters: { authorId, visibility, metadata, status },
    });
    return result as unknown as StorageListAgentsOutput;
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    return this.withMutation(async () => {
      const version = await this.createVersionUnlocked(input);
      if (this.versionLabelRegistry.hasPointers(input.agentId)) {
        await this.versionLabelRegistry.commit(() => this.refreshRetainedEntity(input.agentId));
      }
      return version;
    });
  }

  private async createVersionUnlocked(input: CreateVersionInput): Promise<AgentVersion> {
    const { id, agentId, versionNumber, changedFields, changeMessage, ...snapshotFields } = input;
    const filtered = stripUnusedFields(snapshotFields as Record<string, unknown>);
    return this.helpers.createVersion({
      id,
      agentId,
      versionNumber,
      changedFields,
      changeMessage,
      ...filtered,
    } as AgentVersion);
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    this.versionLabelRegistry.hydrate();
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    this.versionLabelRegistry.hydrate();
    return this.helpers.getVersionByNumber(agentId, versionNumber);
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    this.versionLabelRegistry.hydrate();
    return this.helpers.getLatestVersion(agentId);
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    this.versionLabelRegistry.hydrate();
    const result = await this.helpers.listVersions(input, 'agentId');
    return result as ListVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.withMutation(async () => {
      const version = await this.helpers.getVersion(id);
      if (!version) return;

      const blockers = this.versionLabelRegistry.listByVersion(version.agentId, id);
      if (blockers.length > 0) {
        throw createVersionLabelError('VERSION_IN_USE_BY_LABEL', {
          entityId: version.agentId,
          versionId: id,
          labels: blockers.map(pointer => pointer.label).join(','),
        });
      }

      if (this.versionLabelRegistry.hasPointers(version.agentId)) {
        await this.versionLabelRegistry.commit(() => {
          this.versionLabelRegistry.dropRetainedVersion(id);
        });
      }
      await this.helpers.deleteVersion(id);
    });
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.withMutation(async () => {
      const blockers = this.versionLabelRegistry.list({ entityType: 'agent', entityId, perPage: false }).labels;
      if (blockers.length > 0) {
        throw createVersionLabelError('VERSION_IN_USE_BY_LABEL', {
          entityId,
          labels: blockers.map(pointer => pointer.label).join(','),
        });
      }
      await this.helpers.deleteVersionsByParentId(entityId);
    });
  }

  async countVersions(agentId: string): Promise<number> {
    this.versionLabelRegistry.hydrate();
    return this.helpers.countVersions(agentId);
  }

  // ==========================================================================
  // Version label channel
  // ==========================================================================

  private withMutation<T>(operation: () => Promise<T>): Promise<T> {
    return this.withRegistryAccess(operation);
  }

  private withRegistryAccess<T>(operation: () => Promise<T> | T): Promise<T> {
    let mutationScope = this.mutationPath;
    try {
      mutationScope = realpathSync.native(this.mutationPath);
    } catch {
      // The first mutation may create the storage directory. Its absolute path
      // remains a stable lock key until it exists and can be canonicalized.
    }
    return runInFilesystemCriticalSection(mutationScope, async () => {
      this.versionLabelRegistry.reload();
      return operation();
    });
  }

  private assertAgentEntityType(entityType: string): asserts entityType is 'agent' {
    if (entityType !== 'agent') {
      throw createVersionLabelError('VERSION_LABELS_UNSUPPORTED', { entityType });
    }
  }

  private assertCustomLabelsSupportedForEntity(entityId: string): void {
    if (this.isCodeAgent(entityId)) {
      throw createVersionLabelError('VERSION_LABELS_UNSUPPORTED', { entityType: 'agent', entityId });
    }
  }

  private async getVersionLabel(input: GetVersionLabelInput<'agent'>): Promise<VersionLabelPointer<'agent'> | null> {
    return this.withRegistryAccess(() => {
      this.assertAgentEntityType(input.entityType);
      this.assertCustomLabelsSupportedForEntity(input.entityId);
      validateVersionLabel(input.label);
      return this.versionLabelRegistry.get(input.entityId, input.label);
    });
  }

  private async listVersionLabels(input: ListVersionLabelsInput<'agent'>): Promise<ListVersionLabelsOutput<'agent'>> {
    return this.withRegistryAccess(() => {
      this.assertAgentEntityType(input.entityType);
      this.assertCustomLabelsSupportedForEntity(input.entityId);
      return this.versionLabelRegistry.list(input);
    });
  }

  private async listVersionLabelsByVersion(
    input: ListVersionLabelsByVersionInput<'agent'>,
  ): Promise<VersionLabelPointer<'agent'>[]> {
    return this.withRegistryAccess(() => {
      this.assertAgentEntityType(input.entityType);
      this.assertCustomLabelsSupportedForEntity(input.entityId);
      return this.versionLabelRegistry.listByVersion(input.entityId, input.versionId);
    });
  }

  private async setVersionLabel(input: SetVersionLabelInput<'agent'>): Promise<VersionLabelPointer<'agent'>> {
    return this.withMutation(async () => {
      this.assertAgentEntityType(input.entityType);
      this.assertCustomLabelsSupportedForEntity(input.entityId);
      validateVersionLabel(input.label);
      validateVersionLabelRevisionToken(input.expectedRevisionToken, { allowNull: true });

      const entity = await this.helpers.getById(input.entityId);
      if (!entity) {
        throw createVersionLabelError('ENTITY_NOT_FOUND', {
          entityType: input.entityType,
          entityId: input.entityId,
        });
      }

      const target = await this.helpers.getVersion(input.versionId);
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

      const existing = this.versionLabelRegistry.get(input.entityId, input.label);
      if (existing?.versionId === input.versionId) return existing;
      if (
        (input.expectedRevisionToken === null && existing) ||
        (input.expectedRevisionToken !== null && existing?.revisionToken !== input.expectedRevisionToken)
      ) {
        throw createVersionLabelConflictError(input, existing);
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
      const listInput: ListVersionsInput = { agentId: input.entityId, perPage: false };
      const { versions } = await this.helpers.listVersions(listInput, 'agentId');
      await this.versionLabelRegistry.commit(() => {
        this.versionLabelRegistry.set(pointer);
        this.versionLabelRegistry.replaceRetainedEntity(entity, versions);
      });
      return structuredClone(pointer);
    });
  }

  private async deleteVersionLabel(input: DeleteVersionLabelInput<'agent'>): Promise<{ deleted: boolean }> {
    return this.withMutation(async () => {
      this.assertAgentEntityType(input.entityType);
      this.assertCustomLabelsSupportedForEntity(input.entityId);
      validateVersionLabel(input.label);
      validateVersionLabelRevisionToken(input.expectedRevisionToken, { allowNull: false });

      const existing = this.versionLabelRegistry.get(input.entityId, input.label);
      if (!existing) return { deleted: false };
      if (existing.revisionToken !== input.expectedRevisionToken) {
        throw createVersionLabelConflictError(input, existing);
      }

      const isLastPointer =
        this.versionLabelRegistry.list({ entityType: 'agent', entityId: input.entityId, perPage: false }).total === 1;
      if (isLastPointer) this.helpers.persistCurrentState();
      await this.versionLabelRegistry.commit(() => {
        this.versionLabelRegistry.delete(input.entityId, input.label);
        if (!this.versionLabelRegistry.hasPointers(input.entityId)) {
          this.versionLabelRegistry.dropRetainedEntity(input.entityId);
        }
      });
      return { deleted: true };
    });
  }

  private async deleteVersionLabelsByEntity(entityId: string, enforceCapability = false): Promise<number> {
    return this.withMutation(async () => {
      if (enforceCapability) this.assertCustomLabelsSupportedForEntity(entityId);
      if (!this.versionLabelRegistry.hasPointers(entityId)) return 0;
      this.helpers.persistCurrentState();
      return this.versionLabelRegistry.commit(() => this.versionLabelRegistry.deleteByEntity(entityId));
    });
  }

  private async refreshRetainedEntity(entityId: string): Promise<void> {
    if (!this.versionLabelRegistry.hasPointers(entityId)) {
      this.versionLabelRegistry.dropRetainedEntity(entityId);
      return;
    }

    const entity = await this.helpers.getById(entityId);
    if (!entity) {
      throw createVersionLabelError('VERSION_LABEL_INTEGRITY_ERROR', { entityType: 'agent', entityId });
    }
    const listInput: ListVersionsInput = { agentId: entityId, perPage: false };
    const { versions } = await this.helpers.listVersions(listInput, 'agentId');
    this.versionLabelRegistry.replaceRetainedEntity(entity, versions);
  }
}
