import { calculatePagination, normalizePerPage } from '../../base';
import type { StorageMastraRef } from '../../base';
import { SOURCE_CONTROL_AGENTS_DIR, getSourceAgentFilePath } from '../../source-control';
import type { SourceFileHistoryEntry, SourceControlProvider, SourceWriteResult } from '../../source-control';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageUpdateAgentInput,
} from '../../types';
import { InMemoryDB } from '../inmemory-db';
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
  VersionOrderBy,
  VersionSortDirection,
} from './base';
import { AgentsStorage } from './base';
import { InMemoryAgentsStorage } from './inmemory';

const SOURCE_VERSION_PREFIX = 'source:';

const COMMON_EXCLUDED_FIELDS = new Set([
  'id',
  'model',
  'scorers',
  'skills',
  'workflows',
  'agents',
  'integrationTools',
  'toolProviders',
  'inputProcessors',
  'outputProcessors',
  'memory',
  'mcpClients',
  'workspace',
  'browser',
  'defaultOptions',
]);
const CODE_SOURCE_EXCLUDED_FIELDS = new Set(['name']);

const OWNED_FIELDS_BY_GROUP = {
  instructions: ['instructions'],
  tools: ['tools'],
} as const;

export interface SourceAgentsSourceControlConfig {
  provider: SourceControlProvider;
  agentIds?: string[];
}

function ownershipFromEditorConfig(editorConfig: unknown): {
  ownsInstructions: boolean;
  ownsTools: boolean;
} {
  if (editorConfig === false) {
    return { ownsInstructions: false, ownsTools: false };
  }
  if (editorConfig === undefined || editorConfig === null) {
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

function snapshotFromVersion(version: AgentVersion): Record<string, unknown> {
  const { id, agentId, versionNumber, changedFields, changeMessage, createdAt, ...snapshot } = version;
  void id;
  void agentId;
  void versionNumber;
  void changedFields;
  void changeMessage;
  void createdAt;
  return snapshot;
}

function filterSourceSnapshot(
  snapshot: Record<string, unknown>,
  editorConfig: unknown,
  isCodeDefinedAgent: boolean,
): Record<string, unknown> {
  const excludedByOwnership = new Set<string>();
  if (isCodeDefinedAgent) {
    const { ownsInstructions, ownsTools } = ownershipFromEditorConfig(editorConfig);
    if (!ownsInstructions) {
      for (const field of OWNED_FIELDS_BY_GROUP.instructions) excludedByOwnership.add(field);
    }
    if (!ownsTools) {
      for (const field of OWNED_FIELDS_BY_GROUP.tools) excludedByOwnership.add(field);
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (COMMON_EXCLUDED_FIELDS.has(key)) continue;
    if (isCodeDefinedAgent && CODE_SOURCE_EXCLUDED_FIELDS.has(key)) continue;
    if (excludedByOwnership.has(key)) continue;
    if (value === undefined) continue;
    result[key] = value;
  }
  return result;
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function agentIdFromSourcePath(path: string): string | undefined {
  const prefix = `${SOURCE_CONTROL_AGENTS_DIR}/`;
  if (!path.startsWith(prefix) || !path.endsWith('.json')) return undefined;

  const filename = path.slice(prefix.length, -'.json'.length);
  if (!filename || filename.includes('/')) return undefined;

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

export class SourceAgentsSourceControl extends AgentsStorage {
  private readonly provider: SourceControlProvider;
  private readonly knownAgentIds: Set<string>;
  private readonly db = new InMemoryDB();
  private readonly memory = new InMemoryAgentsStorage({ db: this.db });
  private storageMastra?: StorageMastraRef;
  private readonly providerVersions = new Map<string, AgentVersion>();
  private readonly loadedHistory = new Set<string>();
  private readonly hydratedAgents = new Set<string>();
  private readonly activeRefs = new Map<string, string>();
  private providerAgentIdsDiscovered = false;

  constructor({ provider, agentIds = [] }: SourceAgentsSourceControlConfig) {
    super();
    this.provider = provider;
    this.knownAgentIds = new Set(agentIds);
  }

  __registerMastra(mastra: StorageMastraRef): void {
    this.storageMastra = mastra;
  }

  override async init(): Promise<void> {
    const capabilities = await this.provider.getCapabilities();
    if (!capabilities.canRead) {
      throw new Error(capabilities.reason ?? `Source provider ${this.provider.displayName} cannot read files`);
    }
    this.refreshKnownAgentIds();
    await this.discoverProviderAgentIds();
    await Promise.all([...this.knownAgentIds].map(agentId => this.hydrateAgent(agentId)));
  }

  async dangerouslyClearAll(): Promise<void> {
    this.hydratedAgents.clear();
    this.loadedHistory.clear();
    this.providerVersions.clear();
    this.activeRefs.clear();
    this.providerAgentIdsDiscovered = false;
    await this.memory.dangerouslyClearAll();
  }

  async useProviderRef(agentId: string, ref: string): Promise<void> {
    this.activeRefs.set(agentId, ref);
    this.hydratedAgents.delete(agentId);
    this.loadedHistory.delete(agentId);
    for (const [versionId, version] of this.providerVersions.entries()) {
      if (version.agentId === agentId) {
        this.providerVersions.delete(versionId);
      }
    }
    await this.memory.delete(agentId);
    await this.hydrateAgent(agentId);
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    await this.hydrateAgent(id);
    return this.memory.getById(id);
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    await this.hydrateAgent(input.agent.id);
    const existing = await this.memory.getById(input.agent.id);
    if (existing) {
      throw new Error(`Agent with id ${input.agent.id} already exists`);
    }

    await this.persistSnapshot(input.agent.id, { ...input.agent }, 'Initial version');
    const created = await this.memory.create(input);
    this.knownAgentIds.add(input.agent.id);
    return created;
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    await this.hydrateAgent(input.id);
    return this.memory.update(input);
  }

  async delete(id: string): Promise<void> {
    this.knownAgentIds.delete(id);
    this.hydratedAgents.delete(id);
    this.loadedHistory.delete(id);
    for (const versionId of this.providerVersions.keys()) {
      if (this.providerVersions.get(versionId)?.agentId === id) {
        this.providerVersions.delete(versionId);
      }
    }
    await this.memory.delete(id);
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    this.refreshKnownAgentIds();
    await this.discoverProviderAgentIds();
    await Promise.all([...this.knownAgentIds].map(agentId => this.hydrateAgent(agentId)));
    return this.memory.list(args);
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    await this.hydrateAgent(input.agentId);
    const existingVersion = await this.memory.getVersion(input.id);
    if (existingVersion) {
      throw new Error(`Version with id ${input.id} already exists`);
    }
    const existingVersionNumber = await this.memory.getVersionByNumber(input.agentId, input.versionNumber);
    if (existingVersionNumber) {
      throw new Error(`Version number ${input.versionNumber} already exists for agent ${input.agentId}`);
    }

    const snapshot = snapshotFromVersion({ ...input, createdAt: new Date() } as AgentVersion);
    const result = await this.persistSnapshot(input.agentId, snapshot, input.changeMessage);
    const version = await this.memory.createVersion(input);
    this.rememberProviderVersion(input.agentId, version, result);
    return version;
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    const providerVersion = this.providerVersions.get(id);
    if (providerVersion) {
      return structuredClone(providerVersion);
    }
    return this.memory.getVersion(id);
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    await this.loadHistory(agentId);
    const providerVersion = [...this.providerVersions.values()].find(
      version => version.agentId === agentId && version.versionNumber === versionNumber,
    );
    if (providerVersion) {
      return structuredClone(providerVersion);
    }
    return this.memory.getVersionByNumber(agentId, versionNumber);
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    await this.loadHistory(agentId);
    const providerLatest = [...this.providerVersions.values()]
      .filter(version => version.agentId === agentId)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];
    if (providerLatest) {
      return structuredClone(providerLatest);
    }
    return this.memory.getLatestVersion(agentId);
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    await this.loadHistory(input.agentId);
    const providerVersions = [...this.providerVersions.values()].filter(version => version.agentId === input.agentId);
    if (providerVersions.length === 0) {
      return this.memory.listVersions(input);
    }

    const { page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);
    const perPage = normalizePerPage(perPageInput, 20);
    const sortedVersions = this.sortVersions(providerVersions, field, direction).map(version =>
      structuredClone(version),
    );
    const total = sortedVersions.length;
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      versions: sortedVersions.slice(offset, offset + perPage),
      total,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < total,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    this.providerVersions.delete(id);
    await this.memory.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    for (const [versionId, version] of this.providerVersions.entries()) {
      if (version.agentId === entityId) {
        this.providerVersions.delete(versionId);
      }
    }
    await this.memory.deleteVersionsByParentId(entityId);
  }

  async countVersions(entityId: string): Promise<number> {
    await this.loadHistory(entityId);
    const providerCount = [...this.providerVersions.values()].filter(version => version.agentId === entityId).length;
    return providerCount || this.memory.countVersions(entityId);
  }

  private refreshKnownAgentIds(): void {
    const agents = this.storageMastra?.listAgents?.();
    if (!agents) return;
    for (const agent of Object.values(agents)) {
      if (agent.source === 'code') {
        this.knownAgentIds.add(agent.id);
      }
    }
  }

  private async discoverProviderAgentIds(): Promise<void> {
    if (this.providerAgentIdsDiscovered || !this.provider.listFiles) return;

    const files = await this.provider.listFiles({ path: SOURCE_CONTROL_AGENTS_DIR });
    for (const file of files) {
      const agentId = agentIdFromSourcePath(file.path);
      if (agentId) {
        this.knownAgentIds.add(agentId);
      }
    }
    this.providerAgentIdsDiscovered = true;
  }

  private async hydrateAgent(agentId: string): Promise<void> {
    if (this.hydratedAgents.has(agentId)) return;

    const ref = this.activeRefs.get(agentId);
    const file = await this.provider.readFile({ path: getSourceAgentFilePath(agentId), ref });
    if (!file) {
      this.hydratedAgents.add(agentId);
      return;
    }

    const snapshot = parseJsonObject(file.content);
    if (!snapshot) {
      this.hydratedAgents.add(agentId);
      return;
    }

    this.knownAgentIds.add(agentId);
    this.hydratedAgents.add(agentId);
    const now = new Date();
    const versionId = `hydrated-${agentId}-v1`;
    this.db.agents.set(agentId, {
      id: agentId,
      status: 'published',
      activeVersionId: versionId,
      favoriteCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    this.db.agentVersions.set(versionId, {
      id: versionId,
      agentId,
      versionNumber: 1,
      ...snapshot,
      createdAt: now,
    } as AgentVersion);
  }

  private getCodeDefinedAgent(agentId: string): { source?: string; __getEditorConfig?: () => unknown } | undefined {
    try {
      const agent = this.storageMastra?.getAgentById?.(agentId) as
        { source?: string; __getEditorConfig?: () => unknown } | undefined;
      return agent?.source === 'code' ? agent : undefined;
    } catch {
      return undefined;
    }
  }

  private async persistSnapshot(
    agentId: string,
    snapshot: Record<string, unknown>,
    message?: string,
  ): Promise<SourceWriteResult> {
    const capabilities = await this.provider.getCapabilities();
    if (!capabilities.canWrite) {
      throw new Error(capabilities.reason ?? `Source provider ${this.provider.displayName} cannot write files`);
    }
    const agent = this.getCodeDefinedAgent(agentId);
    const filtered = filterSourceSnapshot(snapshot, agent?.__getEditorConfig?.(), Boolean(agent));
    return this.provider.writeFile({
      path: getSourceAgentFilePath(agentId),
      ref: this.activeRefs.get(agentId),
      content: `${stableStringify(filtered)}\n`,
      message,
    });
  }

  private async loadHistory(agentId: string): Promise<void> {
    if (this.loadedHistory.has(agentId)) return;

    const capabilities = await this.provider.getCapabilities();
    if (!capabilities.canListHistory) {
      this.loadedHistory.add(agentId);
      return;
    }

    const activeRef = this.activeRefs.get(agentId);
    const entries = await this.provider.listFileHistory({ path: getSourceAgentFilePath(agentId), ref: activeRef });
    const orderedEntries = [...entries].reverse();
    const versions = new Map<string, AgentVersion>();
    let versionNumber = 0;
    for (const entry of orderedEntries) {
      const file = await this.provider.readFile({ path: getSourceAgentFilePath(agentId), ref: entry.ref ?? entry.id });
      if (!file) continue;
      const snapshot = parseJsonObject(file.content);
      if (!snapshot) continue;
      versionNumber += 1;
      const version = this.versionFromHistoryEntry(agentId, entry, versionNumber, snapshot);
      versions.set(version.id, version);
    }
    for (const [versionId, version] of versions) {
      this.providerVersions.set(versionId, version);
    }
    this.loadedHistory.add(agentId);
  }

  private rememberProviderVersion(agentId: string, version: AgentVersion, result: SourceWriteResult): void {
    const versionId = result.commitSha ? `${SOURCE_VERSION_PREFIX}${result.commitSha}:${agentId}` : version.id;
    this.providerVersions.set(versionId, {
      ...structuredClone(version),
      id: versionId,
      agentId,
      versionNumber: this.nextProviderVersionNumber(agentId),
    });
  }

  private versionFromHistoryEntry(
    agentId: string,
    entry: SourceFileHistoryEntry,
    versionNumber: number,
    snapshot: Record<string, unknown>,
  ): AgentVersion {
    return {
      id: `${SOURCE_VERSION_PREFIX}${entry.id}:${agentId}`,
      agentId,
      versionNumber,
      changeMessage: entry.message,
      ...snapshot,
      createdAt: new Date(entry.createdAt),
    } as AgentVersion;
  }

  private nextProviderVersionNumber(agentId: string): number {
    const latest = [...this.providerVersions.values()]
      .filter(version => version.agentId === agentId)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];
    return (latest?.versionNumber ?? 0) + 1;
  }

  private sortVersions(
    versions: AgentVersion[],
    field: VersionOrderBy,
    direction: VersionSortDirection,
  ): AgentVersion[] {
    return versions.sort((a, b) => {
      const aVal = field === 'createdAt' ? a.createdAt.getTime() : a.versionNumber;
      const bVal = field === 'createdAt' ? b.createdAt.getTime() : b.versionNumber;
      return direction === 'ASC' ? aVal - bVal : bVal - aVal;
    });
  }
}
