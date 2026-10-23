import { createClient, type Client } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { open, readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { InputLimits } from '../config/limits.js';
import {
  canonicalJson,
  hashBytes,
  clarifySchema,
  type CaseRecord,
  type CapturedSource,
  type OperationContext,
  type SourceBundle,
} from '../domain/contracts.js';
import { IntakeError } from '../domain/errors.js';
import { ensurePrivateDirectory } from '../runtime/paths.js';

export type SavedSource =
  | Omit<Extract<CapturedSource, { kind: 'pdf' }>, 'bytes'>
  | Extract<CapturedSource, { kind: 'records' }>;

export class CaseRepository {
  readonly client: Client;
  readonly artifactRoot: string;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(readonly root: string) {
    this.artifactRoot = resolve(root, 'sources');
    this.client = createClient({ url: `file:${resolve(root, 'cases.db')}` });
  }
  async initialize() {
    await ensurePrivateDirectory(this.root);
    await ensurePrivateDirectory(this.artifactRoot);
    await this.client.executeMultiple(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS insurance_cases (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_threads (operator_id TEXT NOT NULL, thread_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES insurance_cases(id), PRIMARY KEY(operator_id,thread_id));
      CREATE TABLE IF NOT EXISTS insurance_sources (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES insurance_cases(id), hash TEXT NOT NULL, artifact TEXT NOT NULL UNIQUE, data TEXT NOT NULL, UNIQUE(case_id,hash));
      CREATE TABLE IF NOT EXISTS insurance_attempts (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS insurance_schema (version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO insurance_schema(version) VALUES(1);
      UPDATE insurance_attempts SET state='INTERRUPTED' WHERE state='STARTED';
    `);
  }
  async serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation, operation);
    this.tail = next.catch(() => undefined);
    return next;
  }
  async active(context: OperationContext): Promise<CaseRecord | null> {
    const result = await this.client.execute({
      sql: 'SELECT c.data FROM insurance_threads t JOIN insurance_cases c ON c.id=t.case_id WHERE t.operator_id=? AND t.thread_id=?',
      args: [context.operatorId, context.threadId],
    });
    return result.rows[0] ? (JSON.parse(String(result.rows[0].data)) as CaseRecord) : null;
  }
  async requireCase(context: OperationContext, id?: string): Promise<CaseRecord> {
    const current = await this.active(context);
    if (!current || (id && current.id !== id))
      throw new IntakeError(
        'CASE_CONTEXT',
        'This case is not selected in the current conversation.',
        'Select or create a case in this conversation first.',
      );
    return current;
  }
  async beginAttempt(context: OperationContext, providerId: string, limits: InputLimits): Promise<string> {
    const id = randomUUID();
    await this.client.execute({
      sql: 'INSERT INTO insurance_attempts(id,thread_id,state,data) VALUES(?,?,?,?)',
      args: [id, context.threadId, 'STARTED', JSON.stringify({ providerId, limits, at: new Date().toISOString() })],
    });
    return id;
  }
  async endAttempt(id: string, state: 'COMPLETED' | 'FAILED') {
    await this.client.execute({ sql: 'UPDATE insurance_attempts SET state=? WHERE id=?', args: [state, id] });
  }
  async saveBundle(
    context: OperationContext,
    bundle: SourceBundle,
    limits: InputLimits,
    providerId: string,
    newCase = false,
  ): Promise<CaseRecord> {
    return this.serial(async () => {
      const active = await this.active(context);
      if (active?.state === 'PROCESSING')
        throw new IntakeError(
          'CASE_PROCESSING',
          'Comparison is processing this immutable source revision.',
          'Wait for processing to finish before changing the case.',
          409,
        );
      const existing = newCase ? null : active;
      const id = existing?.id ?? randomUUID();
      const oldSources = existing ? await this.sources(context) : [];
      const hashes = new Set(oldSources.map(source => source.hash));
      const declaredRoles = new Map(oldSources.map(source => [source.hash, source.role]));
      const additions = bundle.sources.filter(source => {
        const role = declaredRoles.get(source.hash);
        if (role && role !== 'unknown' && source.role !== 'unknown' && role !== source.role)
          throw new IntakeError(
            'ROLE_CONFLICT',
            'Identical source bytes have conflicting document roles.',
            'Clarify the intended source roles before submitting another intake.',
          );
        declaredRoles.set(source.hash, source.role);
        if (hashes.has(source.hash)) return false;
        hashes.add(source.hash);
        return true;
      });
      const pdfPages =
        oldSources.reduce((sum, source) => sum + (source.kind === 'pdf' ? source.pages.length : 0), 0) +
        additions.reduce((sum, source) => sum + (source.kind === 'pdf' ? source.pages.length : 0), 0);
      if (oldSources.length + additions.length > limits.maxDocumentsPerCase)
        throw new IntakeError(
          'DOCUMENT_LIMIT',
          `At most ${limits.maxDocumentsPerCase} documents are allowed per case.`,
          'Start a new case or remove excess attachments before submitting.',
        );
      if (pdfPages > limits.pdf.maxPagesPerCase)
        throw new IntakeError(
          'CASE_PAGE_LIMIT',
          `A case may contain at most ${limits.pdf.maxPagesPerCase} physical PDF pages.`,
          'Start a separate case or change src/mastra/config/limits.ts and restart.',
        );
      const saved = [];
      for (const source of additions) {
        const artifact = `${source.sourceId}.${source.kind === 'pdf' ? 'pdf' : 'json'}`;
        const bytes = source.kind === 'pdf' ? source.bytes : Buffer.from(canonicalJson(source.records));
        const file = await open(join(this.artifactRoot, artifact), 'wx', 0o600);
        try {
          await file.writeFile(bytes);
          await file.sync();
        } finally {
          await file.close();
        }
        const { bytes: _bytes, ...descriptor } = source.kind === 'pdf' ? source : { ...source, bytes: undefined };
        saved.push({ source, artifact, descriptor });
      }
      if (saved.length) {
        const directory = await open(this.artifactRoot, 'r');
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
      // Files are durable first. A crash before this transaction leaves private, unreferenced evidence,
      // never a false successful source record. Recovery reports these files instead of deleting them.
      const record: CaseRecord = {
        id,
        revision: existing ? existing.revision + (additions.length ? 1 : 0) : 1,
        state: 'CREATED',
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        identity: existing?.identity ?? { policyNumber: null, insuredName: null, insuranceProduct: null },
        clarification: additions.length ? null : (existing?.clarification ?? null),
        sourceIds: [...(existing?.sourceIds ?? []), ...additions.map(source => source.sourceId)],
        limits: structuredClone(limits),
        providerId,
        ...(!additions.length && existing?.latestAnalysisId ? { latestAnalysisId: existing.latestAnalysisId } : {}),
      };
      const transaction = await this.client.transaction('write');
      try {
        const selected = await transaction.execute({
          sql: 'SELECT c.data FROM insurance_threads t JOIN insurance_cases c ON c.id=t.case_id WHERE t.operator_id=? AND t.thread_id=?',
          args: [context.operatorId, context.threadId],
        });
        if ((selected.rows[0] ? String(selected.rows[0].data) : null) !== (active ? JSON.stringify(active) : null))
          throw new IntakeError(
            'STALE_CASE',
            'The selected case changed during intake.',
            'Read status and submit again after current processing finishes.',
            409,
          );
        const write = await transaction.execute(
          existing
            ? {
                sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
                args: [JSON.stringify(record), id, JSON.stringify(existing)],
              }
            : { sql: 'INSERT INTO insurance_cases(id,data) VALUES(?,?)', args: [id, JSON.stringify(record)] },
        );
        if (write.rowsAffected !== 1)
          throw new IntakeError('STALE_CASE', 'The case changed during intake.', 'Read status and submit again.', 409);
        for (const { source, artifact, descriptor } of saved)
          await transaction.execute({
            sql: 'INSERT INTO insurance_sources(id,case_id,hash,artifact,data) VALUES(?,?,?,?,?)',
            args: [source.sourceId, id, source.hash, artifact, JSON.stringify(descriptor)],
          });
        await transaction.execute({
          sql: 'INSERT INTO insurance_threads(operator_id,thread_id,case_id) VALUES(?,?,?) ON CONFLICT(operator_id,thread_id) DO UPDATE SET case_id=excluded.case_id',
          args: [context.operatorId, context.threadId, id],
        });
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      } finally {
        transaction.close();
      }
      return record;
    });
  }
  async sources(context: OperationContext): Promise<SavedSource[]> {
    const record = await this.requireCase(context);
    const rows = await this.client.execute({
      sql: 'SELECT data FROM insurance_sources WHERE case_id=? ORDER BY rowid',
      args: [record.id],
    });
    return rows.rows.map(row => JSON.parse(String(row.data)) as SavedSource);
  }
  async evidence(
    context: OperationContext,
    sourceId: string,
    locator: { physicalPage?: number; recordId?: string; field?: string },
  ) {
    const record = await this.requireCase(context);
    const rows = await this.client.execute({
      sql: 'SELECT artifact,data FROM insurance_sources WHERE id=? AND case_id=?',
      args: [sourceId, record.id],
    });
    const row = rows.rows[0];
    if (!row)
      throw new IntakeError(
        'SOURCE_CONTEXT',
        'The source does not belong to the selected case.',
        'Use a source ID listed by case status.',
      );
    const source = JSON.parse(String(row.data)) as SavedSource;
    const path = join(this.artifactRoot, String(row.artifact));
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch {
      throw new IntakeError(
        'MISSING_ARTIFACT',
        'The saved source file is unavailable.',
        'Stop the server and restore the matching database and artifact backup.',
        409,
      );
    }
    if (hashBytes(bytes) !== source.hash)
      throw new IntakeError(
        'ARTIFACT_INTEGRITY',
        'The saved source file no longer matches its immutable checksum.',
        'Stop the server and restore the matching database and artifact backup.',
        409,
      );
    if (source.kind === 'pdf') {
      const page = source.pages.find(page => page.physicalPage === locator.physicalPage);
      if (!page)
        throw new IntakeError(
          'EVIDENCE_LOCATOR',
          'That physical page is not present in the captured PDF.',
          'Choose a physical page listed by case status.',
        );
      return { sourceId, version: source.version, hash: source.hash, kind: source.kind, ...page };
    }
    const item = source.evidence.find(item => item.recordId === locator.recordId && item.field === locator.field);
    if (!item)
      throw new IntakeError(
        'EVIDENCE_LOCATOR',
        'That record/field is not captured evidence.',
        'Choose a captured record and field locator.',
      );
    return { sourceId, version: source.version, hash: source.hash, kind: source.kind, ...item };
  }
  async clarify(context: OperationContext, input: unknown) {
    const request = clarifySchema.parse(input);
    return this.serial(async () => {
      const record = await this.requireCase(context, request.caseId);
      if (record.state === 'PROCESSING')
        throw new IntakeError(
          'CASE_PROCESSING',
          'The case is being compared.',
          'Wait for processing before clarifying this case.',
          409,
        );
      if (record.revision !== request.expectedRevision)
        throw new IntakeError(
          'STALE_CASE',
          'The case changed after it was read.',
          'Read case status, then clarify the current revision.',
          409,
        );
      if (
        ![request.referenceId, request.targetId, ...request.roles.map(role => role.sourceId)].every(id =>
          record.sourceIds.includes(id),
        )
      )
        throw new IntakeError(
          'SOURCE_CONTEXT',
          'The clarification refers to a source outside this case.',
          'Use source IDs from the current case status.',
        );
      if (
        !request.roles.some(role => role.sourceId === request.referenceId) ||
        !request.roles.some(role => role.sourceId === request.targetId)
      )
        throw new IntakeError(
          'MISSING_ROLE',
          'Reference and target both need an explicit document role.',
          'Identify each document role before proceeding.',
        );
      const updated = {
        ...record,
        state: 'CREATED' as const,
        revision: record.revision + 1,
        identity: request.identity,
        clarification: request,
      };
      const result = await this.client.execute({
        sql: 'UPDATE insurance_cases SET data=? WHERE id=? AND data=?',
        args: [JSON.stringify(updated), record.id, JSON.stringify(record)],
      });
      if (result.rowsAffected !== 1)
        throw new IntakeError(
          'STALE_CASE',
          'The case changed before the clarification was saved.',
          'Read case status and retry with the current revision.',
          409,
        );
      return updated;
    });
  }
  async recovery() {
    const known = await this.client.execute('SELECT artifact FROM insurance_sources');
    const names = new Set(known.rows.map(row => String(row.artifact)));
    const files = await readdir(this.artifactRoot);
    const unreferenced = files.filter(name => !names.has(name));
    const missing = [];
    for (const name of names) {
      try {
        await stat(join(this.artifactRoot, name));
      } catch {
        missing.push(name);
      }
    }
    const interrupted = await this.client.execute("SELECT id FROM insurance_attempts WHERE state='INTERRUPTED'");
    return {
      unreferencedSourceFiles: unreferenced.length,
      missingSourceFiles: missing.length,
      interruptedAttempts: interrupted.rows.length,
      message:
        unreferenced.length || missing.length || interrupted.rows.length
          ? 'An interrupted intake or missing source file requires inspection. No approval or processing success was inferred.'
          : 'Source records are available.',
    };
  }
  close() {
    this.client.close();
  }
}
