import { StorageDomain } from '../base';
import type { KnowledgePageStore } from './pages';

/** @experimental Knowledge APIs are experimental and may change without notice. */
export const KNOWLEDGE_STORAGE_CONTRACT_VERSION = 4 as const;
/** @experimental Knowledge APIs are experimental and may change without notice. */
export const KNOWLEDGE_STORAGE_SCHEMA_VERSION = 4 as const;

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeStorageCapabilities {
  contractVersion: typeof KNOWLEDGE_STORAGE_CONTRACT_VERSION;
  schemaVersion: 1 | typeof KNOWLEDGE_STORAGE_SCHEMA_VERSION;
  supportsSchemaInspection: boolean;
  supportsExplicitReset: boolean;
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export type KnowledgeSchemaInspection =
  | { status: 'compatible'; schemaVersion: typeof KNOWLEDGE_STORAGE_SCHEMA_VERSION }
  | { status: 'uninitialized'; schemaVersion: null }
  | { status: 'incompatible-reset-required'; schemaVersion: number | null; reason: string }
  | { status: 'unavailable'; schemaVersion: null; reason: string };

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeSchemaSnapshot {
  available: boolean;
  tableNames: readonly string[];
  schemaVersion?: number;
  reason?: string;
}

/**
 * Classifies an adapter-provided, read-only schema snapshot. Adapters own the physical probe; this
 * helper owns version negotiation and never mutates the snapshot or backing store.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */
export function inspectKnowledgeSchema(snapshot: KnowledgeSchemaSnapshot): KnowledgeSchemaInspection {
  if (!snapshot.available) {
    return {
      status: 'unavailable',
      schemaVersion: null,
      reason: snapshot.reason ?? 'The Knowledge storage adapter is unavailable.',
    };
  }
  if (snapshot.tableNames.length === 0) return { status: 'uninitialized', schemaVersion: null };
  if (snapshot.schemaVersion === KNOWLEDGE_STORAGE_SCHEMA_VERSION) {
    return { status: 'compatible', schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION };
  }
  return {
    status: 'incompatible-reset-required',
    schemaVersion: snapshot.schemaVersion ?? null,
    reason:
      snapshot.reason ??
      `Existing experimental Knowledge tables are not compatible with schema version ${KNOWLEDGE_STORAGE_SCHEMA_VERSION}.`,
  };
}

/** @experimental Knowledge APIs are experimental and may change without notice. */
export class KnowledgeConflictError extends Error {
  constructor(id: string) {
    super(`Knowledge record version conflict: ${id}`);
    this.name = 'KnowledgeConflictError';
  }
}

export class KnowledgeNotFoundError extends Error {
  constructor(type: string, id: string) {
    super(`Knowledge ${type} not found: ${id}`);
    this.name = 'KnowledgeNotFoundError';
  }
}

export class KnowledgeSchemaResetRequiredError extends Error {
  readonly inspection: Extract<KnowledgeSchemaInspection, { status: 'incompatible-reset-required' }>;

  constructor(inspection: Extract<KnowledgeSchemaInspection, { status: 'incompatible-reset-required' }>) {
    super(
      `Knowledge schema reset required: ${inspection.reason}. Existing Knowledge data is not migrated. To replace it, call \`await storage.stores?.knowledge?.dangerouslyReset()\`, which deletes every Knowledge row and nothing else.`,
    );
    this.name = 'KnowledgeSchemaResetRequiredError';
    this.inspection = inspection;
  }
}

export class KnowledgeUnsupportedCapabilityError extends Error {
  constructor(capability: string) {
    super(`This Knowledge storage adapter does not expose ${capability}.`);
    this.name = 'KnowledgeUnsupportedCapabilityError';
  }
}

export function assertKnowledgeSchemaCompatible(inspection: KnowledgeSchemaInspection): void {
  if (inspection.status === 'compatible' || inspection.status === 'uninitialized') return;
  if (inspection.status === 'incompatible-reset-required') {
    throw new KnowledgeSchemaResetRequiredError(inspection);
  }
  throw new Error(`Knowledge schema inspection unavailable: ${inspection.reason}`);
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastUlidTime = -1;
let lastUlidRandom = 0n;

export function parseKnowledgeWikilinks(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let contentStart = -1;

  for (let index = 0; index < text.length - 1; index++) {
    const pair = text.slice(index, index + 2);
    if (pair === '[[') {
      contentStart = index + 2;
      index++;
      continue;
    }
    if (pair !== ']]' || contentStart < 0) continue;

    const name = text.slice(contentStart, index).trim();
    const key = name.toLocaleLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
    contentStart = -1;
    index++;
  }

  return names;
}

function encodeCrockford(value: bigint, length: number): string {
  let encoded = '';
  for (let index = 0; index < length; index++) {
    encoded = CROCKFORD[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

export function createKnowledgeUlid(now = Date.now()): string {
  if (now <= lastUlidTime) {
    now = lastUlidTime;
    lastUlidRandom = (lastUlidRandom + 1n) & ((1n << 80n) - 1n);
  } else {
    lastUlidTime = now;
    lastUlidRandom = globalThis.crypto
      .getRandomValues(new Uint8Array(10))
      .reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
  }
  return `${encodeCrockford(BigInt(now), 10)}${encodeCrockford(lastUlidRandom, 16)}`;
}

export abstract class KnowledgeStorage extends StorageDomain implements KnowledgePageStore {
  readonly #storageIsolationKey: unknown;

  constructor(config: { storageIsolationKey?: unknown } = {}) {
    super({ component: 'STORAGE', name: 'KNOWLEDGE' });
    this.#storageIsolationKey = config.storageIsolationKey ?? this;
  }

  /** Identifies the physical Knowledge backend and namespace used by this domain. */
  getStorageIsolationKey(): unknown {
    return this.#storageIsolationKey;
  }

  getCapabilities(): KnowledgeStorageCapabilities {
    return {
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: 1,
      supportsSchemaInspection: false,
      supportsExplicitReset: false,
    };
  }

  async inspectSchema(): Promise<KnowledgeSchemaInspection> {
    return {
      status: 'unavailable',
      schemaVersion: null,
      reason: 'This Knowledge storage adapter does not support schema inspection.',
    };
  }

  async dangerouslyReset(): Promise<void> {
    throw new Error('This Knowledge storage adapter does not support an explicit Knowledge-only reset.');
  }

  // Schema-4 page store (see ./pages.ts). Adapters override every method; the defaults refuse, so an
  // adapter that hasn't moved to schema 4 fails loudly instead of returning empty results.
  materializeScope(
    _input: Parameters<KnowledgePageStore['materializeScope']>[0],
  ): ReturnType<KnowledgePageStore['materializeScope']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('materializeScope'));
  }
  getScopesByAddress(
    _input: Parameters<KnowledgePageStore['getScopesByAddress']>[0],
  ): ReturnType<KnowledgePageStore['getScopesByAddress']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getScopesByAddress'));
  }
  listChildScopes(
    _input: Parameters<KnowledgePageStore['listChildScopes']>[0],
  ): ReturnType<KnowledgePageStore['listChildScopes']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listChildScopes'));
  }
  getPage(_input: Parameters<KnowledgePageStore['getPage']>[0]): ReturnType<KnowledgePageStore['getPage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getPage'));
  }
  getPageByKey(
    _input: Parameters<KnowledgePageStore['getPageByKey']>[0],
  ): ReturnType<KnowledgePageStore['getPageByKey']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getPageByKey'));
  }
  findPagesByName(
    _input: Parameters<KnowledgePageStore['findPagesByName']>[0],
  ): ReturnType<KnowledgePageStore['findPagesByName']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('findPagesByName'));
  }
  listChildPages(
    _input: Parameters<KnowledgePageStore['listChildPages']>[0],
  ): ReturnType<KnowledgePageStore['listChildPages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listChildPages'));
  }
  listPages(_input: Parameters<KnowledgePageStore['listPages']>[0]): ReturnType<KnowledgePageStore['listPages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listPages'));
  }
  createPage(_input: Parameters<KnowledgePageStore['createPage']>[0]): ReturnType<KnowledgePageStore['createPage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('createPage'));
  }
  updatePage(_input: Parameters<KnowledgePageStore['updatePage']>[0]): ReturnType<KnowledgePageStore['updatePage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('updatePage'));
  }
  movePage(_input: Parameters<KnowledgePageStore['movePage']>[0]): ReturnType<KnowledgePageStore['movePage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('movePage'));
  }
  mergePages(_input: Parameters<KnowledgePageStore['mergePages']>[0]): ReturnType<KnowledgePageStore['mergePages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('mergePages'));
  }
  deletePage(_input: Parameters<KnowledgePageStore['deletePage']>[0]): ReturnType<KnowledgePageStore['deletePage']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('deletePage'));
  }
  getNote(_input: Parameters<KnowledgePageStore['getNote']>[0]): ReturnType<KnowledgePageStore['getNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('getNote'));
  }
  listNotes(_input: Parameters<KnowledgePageStore['listNotes']>[0]): ReturnType<KnowledgePageStore['listNotes']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listNotes'));
  }
  listNotesMentioning(
    _input: Parameters<KnowledgePageStore['listNotesMentioning']>[0],
  ): ReturnType<KnowledgePageStore['listNotesMentioning']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listNotesMentioning'));
  }
  addNote(_input: Parameters<KnowledgePageStore['addNote']>[0]): ReturnType<KnowledgePageStore['addNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('addNote'));
  }
  restampNote(_input: Parameters<KnowledgePageStore['restampNote']>[0]): ReturnType<KnowledgePageStore['restampNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('restampNote'));
  }
  removeNote(_input: Parameters<KnowledgePageStore['removeNote']>[0]): ReturnType<KnowledgePageStore['removeNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('removeNote'));
  }
  restoreNote(_input: Parameters<KnowledgePageStore['restoreNote']>[0]): ReturnType<KnowledgePageStore['restoreNote']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('restoreNote'));
  }
  searchPages(_input: Parameters<KnowledgePageStore['searchPages']>[0]): ReturnType<KnowledgePageStore['searchPages']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('searchPages'));
  }
  listPageActivity(
    _input: Parameters<KnowledgePageStore['listPageActivity']>[0],
  ): ReturnType<KnowledgePageStore['listPageActivity']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listPageActivity'));
  }
  addPinAudience(
    _input: Parameters<KnowledgePageStore['addPinAudience']>[0],
  ): ReturnType<KnowledgePageStore['addPinAudience']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('addPinAudience'));
  }
  removePinAudience(
    _input: Parameters<KnowledgePageStore['removePinAudience']>[0],
  ): ReturnType<KnowledgePageStore['removePinAudience']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('removePinAudience'));
  }
  listPins(_input: Parameters<KnowledgePageStore['listPins']>[0]): ReturnType<KnowledgePageStore['listPins']> {
    return Promise.reject(new KnowledgeUnsupportedCapabilityError('listPins'));
  }
}
