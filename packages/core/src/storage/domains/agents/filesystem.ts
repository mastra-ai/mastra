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
import type { AgentVersion, CreateVersionInput, ListVersionsInput, ListVersionsOutput } from './base';
import { AgentsStorage } from './base';

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

export class FilesystemAgentsStorage extends AgentsStorage {
  private helpers: FilesystemVersionedHelpers<StorageAgentType, AgentVersion>;
  private storageMastra?: StorageMastraRef;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    const getCodeAgent = (entityId: string) => {
      try {
        const agent = this.storageMastra?.getAgentById?.(entityId);
        return agent?.source === 'code' ? agent : undefined;
      } catch {
        return undefined;
      }
    };
    const isCodeAgent = (entityId: string): boolean => Boolean(getCodeAgent(entityId));
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
      shouldPersistToPerEntityFile: entity => isCodeAgent(entity.id),
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
  }

  __registerMastra(mastra: StorageMastraRef): void {
    this.storageMastra = mastra;
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.helpers.dangerouslyClearAll();
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    return this.helpers.getById(id);
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
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
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      agentId: agent.id,
      versionNumber: 1,
      ...filtered,
      changedFields: Object.keys(filtered),
      changeMessage: 'Initial version',
    } as CreateVersionInput);

    return structuredClone(entity);
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    const { id, ...updates } = input;
    // Strip snapshot config fields that don't belong on the entity record
    const entityUpdates: Record<string, unknown> = {};
    const entityFields = new Set(['authorId', 'visibility', 'metadata', 'activeVersionId', 'status']);
    for (const [key, value] of Object.entries(updates)) {
      if (entityFields.has(key)) {
        entityUpdates[key] = value;
      }
    }
    return this.helpers.updateEntity(id, entityUpdates);
  }

  async delete(id: string): Promise<void> {
    await this.helpers.deleteEntity(id);
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
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
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    return this.helpers.getVersionByNumber(agentId, versionNumber);
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    return this.helpers.getLatestVersion(agentId);
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const result = await this.helpers.listVersions(input, 'agentId');
    return result as ListVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.helpers.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.helpers.deleteVersionsByParentId(entityId);
  }

  async countVersions(agentId: string): Promise<number> {
    return this.helpers.countVersions(agentId);
  }
}
