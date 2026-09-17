import type { FilesystemDB } from '../../filesystem-db';
import type { FilesystemVersionedHelpers } from '../../filesystem-versioned';
import type { StorageAgentType } from '../../types';
import {
  compareVersionLabelNames,
  createVersionLabelError,
  normalizeVersionLabelPagination,
  validateVersionLabel,
} from '../version-labels';
import type { ListVersionLabelsInput, ListVersionLabelsOutput, VersionLabelPointer } from '../version-labels';
import type { AgentVersion } from './base';

const STATE_FILE = 'agent-version-labels.json';
const STATE_SCHEMA_VERSION = 1;

interface FilesystemAgentVersionLabelState {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  labels: VersionLabelPointer<'agent'>[];
  /**
   * Filesystem versions normally live only in memory. Retaining the exact entity
   * and its versions here prevents a durable label from dangling after restart.
   */
  entities: StorageAgentType[];
  versions: AgentVersion[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function integrityError(reason: string) {
  return createVersionLabelError('VERSION_LABEL_INTEGRITY_ERROR', { file: STATE_FILE, reason });
}

/**
 * Adapter-owned label registry. Label names remain JSON data and are never
 * interpolated into paths. All mutations are persisted with one atomic replace.
 */
export class FilesystemAgentVersionLabelRegistry {
  private readonly db: FilesystemDB;
  private readonly helpers: FilesystemVersionedHelpers<StorageAgentType, AgentVersion>;
  private readonly pointers = new Map<string, VersionLabelPointer<'agent'>>();
  private readonly retainedEntities = new Map<string, StorageAgentType>();
  private readonly retainedVersions = new Map<string, AgentVersion>();
  private hydrated = false;

  constructor({
    db,
    helpers,
  }: {
    db: FilesystemDB;
    helpers: FilesystemVersionedHelpers<StorageAgentType, AgentVersion>;
  }) {
    this.db = db;
    this.helpers = helpers;
  }

  hydrate(): void {
    if (this.hydrated) return;
    this.loadFromDisk();
  }

  /** Refresh pointer state before a serialized mutation from another adapter instance. */
  reload(): void {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    this.hydrated = false;

    let raw: unknown;
    try {
      raw = this.db.readJsonFileStrict<unknown>(STATE_FILE);
    } catch {
      throw integrityError('invalid-json');
    }
    if (raw === null) {
      const emptyState: FilesystemAgentVersionLabelState = {
        schemaVersion: STATE_SCHEMA_VERSION,
        labels: [],
        entities: [],
        versions: [],
      };
      this.replaceState(emptyState);
      this.helpers.replaceRetainedState(emptyState.entities, emptyState.versions);
      this.hydrated = true;
      return;
    }

    const state = this.parseState(raw);
    this.replaceState(state);
    this.helpers.replaceRetainedState(state.entities, state.versions);
    this.hydrated = true;
  }

  get(entityId: string, label: string): VersionLabelPointer<'agent'> | null {
    this.hydrate();
    const pointer = this.pointers.get(this.pointerKey(entityId, label));
    return pointer ? structuredClone(pointer) : null;
  }

  list(input: ListVersionLabelsInput<'agent'>): ListVersionLabelsOutput<'agent'> {
    this.hydrate();
    const { page, perPage, responsePerPage, offset } = normalizeVersionLabelPagination(input);
    const labels = this.pointersForEntity(input.entityId);
    return {
      labels: labels.slice(offset, offset + perPage),
      total: labels.length,
      page,
      perPage: responsePerPage,
      hasMore: responsePerPage === false ? false : offset + perPage < labels.length,
    };
  }

  listByVersion(entityId: string, versionId: string): VersionLabelPointer<'agent'>[] {
    this.hydrate();
    return this.pointersForEntity(entityId).filter(pointer => pointer.versionId === versionId);
  }

  hasPointers(entityId: string): boolean {
    this.hydrate();
    return this.pointersForEntity(entityId).length > 0;
  }

  set(pointer: VersionLabelPointer<'agent'>): void {
    this.hydrate();
    this.pointers.set(this.pointerKey(pointer.entityId, pointer.label), structuredClone(pointer));
  }

  delete(entityId: string, label: string): boolean {
    this.hydrate();
    return this.pointers.delete(this.pointerKey(entityId, label));
  }

  deleteByEntity(entityId: string): number {
    this.hydrate();
    let deleted = 0;
    for (const pointer of this.pointersForEntity(entityId)) {
      if (this.pointers.delete(this.pointerKey(entityId, pointer.label))) deleted++;
    }
    this.dropRetainedEntity(entityId);
    return deleted;
  }

  replaceRetainedEntity(entity: StorageAgentType, versions: AgentVersion[]): void {
    this.hydrate();
    this.dropRetainedEntity(entity.id);
    this.retainedEntities.set(entity.id, structuredClone(entity));
    for (const version of versions) {
      if (version.agentId === entity.id) {
        this.retainedVersions.set(version.id, structuredClone(version));
      }
    }
  }

  dropRetainedEntity(entityId: string): void {
    this.retainedEntities.delete(entityId);
    for (const [versionId, version] of this.retainedVersions) {
      if (version.agentId === entityId) this.retainedVersions.delete(versionId);
    }
  }

  dropRetainedVersion(versionId: string): void {
    this.retainedVersions.delete(versionId);
  }

  async commit<T>(operation: () => Promise<T> | T): Promise<T> {
    this.hydrate();
    const previous = this.serialize();
    try {
      const result = await operation();
      const next = this.serialize();
      this.db.writeJsonFile(STATE_FILE, next);
      const nextEntityIds = new Set(next.entities.map(entity => entity.id));
      this.helpers.releaseRetainedState(
        previous.entities.map(entity => entity.id).filter(entityId => !nextEntityIds.has(entityId)),
      );
      this.helpers.markRetainedState(next.entities);
      return result;
    } catch (error) {
      this.replaceState(previous);
      this.helpers.replaceRetainedState(previous.entities, previous.versions);
      throw error;
    }
  }

  persist(): void {
    this.hydrate();
    this.db.writeJsonFile(STATE_FILE, this.serialize());
  }

  async clear(): Promise<void> {
    await this.commit(() => {
      this.pointers.clear();
      this.retainedEntities.clear();
      this.retainedVersions.clear();
    });
  }

  private pointerKey(entityId: string, label: string): string {
    return JSON.stringify(['agent', entityId, label]);
  }

  private pointersForEntity(entityId: string): VersionLabelPointer<'agent'>[] {
    return Array.from(this.pointers.values())
      .filter(pointer => pointer.entityId === entityId)
      .sort((left, right) => compareVersionLabelNames(left.label, right.label))
      .map(pointer => structuredClone(pointer));
  }

  private serialize(): FilesystemAgentVersionLabelState {
    return {
      schemaVersion: STATE_SCHEMA_VERSION,
      labels: Array.from(this.pointers.values())
        .sort((left, right) => {
          const entityOrder = left.entityId.localeCompare(right.entityId);
          return entityOrder === 0 ? compareVersionLabelNames(left.label, right.label) : entityOrder;
        })
        .map(pointer => structuredClone(pointer)),
      entities: Array.from(this.retainedEntities.values())
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(entity => structuredClone(entity)),
      versions: Array.from(this.retainedVersions.values())
        .sort((left, right) => {
          const entityOrder = left.agentId.localeCompare(right.agentId);
          return entityOrder === 0 ? left.versionNumber - right.versionNumber : entityOrder;
        })
        .map(version => structuredClone(version)),
    };
  }

  private replaceState(state: FilesystemAgentVersionLabelState): void {
    this.pointers.clear();
    this.retainedEntities.clear();
    this.retainedVersions.clear();
    for (const pointer of state.labels) {
      this.pointers.set(this.pointerKey(pointer.entityId, pointer.label), structuredClone(pointer));
    }
    for (const entity of state.entities) {
      this.retainedEntities.set(entity.id, structuredClone(entity));
    }
    for (const version of state.versions) {
      this.retainedVersions.set(version.id, structuredClone(version));
    }
  }

  private parseState(raw: unknown): FilesystemAgentVersionLabelState {
    if (
      !isRecord(raw) ||
      raw['schemaVersion'] !== STATE_SCHEMA_VERSION ||
      !Array.isArray(raw['labels']) ||
      !Array.isArray(raw['entities']) ||
      !Array.isArray(raw['versions'])
    ) {
      throw integrityError('invalid-shape');
    }

    const labels = raw['labels'].map((value, index) => this.parsePointer(value, index));
    const entities = raw['entities'].map((value, index) => this.parseEntity(value, index));
    const versions = raw['versions'].map((value, index) => this.parseVersion(value, index));

    const entityMap = new Map<string, StorageAgentType>();
    for (const entity of entities) {
      if (entityMap.has(entity.id)) throw integrityError('duplicate-entity');
      entityMap.set(entity.id, entity);
    }

    const versionMap = new Map<string, AgentVersion>();
    for (const version of versions) {
      if (versionMap.has(version.id)) throw integrityError('duplicate-version');
      versionMap.set(version.id, version);
    }

    const pointerKeys = new Set<string>();
    for (const pointer of labels) {
      const key = this.pointerKey(pointer.entityId, pointer.label);
      if (pointerKeys.has(key)) throw integrityError('duplicate-label');
      pointerKeys.add(key);

      const entity = entityMap.get(pointer.entityId);
      const version = versionMap.get(pointer.versionId);
      if (!entity || !version || version.agentId !== entity.id) {
        throw integrityError('dangling-label');
      }
    }

    for (const entity of entities) {
      if (!labels.some(pointer => pointer.entityId === entity.id)) {
        throw integrityError('unreferenced-entity');
      }
    }

    for (const version of versions) {
      if (!entityMap.has(version.agentId)) throw integrityError('unreferenced-version');
    }

    return { schemaVersion: STATE_SCHEMA_VERSION, labels, entities, versions };
  }

  private parsePointer(value: unknown, index: number): VersionLabelPointer<'agent'> {
    if (
      !isRecord(value) ||
      value['entityType'] !== 'agent' ||
      typeof value['entityId'] !== 'string' ||
      value['entityId'].length === 0 ||
      typeof value['label'] !== 'string' ||
      typeof value['versionId'] !== 'string' ||
      value['versionId'].length === 0 ||
      typeof value['revisionToken'] !== 'string' ||
      value['revisionToken'].length === 0 ||
      !isDate(value['createdAt']) ||
      !isDate(value['updatedAt'])
    ) {
      throw integrityError(`invalid-label-${index}`);
    }
    try {
      validateVersionLabel(value['label']);
    } catch {
      throw integrityError(`invalid-label-name-${index}`);
    }
    return value as unknown as VersionLabelPointer<'agent'>;
  }

  private parseEntity(value: unknown, index: number): StorageAgentType {
    if (
      !isRecord(value) ||
      typeof value['id'] !== 'string' ||
      value['id'].length === 0 ||
      !['draft', 'published', 'archived'].includes(value['status'] as string) ||
      (value['activeVersionId'] !== undefined && typeof value['activeVersionId'] !== 'string') ||
      !isDate(value['createdAt']) ||
      !isDate(value['updatedAt'])
    ) {
      throw integrityError(`invalid-entity-${index}`);
    }
    return value as unknown as StorageAgentType;
  }

  private parseVersion(value: unknown, index: number): AgentVersion {
    if (
      !isRecord(value) ||
      typeof value['id'] !== 'string' ||
      value['id'].length === 0 ||
      typeof value['agentId'] !== 'string' ||
      value['agentId'].length === 0 ||
      !Number.isSafeInteger(value['versionNumber']) ||
      (value['versionNumber'] as number) < 1 ||
      !isDate(value['createdAt'])
    ) {
      throw integrityError(`invalid-version-${index}`);
    }
    return value as unknown as AgentVersion;
  }
}
