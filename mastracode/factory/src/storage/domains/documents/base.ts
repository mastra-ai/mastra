/**
 * Factory documents — the DB-side copy of a project's essential documents.
 *
 * The repository is the source of truth (`docs/factory/*.md` + manifest); this
 * domain holds the last snapshot synced from the default branch so the
 * Documents page, the kickoff index, and the `factory_read_document` tool can
 * read without touching a checkout. One row per `(org, project, kind)`, every
 * catalog kind present after a sync — a document the repo lacks is stored as
 * `status: 'missing'` so the gap is visible everywhere.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

import type { FactoryDocKind } from './catalog.js';
import { FACTORY_DOC_KINDS, isFactoryDocKind } from './catalog.js';
import type { FactoryDocsManifestStatus } from './manifest.js';

const DOCUMENTS = 'factory_documents';

export type FactoryDocumentStatus = 'present' | 'missing' | 'oversize';

export interface FactoryDocumentScope {
  orgId: string;
  factoryProjectId: string;
}

/** Index row: everything but the body. What the list endpoint and kickoff read. */
export interface FactoryDocumentIndexEntry {
  id: string;
  orgId: string;
  factoryProjectId: string;
  kind: FactoryDocKind;
  path: string;
  title: string | null;
  summary: string | null;
  contentHash: string | null;
  sizeBytes: number | null;
  status: FactoryDocumentStatus;
  sourceRef: string;
  sourceSha: string | null;
  manifestStatus: FactoryDocsManifestStatus;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FactoryDocumentRecord extends FactoryDocumentIndexEntry {
  content: string | null;
}

/** One kind's state at sync time. */
export interface FactoryDocumentSnapshot {
  kind: FactoryDocKind;
  path: string;
  status: FactoryDocumentStatus;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  contentHash?: string | null;
  sizeBytes?: number | null;
}

export interface ReplaceFactoryDocumentsInput extends FactoryDocumentScope {
  sourceRef: string;
  sourceSha: string | null;
  manifestStatus: FactoryDocsManifestStatus;
  documents: FactoryDocumentSnapshot[];
  syncedAt?: Date;
}

export interface FactoryDocumentsSyncState {
  sourceRef: string;
  sourceSha: string | null;
  manifestStatus: FactoryDocsManifestStatus;
  syncedAt: Date;
}

export const FACTORY_DOCUMENTS_SCHEMA: CollectionSchema = {
  name: DOCUMENTS,
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    kind: { type: 'text' },
    path: { type: 'text' },
    title: { type: 'text', nullable: true },
    summary: { type: 'text', nullable: true },
    content: { type: 'text', nullable: true },
    content_hash: { type: 'text', nullable: true },
    size_bytes: { type: 'integer', nullable: true },
    status: { type: 'text' },
    source_ref: { type: 'text' },
    source_sha: { type: 'text', nullable: true },
    manifest_status: { type: 'text' },
    synced_at: { type: 'timestamp' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'factory_documents_project_idx', columns: ['org_id', 'factory_project_id'] }],
  uniqueIndexes: [
    { name: 'factory_documents_project_kind_key', columns: ['org_id', 'factory_project_id', 'kind'] },
    { name: 'factory_documents_project_path_key', columns: ['org_id', 'factory_project_id', 'path'] },
  ],
};

interface FactoryDocumentDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  kind: string;
  path: string;
  title: string | null;
  summary: string | null;
  content: string | null;
  content_hash: string | null;
  size_bytes: number | null;
  status: FactoryDocumentStatus;
  source_ref: string;
  source_sha: string | null;
  manifest_status: FactoryDocsManifestStatus;
  synced_at: Date;
  created_at: Date;
  updated_at: Date;
}

function toIndexEntry(row: FactoryDocumentDbRow): FactoryDocumentIndexEntry {
  if (!isFactoryDocKind(row.kind)) throw new Error(`[FactoryDocumentsStorage] unknown kind in row: ${row.kind}`);
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    kind: row.kind,
    path: row.path,
    title: row.title,
    summary: row.summary,
    contentHash: row.content_hash,
    sizeBytes: row.size_bytes,
    status: row.status,
    sourceRef: row.source_ref,
    sourceSha: row.source_sha,
    manifestStatus: row.manifest_status,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRecord(row: FactoryDocumentDbRow): FactoryDocumentRecord {
  return { ...toIndexEntry(row), content: row.content };
}

const CATALOG_ORDER = new Map(FACTORY_DOC_KINDS.map((definition, index) => [definition.kind, index]));

function byCatalogOrder(a: FactoryDocumentIndexEntry, b: FactoryDocumentIndexEntry): number {
  return (CATALOG_ORDER.get(a.kind) ?? 0) - (CATALOG_ORDER.get(b.kind) ?? 0);
}

export class FactoryDocumentsStorage extends FactoryStorageDomain {
  constructor() {
    super('documents');
  }

  async init(): Promise<void> {
    await this.ensureCollections([FACTORY_DOCUMENTS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(DOCUMENTS, {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** Every synced kind for the project, catalog order, bodies omitted. */
  async list(scope: FactoryDocumentScope): Promise<FactoryDocumentIndexEntry[]> {
    const rows = await this.#db.findMany<FactoryDocumentDbRow>(DOCUMENTS, {
      org_id: scope.orgId,
      factory_project_id: scope.factoryProjectId,
    });
    return rows.map(toIndexEntry).sort(byCatalogOrder);
  }

  /** The project's last sync, or null when it has never been synced. */
  async syncState(scope: FactoryDocumentScope): Promise<FactoryDocumentsSyncState | null> {
    const rows = await this.list(scope);
    const latest = rows.reduce<FactoryDocumentIndexEntry | null>(
      (best, row) => (best === null || row.syncedAt > best.syncedAt ? row : best),
      null,
    );
    if (!latest) return null;
    return {
      sourceRef: latest.sourceRef,
      sourceSha: latest.sourceSha,
      manifestStatus: latest.manifestStatus,
      syncedAt: latest.syncedAt,
    };
  }

  async getByKind(scope: FactoryDocumentScope, kind: FactoryDocKind): Promise<FactoryDocumentRecord | null> {
    const row = await this.#db.findOne<FactoryDocumentDbRow>(DOCUMENTS, {
      org_id: scope.orgId,
      factory_project_id: scope.factoryProjectId,
      kind,
    });
    return row ? toRecord(row) : null;
  }

  async getByPath(scope: FactoryDocumentScope, path: string): Promise<FactoryDocumentRecord | null> {
    const row = await this.#db.findOne<FactoryDocumentDbRow>(DOCUMENTS, {
      org_id: scope.orgId,
      factory_project_id: scope.factoryProjectId,
      path,
    });
    return row ? toRecord(row) : null;
  }

  /**
   * Replace the project's snapshot with the given documents. Every kind in the
   * input is upserted; rows for kinds absent from the input are deleted, so a
   * kind removed from the catalog never lingers. Concurrent syncs (parallel
   * session starts for one project) race on first insert — the unique
   * violation falls through to an update, last writer wins.
   */
  async replaceSnapshot(input: ReplaceFactoryDocumentsInput): Promise<FactoryDocumentIndexEntry[]> {
    const now = input.syncedAt ?? new Date();
    const scopeWhere = { org_id: input.orgId, factory_project_id: input.factoryProjectId };
    const kinds = new Set<string>();
    const seenPaths = new Set<string>();
    for (const document of input.documents) {
      if (kinds.has(document.kind)) throw new Error(`[FactoryDocumentsStorage] duplicate kind: ${document.kind}`);
      if (seenPaths.has(document.path)) throw new Error(`[FactoryDocumentsStorage] duplicate path: ${document.path}`);
      kinds.add(document.kind);
      seenPaths.add(document.path);
    }

    // Paths can move between kinds across syncs; clearing the stale rows first
    // keeps the unique (project, path) index from rejecting the new mapping.
    const existing = await this.#db.findMany<FactoryDocumentDbRow>(DOCUMENTS, scopeWhere);
    for (const row of existing) {
      const incoming = input.documents.find(document => document.kind === row.kind);
      if (!incoming || incoming.path !== row.path) {
        await this.#db.deleteMany(DOCUMENTS, { ...scopeWhere, kind: row.kind });
      }
    }

    for (const document of input.documents) {
      const columns: Partial<FactoryDocumentDbRow> = {
        path: document.path,
        title: document.title ?? null,
        summary: document.summary ?? null,
        content: document.content ?? null,
        content_hash: document.contentHash ?? null,
        size_bytes: document.sizeBytes ?? null,
        status: document.status,
        source_ref: input.sourceRef,
        source_sha: input.sourceSha,
        manifest_status: input.manifestStatus,
        synced_at: now,
        updated_at: now,
      };
      const where = { ...scopeWhere, kind: document.kind };
      const updated = await this.#db.updateAtomic<FactoryDocumentDbRow>(DOCUMENTS, where, () => columns);
      if (updated) continue;
      try {
        await this.#db.insertOne<FactoryDocumentDbRow>(DOCUMENTS, { ...where, ...columns, created_at: now });
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
        const row = await this.#db.updateAtomic<FactoryDocumentDbRow>(DOCUMENTS, where, () => columns);
        if (!row) throw error;
      }
    }
    return this.list({ orgId: input.orgId, factoryProjectId: input.factoryProjectId });
  }
}
