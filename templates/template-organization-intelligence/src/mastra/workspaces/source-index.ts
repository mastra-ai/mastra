import { createHash, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@libsql/client';
import { Workspace } from '@mastra/core/workspace';
import { LibSQLVector } from '@mastra/libsql';

import { TelemetryStore } from '../telemetry.js';
import type { CatalogSource } from './catalog.js';
import { sourceIdentity } from './catalog.js';
import type { DriveValidator } from './drive-source.js';
import { DRIVE_EXTRACTION_VERSION, driveValidator } from './drive-source.js';
import type { ExtractedRecord, LocatedChunk } from './extractors.js';
import { ExtractionError } from './extractors.js';
import type { LocalValidator } from './local-source.js';
import { extractLocalRecord, LOCAL_EXTRACTION_VERSION, localValidator } from './local-source.js';
import type { S3Validator } from './s3-source.js';
import { S3_EXTRACTION_VERSION, supportedS3Path } from './s3-source.js';
import type { SourceRuntime } from './sources.js';

export type EmbeddingFunction = (text: string) => Promise<number[]>;
export type SyncSourceResult = {
  sourceId: string;
  discovered: number;
  indexed: number;
  changed: number;
  unchanged: number;
  skipped: number;
  failed: number;
  removed: number;
  status: 'success' | 'partial' | 'failed';
  errors: string[];
};
export type SyncResult = {
  runId: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  sources: SyncSourceResult[];
  startedAt: string;
  finishedAt: string;
};
export type SourceStatus = {
  sourceId: string;
  ready: boolean;
  stale: boolean;
  lastSuccessAt: string | null;
  error: string | null;
  records: number;
};
type StoredChunk = LocatedChunk & { vector: number[] };
type RecordData = {
  id: string;
  sourceId: string;
  identity: string;
  relativePath: string;
  title: string;
  url?: string;
  fingerprint: string;
  indexedAt: string;
  chunks: StoredChunk[];
  warnings: string[];
  cache?: { validator: S3Validator | DriveValidator | LocalValidator; extractionVersion: string };
};
type ScanRecord = {
  key: string;
  relativePath: string;
  title: string;
  url?: string;
  cache?: { validator: S3Validator | DriveValidator | LocalValidator; extractionVersion: string };
  extract: () => Promise<ExtractedRecord>;
};
type Scan = { records: ScanRecord[]; complete: boolean; errors: string[] };
type Freshness = { identity: string; lastSuccessAt: string | null; error: string | null };
type Snapshot = { workspace: Workspace; generation: string; count: number; readers: number; retired: boolean };
const PREFIX = 'oi_generation_';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const identity = (source: CatalogSource) => source.provider + ':' + sourceIdentity(source);

/** One writer builds a complete candidate before atomically publishing the durable manifest. */
export class SourceIndex {
  readonly #client;
  readonly #vector;
  #records = new Map<string, RecordData>();
  #freshness = new Map<string, Freshness>();
  #snapshot?: Snapshot;
  #running?: Promise<SyncResult>;
  #retired = new Set<Snapshot>();
  #initialized = false;
  #closed = false;
  #lastRun?: SyncResult;
  readonly telemetry: TelemetryStore;

  constructor(
    private readonly options: {
      databaseUrl: string;
      sources: SourceRuntime;
      embed: EmbeddingFunction;
      embeddingModel?: string;
      now?: () => Date;
    },
  ) {
    this.#client = createClient({ url: options.databaseUrl });
    this.#vector = new LibSQLVector({ id: 'organization-intelligence-vectors', url: options.databaseUrl });
    this.telemetry = new TelemetryStore(options.databaseUrl, options.now);
  }
  #now(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
  #active(): CatalogSource[] {
    return this.options.sources.catalog.sources.filter(source => source.enabled);
  }

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    if (this.options.databaseUrl.startsWith('file:'))
      await mkdir(dirname(fileURLToPath(this.options.databaseUrl)), { recursive: true });
    await this.#client.batch(
      [
        'CREATE TABLE IF NOT EXISTS oi_committed_records (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS oi_source_state (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS oi_settings (id TEXT PRIMARY KEY, value TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS oi_runs (id TEXT PRIMARY KEY, finished_at TEXT NOT NULL, data TEXT NOT NULL)',
      ],
      'write',
    );
    const model = this.options.embeddingModel ?? 'text-embedding-3-small';
    const storedModel = (await this.#client.execute("SELECT value FROM oi_settings WHERE id='embedding-model'")).rows[0]
      ?.value;
    if (storedModel && storedModel !== model)
      throw new Error('Embedding model changed. Rebuild derived state before starting.');
    for (const row of (await this.#client.execute('SELECT data FROM oi_committed_records')).rows) {
      const record = JSON.parse(String(row.data)) as RecordData;
      this.#records.set(record.id, record);
    }
    for (const row of (await this.#client.execute('SELECT id,data FROM oi_source_state')).rows)
      this.#freshness.set(String(row.id), JSON.parse(String(row.data)) as Freshness);
    for (const source of this.#active()) {
      const stored = this.#freshness.get(source.id);
      if (stored && stored.identity !== identity(source))
        throw new Error('Source ' + source.id + ' changed root. Use a new ID or rebuild all derived state.');
    }
    const candidate = await this.#build(this.#records);
    await this.#client.batch(
      [
        { sql: 'INSERT OR REPLACE INTO oi_settings(id,value) VALUES(?,?)', args: ['embedding-model', model] },
        { sql: 'INSERT OR REPLACE INTO oi_settings(id,value) VALUES(?,?)', args: ['generation', candidate.generation] },
      ],
      'write',
    );
    this.#snapshot = candidate;
    this.#initialized = true;
    // An interrupted unpublished generation is disposable; committed records carry their own embeddings.
    for (const name of await this.#vector.listIndexes())
      if (name.startsWith(PREFIX) && name !== candidate.generation) await this.#vector.deleteIndex({ indexName: name });
  }

  sourceStatus(): SourceStatus[] {
    const now = Date.parse(this.#now());
    return this.#active().map(source => {
      const state = this.#freshness.get(source.id);
      const records = [...this.#records.values()].filter(
        record => record.sourceId === source.id && record.identity === identity(source),
      ).length;
      return {
        sourceId: source.id,
        ready: this.#initialized && Boolean(state?.lastSuccessAt),
        stale: Boolean(state?.error || (state?.lastSuccessAt && now - Date.parse(state.lastSuccessAt) > 600_000)),
        lastSuccessAt: state?.lastSuccessAt ?? null,
        error: state?.error ?? null,
        records,
      };
    });
  }
  lastRun(): SyncResult | undefined {
    return this.#lastRun;
  }

  async sync(): Promise<SyncResult> {
    if (!this.#initialized || this.#closed) throw new Error('Search index is not ready.');
    await this.telemetry.cleanup().catch(() => undefined);
    if (this.#running)
      return { runId: randomUUID(), status: 'skipped', sources: [], startedAt: this.#now(), finishedAt: this.#now() };
    const pending = this.#synchronize();
    this.#running = pending;
    try {
      return await pending;
    } finally {
      this.#running = undefined;
    }
  }

  async search(question: string, topK = 6) {
    if (!question.trim() || question.length > 4_000 || !Number.isInteger(topK) || topK < 1 || topK > 6)
      throw new Error('Use a non-empty question of at most 4000 characters and topK from 1 to 6.');
    if (!this.#initialized || this.#closed || !this.#snapshot) throw new Error('Search index is not ready.');
    const snapshot = this.#snapshot;
    const statuses = this.sourceStatus();
    if (!snapshot.count) return [];
    snapshot.readers++;
    try {
      const results = await snapshot.workspace.search(question, { mode: 'hybrid', topK });
      return results.map(result => {
        const metadata: Record<string, unknown> & { sourceStatus?: SourceStatus } = {
          ...result.metadata,
          sourceStatus: statuses.find(status => status.sourceId === result.metadata?.sourceId),
        };
        return { ...result, metadata };
      });
    } finally {
      snapshot.readers--;
      await this.#release(snapshot);
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    await this.#running;
    if (this.#snapshot?.readers || [...this.#retired].some(snapshot => snapshot.readers))
      throw new Error('Wait for active searches before closing.');
    this.#closed = true;
    await this.#vector.close();
    this.#client.close();
    await this.telemetry.close();
  }

  async #synchronize(): Promise<SyncResult> {
    const run: SyncResult = {
      runId: randomUUID(),
      status: 'success',
      sources: [],
      startedAt: this.#now(),
      finishedAt: '',
    };
    const candidateRecords = new Map(this.#records);
    const states = new Map(this.#freshness);
    let searchChanged = false;
    for (const source of this.#active()) {
      const result: SyncSourceResult = {
        sourceId: source.id,
        discovered: 0,
        indexed: 0,
        changed: 0,
        unchanged: 0,
        skipped: 0,
        failed: 0,
        removed: 0,
        status: 'success',
        errors: [],
      };
      run.sources.push(result);
      let scan: Scan;
      try {
        scan = await this.#scan(source);
      } catch {
        scan = { records: [], complete: false, errors: ['Source listing failed; check source access and retry.'] };
      }
      result.discovered = scan.records.length;
      result.errors.push(...scan.errors);
      if (scan.errors.length) result.status = 'partial';
      const seen = new Set<string>();
      for (const file of scan.records) {
        const id = hash(source.id + '\0' + file.key);
        seen.add(id);
        try {
          const old = candidateRecords.get(id);
          if (
            old?.cache &&
            file.cache &&
            old.cache.extractionVersion === file.cache.extractionVersion &&
            JSON.stringify(old.cache.validator) === JSON.stringify(file.cache.validator) &&
            old.chunks.length > 0 &&
            old.chunks.every(chunk => chunk.text && chunk.vector.length && chunk.vector.every(Number.isFinite))
          ) {
            if (old.warnings.length) {
              result.errors.push(...old.warnings);
              result.status = 'partial';
            }
            if (old.relativePath !== file.relativePath || old.title !== file.title || old.url !== file.url) {
              candidateRecords.set(id, { ...old, relativePath: file.relativePath, title: file.title, url: file.url });
              result.changed++;
              searchChanged = true;
            } else result.unchanged++;
            continue;
          }
          const extracted = await file.extract();
          if (extracted.warnings.length) {
            result.errors.push(...extracted.warnings);
            result.status = 'partial';
          }
          if (
            old?.fingerprint === extracted.fingerprint &&
            old.relativePath === file.relativePath &&
            old.title === file.title &&
            old.url === file.url
          ) {
            if (file.cache && JSON.stringify(old.cache) !== JSON.stringify(file.cache)) {
              candidateRecords.set(id, { ...old, cache: file.cache });
            } else if (!file.cache && old.cache) {
              const updated = { ...old };
              delete updated.cache;
              candidateRecords.set(id, updated);
            }
            result.unchanged++;
            continue;
          }
          const cached = new Map(old?.chunks.map(chunk => [chunk.text, chunk.vector]));
          const chunks: StoredChunk[] = [];
          for (const chunk of extracted.chunks) {
            const vector = cached.get(chunk.text) ?? (await this.options.embed(chunk.text));
            if (!vector.length || !vector.every(Number.isFinite)) throw new Error('Invalid embedding.');
            cached.set(chunk.text, vector);
            chunks.push({ ...chunk, vector });
          }
          candidateRecords.set(id, {
            id,
            sourceId: source.id,
            identity: identity(source),
            relativePath: file.relativePath,
            title: file.title,
            url: file.url,
            fingerprint: extracted.fingerprint,
            indexedAt: this.#now(),
            chunks,
            warnings: extracted.warnings,
            ...(file.cache ? { cache: file.cache } : {}),
          });
          if (old) result.changed++;
          else result.indexed++;
          searchChanged = true;
        } catch (error) {
          result.failed++;
          if (error instanceof ExtractionError) {
            result.skipped++;
            result.errors.push(error.message);
          } else result.errors.push('Record extraction or embedding failed; the last committed revision was retained.');
        }
      }
      if (scan.complete)
        for (const [id, record] of candidateRecords)
          if (record.sourceId === source.id && !seen.has(id)) {
            candidateRecords.delete(id);
            result.removed++;
            searchChanged = true;
          }
      const prior = states.get(source.id);
      const successful = scan.complete && result.failed === 0 && result.status === 'success';
      result.status = successful ? 'success' : result.discovered || prior?.lastSuccessAt ? 'partial' : 'failed';
      states.set(source.id, {
        identity: identity(source),
        lastSuccessAt: successful ? this.#now() : (prior?.lastSuccessAt ?? null),
        error: successful ? null : 'Source refresh is incomplete; cached evidence may be stale.',
      });
      if (!scan.complete) result.errors.push('Deletion reconciliation was suppressed for this incomplete scan.');
    }
    let snapshot: Snapshot | undefined;
    try {
      if (searchChanged) snapshot = await this.#build(candidateRecords);
      run.status = run.sources.every(result => result.status === 'success')
        ? 'success'
        : run.sources.every(result => result.status === 'failed')
          ? 'failed'
          : 'partial';
      run.finishedAt = this.#now();
      await this.#commit(candidateRecords, states, run, snapshot?.generation);
    } catch {
      if (snapshot) {
        snapshot.retired = true;
        await this.#release(snapshot);
      }
      for (const result of run.sources) {
        result.failed += result.indexed + result.changed;
        result.indexed = 0;
        result.changed = 0;
        result.removed = 0;
        result.status = 'failed';
        result.errors.push('Search publication failed; the last committed state was retained.');
      }
      run.status = 'failed';
      run.finishedAt = this.#now();
      const failures = new Map(this.#freshness);
      for (const source of this.#active())
        failures.set(source.id, {
          identity: identity(source),
          lastSuccessAt: failures.get(source.id)?.lastSuccessAt ?? null,
          error: 'Search publication failed; cached evidence may be stale.',
        });
      await this.#commit(this.#records, failures, run);
      this.#freshness = failures;
      this.#lastRun = run;
      return run;
    }
    this.#records = candidateRecords;
    this.#freshness = states;
    this.#lastRun = run;
    if (snapshot) {
      const old = this.#snapshot;
      this.#snapshot = snapshot;
      if (old) {
        old.retired = true;
        this.#retired.add(old);
        await this.#release(old);
      }
    }
    return run;
  }

  async #commit(
    records: Map<string, RecordData>,
    states: Map<string, Freshness>,
    run: SyncResult,
    generation?: string,
  ): Promise<void> {
    await this.#client.batch(
      [
        'DELETE FROM oi_committed_records',
        ...[...records.values()].map(record => ({
          sql: 'INSERT INTO oi_committed_records(id,data) VALUES(?,?)',
          args: [record.id, JSON.stringify(record)],
        })),
        ...[...states].map(([id, data]) => ({
          sql: 'INSERT OR REPLACE INTO oi_source_state(id,data) VALUES(?,?)',
          args: [id, JSON.stringify(data)],
        })),
        ...(generation
          ? [{ sql: 'INSERT OR REPLACE INTO oi_settings(id,value) VALUES(?,?)', args: ['generation', generation] }]
          : []),
        {
          sql: 'INSERT INTO oi_runs(id,finished_at,data) VALUES(?,?,?)',
          args: [run.runId, run.finishedAt, JSON.stringify(run)],
        },
        {
          sql: 'DELETE FROM oi_runs WHERE finished_at < ?',
          args: [new Date(Date.parse(run.finishedAt) - 7 * 86_400_000).toISOString()],
        },
      ],
      'write',
    );
  }

  async #build(records: Map<string, RecordData>): Promise<Snapshot> {
    const active = new Map(this.#active().map(source => [source.id, source]));
    const eligible = [...records.values()].filter(record => {
      const source = active.get(record.sourceId);
      return source !== undefined && identity(source) === record.identity;
    });
    const vectors = new Map(
      eligible.flatMap(record => record.chunks.map(chunk => [chunk.text, chunk.vector] as const)),
    );
    const generation = PREFIX + randomUUID().replaceAll('-', '');
    const workspace = new Workspace({
      id: generation,
      filesystem: this.options.sources.workspace.filesystem,
      bm25: true,
      vectorStore: this.#vector,
      embedder: async (text: string) => vectors.get(text) ?? this.options.embed(text),
      searchIndexName: generation,
      tools: { enabled: false },
    });
    const snapshot: Snapshot = { workspace, generation, count: eligible.length, readers: 0, retired: false };
    try {
      for (const record of eligible) {
        const source = active.get(record.sourceId)!;
        for (const [index, chunk] of record.chunks.entries())
          await workspace.index(record.id + ':' + index, chunk.text, {
            metadata: {
              recordId: record.id,
              sourceId: record.sourceId,
              path: source.mountPath + '/' + record.relativePath,
              title: record.title,
              url: record.url,
              revision: record.fingerprint,
              indexedAt: record.indexedAt,
              locator: chunk.locator,
              extractionWarnings: record.warnings,
            },
          });
      }
      return snapshot;
    } catch {
      snapshot.retired = true;
      await this.#release(snapshot);
      throw new Error('Candidate search generation failed.');
    }
  }
  async #release(snapshot: Snapshot): Promise<void> {
    if (!snapshot.retired || snapshot.readers) return;
    try {
      if ((await this.#vector.listIndexes()).includes(snapshot.generation))
        await this.#vector.deleteIndex({ indexName: snapshot.generation });
    } catch {
      /* An orphaned generation is retried during the next startup. */
    } finally {
      this.#retired.delete(snapshot);
    }
  }

  async #scan(source: CatalogSource): Promise<Scan> {
    if (source.provider === 'google-drive') {
      const reader = this.options.sources.driveReaders.get(source.id);
      if (!reader) throw new Error('Drive reader is not configured.');
      const listing = await reader.list();
      return {
        complete: listing.complete,
        errors: listing.errors,
        records: listing.files.map(file => {
          const validator = driveValidator(file);
          return {
            key: file.id,
            relativePath: file.path,
            title: file.name,
            url: file.url,
            ...(validator ? { cache: { validator, extractionVersion: DRIVE_EXTRACTION_VERSION } } : {}),
            extract: () => reader.extract(file),
          };
        }),
      };
    }
    if (source.provider === 's3') {
      const reader = this.options.sources.s3Readers.get(source.id);
      if (!reader) throw new Error('S3 reader is not configured.');
      const listing = await reader.list();
      const unsupported = listing.objects.filter(object => !supportedS3Path(object.relativePath));
      return {
        complete: listing.complete,
        errors: [...listing.errors, ...unsupported.map(object => `Unsupported S3 format: ${object.relativePath}.`)],
        records: listing.objects
          .filter(object => supportedS3Path(object.relativePath))
          .map(object => ({
            key: object.relativePath,
            relativePath: object.relativePath,
            title: object.title,
            ...(object.validator
              ? { cache: { validator: object.validator, extractionVersion: S3_EXTRACTION_VERSION } }
              : {}),
            extract: () => reader.extract(object),
          })),
      };
    }
    const filesystem = this.options.sources.workspace.filesystem;
    if (!filesystem) throw new Error('Source mounts unavailable.');
    const scan: Scan = { records: [], complete: true, errors: [] };
    let visited = 0;
    const walk = async (path: string, depth: number): Promise<void> => {
      if (depth > 32) throw new Error('Source nesting limit.');
      const entries = await filesystem.readdir(source.mountPath + (path ? '/' + path : ''));
      for (const entry of entries) {
        if (++visited > 1_000) throw new Error('Source enumeration limit.');
        if (entry.isSymlink || /[/\\\0]/.test(entry.name) || entry.name === '.' || entry.name === '..') {
          scan.complete = false;
          scan.errors.push('A symlink or unsafe path was skipped.');
          continue;
        }
        const relativePath = path ? path + '/' + entry.name : entry.name;
        if (entry.type === 'directory') await walk(relativePath, depth + 1);
        else {
          const metadata = await localValidator(source.root, relativePath).catch(() => undefined);
          scan.records.push({
            key: relativePath,
            relativePath,
            title: entry.name,
            ...(metadata ? { cache: { validator: metadata, extractionVersion: LOCAL_EXTRACTION_VERSION } } : {}),
            extract: async () =>
              extractLocalRecord(
                source.root,
                relativePath,
                metadata ?? (await localValidator(source.root, relativePath)),
              ),
          });
        }
      }
    };
    try {
      await walk('', 0);
    } catch {
      scan.complete = false;
      scan.errors.push('Local scan is incomplete; check access and the 1,000-entry/depth limits.');
    }
    return scan;
  }
}
