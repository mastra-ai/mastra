import type { Client, InValue, ResultSet, Transaction } from '@libsql/client';
import {
  assertKnowledgeScopeWithinCeiling,
  canonicalizeKnowledgeScope,
  createKnowledgeUlid,
  isKnowledgeScopeVisible,
  KNOWLEDGE_ACTIVITY_SCHEMA,
  KNOWLEDGE_CURSORS_SCHEMA,
  KNOWLEDGE_FACTS_SCHEMA,
  KNOWLEDGE_MENTIONS_SCHEMA,
  KNOWLEDGE_RECORDS_SCHEMA,
  KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
  knowledgeScopeKey,
  knowledgeSemanticDocumentId,
  knowledgeSemanticIdempotencyKey,
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  KnowledgeStorage,
  parseKnowledgeWikilinks,
  TABLE_KNOWLEDGE_ACTIVITY,
  TABLE_KNOWLEDGE_CURSORS,
  TABLE_KNOWLEDGE_FACTS,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
} from '@mastra/core/storage';
import type {
  AppendKnowledgeFactInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeEntityInput,
  CreateKnowledgePageInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgePage,
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  ListKnowledgeFactsInput,
  ListKnowledgeFactsOutput,
  ListKnowledgeRecordsInput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  UpdateKnowledgeEntityInput,
  UpdateKnowledgePageInput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { withClientWriteLock } from '../../db/write-lock';

interface Executor {
  execute(statement: string | { sql: string; args?: InValue[] }): Promise<ResultSet>;
}

const visibleSql = `(scopeKey = ? OR ? LIKE scopeKey || char(31) || '%')`;

function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  if (value instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(value)) as T;
  if (value instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(value)) as T;
  return value as T;
}

function toDate(value: unknown): Date {
  return new Date(String(value));
}

function optionalDate(value: unknown): Date | undefined {
  return value == null ? undefined : toDate(value);
}

function canonicalName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function parseEntity(row: Record<string, unknown>): KnowledgeEntity {
  return {
    id: String(row.id),
    type: 'entity',
    name: String(row.name),
    kind: String(row.kind),
    scope: parseJson(row.scopeJson ?? row.scope),
    version: Number(row.version),
    mergedInto: row.mergedInto == null ? undefined : String(row.mergedInto),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function parsePage(row: Record<string, unknown>): KnowledgePage {
  return {
    id: String(row.id),
    type: 'page',
    name: String(row.name),
    body: String(row.body ?? ''),
    scope: parseJson(row.scopeJson ?? row.scope),
    version: Number(row.version),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function parseFact(row: Record<string, unknown>): KnowledgeFact {
  return {
    id: String(row.id),
    parentEntityId: String(row.parentEntityId),
    text: String(row.text),
    scope: parseJson(row.scopeJson ?? row.scope),
    sourceThreadId: String(row.sourceThreadId),
    capturedAt: toDate(row.capturedAt),
    when: optionalDate(row.when),
    maxScope: row.maxScope == null ? undefined : (String(row.maxScope) as KnowledgeFact['maxScope']),
    deletedAt: optionalDate(row.deletedAt),
    deletedBy: row.deletedBy == null ? undefined : String(row.deletedBy),
  };
}

function parseOutbox(row: Record<string, unknown>): KnowledgeSemanticOutboxEntry {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotencyKey),
    documentId: String(row.documentId),
    documentType: String(row.documentType) as KnowledgeSemanticDocumentType,
    operation: String(row.operation) as KnowledgeSemanticOperation,
    scope: parseJson(row.scopeJson ?? row.scope),
    status: String(row.status) as KnowledgeSemanticOutboxEntry['status'],
    attempts: Number(row.attempts),
    availableAt: toDate(row.availableAt),
    claimedAt: optionalDate(row.claimedAt),
    claimedBy: row.claimedBy == null ? undefined : String(row.claimedBy),
    createdAt: toDate(row.createdAt),
    completedAt: optionalDate(row.completedAt),
  };
}

export class KnowledgeLibSQL extends KnowledgeStorage {
  readonly #client: Client;
  readonly #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    this.#client = resolveClient(config);
    this.#db = new LibSQLDB({
      client: this.#client,
      maxRetries: config.maxRetries,
      initialBackoffMs: config.initialBackoffMs,
    });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_RECORDS, schema: KNOWLEDGE_RECORDS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_FACTS, schema: KNOWLEDGE_FACTS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_MENTIONS,
      schema: KNOWLEDGE_MENTIONS_SCHEMA,
      compositePrimaryKey: ['sourceType', 'sourceId', 'recordId'],
    });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_CURSORS,
      schema: KNOWLEDGE_CURSORS_SCHEMA,
      compositePrimaryKey: ['sourceThreadId', 'agent'],
    });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_ACTIVITY, schema: KNOWLEDGE_ACTIVITY_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
      schema: KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
    });
    await this.#client.batch(
      [
        {
          sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_records_identity ON "${TABLE_KNOWLEDGE_RECORDS}" (type, scopeKey, canonicalName)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_records_scope ON "${TABLE_KNOWLEDGE_RECORDS}" (scopeKey, type)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_facts_parent_latest ON "${TABLE_KNOWLEDGE_FACTS}" (parentEntityId, id DESC)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_facts_thread_latest ON "${TABLE_KNOWLEDGE_FACTS}" (sourceThreadId, id DESC)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_mentions_record ON "${TABLE_KNOWLEDGE_MENTIONS}" (recordId, sourceType, sourceId)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_activity_latest ON "${TABLE_KNOWLEDGE_ACTIVITY}" (id DESC)`,
          args: [],
        },
        {
          sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_outbox_idempotency ON "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (idempotencyKey)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_outbox_claim ON "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (status, availableAt, createdAt)`,
          args: [],
        },
      ],
      'write',
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#transaction(async tx => {
      for (const table of [
        TABLE_KNOWLEDGE_MENTIONS,
        TABLE_KNOWLEDGE_FACTS,
        TABLE_KNOWLEDGE_RECORDS,
        TABLE_KNOWLEDGE_CURSORS,
        TABLE_KNOWLEDGE_ACTIVITY,
        TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
      ]) {
        await tx.execute(`DELETE FROM "${table}"`);
      }
    });
  }

  async createEntity(input: CreateKnowledgeEntityInput): Promise<KnowledgeEntity> {
    if (input.kind === 'page') throw new Error('Entity kind "page" is reserved for knowledge pages');
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#transaction(async tx => {
      const existing = await this.#getEntityByName(tx, input.name, scope);
      if (existing) {
        const terminal = (await this.#resolveTerminalEntity(tx, existing.id))!;
        if (!isKnowledgeScopeVisible(terminal.scope, scope)) {
          throw new Error(`Merged knowledge entity is not visible from scope: ${input.name}`);
        }
        return terminal;
      }
      const now = new Date();
      const entity: KnowledgeEntity = {
        id: input.id ?? crypto.randomUUID(),
        type: 'entity',
        name: input.name.trim(),
        kind: input.kind,
        scope,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,type,name,canonicalName,kind,body,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,NULL,jsonb(?),?,?,NULL,?,?)`,
        args: [
          entity.id,
          'entity',
          entity.name,
          canonicalName(entity.name),
          entity.kind,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          entity.version,
          now.toISOString(),
          now.toISOString(),
        ],
      });
      await this.#activity(tx, 'entity-created', 'entity', entity.id, scope);
      await this.#outbox(tx, 'entity', entity.id, 'upsert', entity.version, scope);
      return entity;
    });
  }

  async getEntity(id: string): Promise<KnowledgeEntity | null> {
    return this.#getEntity(this.#client, id);
  }

  async getEntityByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeEntity | null> {
    return this.#getEntityByName(this.#client, input.name, canonicalizeKnowledgeScope(input.scope));
  }

  async resolveEntity(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeEntity | null> {
    return this.#resolveEntity(this.#client, input.name, canonicalizeKnowledgeScope(input.scope));
  }

  async listEntities(input: ListKnowledgeRecordsInput): Promise<KnowledgeEntity[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const clauses = [`type = 'entity'`, 'mergedInto IS NULL', visibleSql];
    const args: InValue[] = [key, key];
    if (input.namePrefix) {
      clauses.push('canonicalName LIKE ?');
      args.push(`${canonicalName(input.namePrefix)}%`);
    }
    if (input.kind) {
      clauses.push('kind = ?');
      args.push(input.kind);
    }
    args.push(input.limit ?? 100);
    const result = await this.#client.execute({
      sql: `SELECT *, json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE ${clauses.join(' AND ')} ORDER BY updatedAt DESC, name ASC LIMIT ?`,
      args,
    });
    return result.rows.map(parseEntity);
  }

  async updateEntity(input: UpdateKnowledgeEntityInput): Promise<KnowledgeEntity> {
    if (input.kind === 'page') throw new Error('Entity kind "page" is reserved for knowledge pages');
    return this.#transaction(async tx => {
      const existing = await this.#getEntity(tx, input.id);
      if (!existing) throw new KnowledgeNotFoundError('entity', input.id);
      if (existing.mergedInto) throw new Error(`Cannot update merged knowledge entity: ${input.id}`);
      const scope = canonicalizeKnowledgeScope(input.scope ?? existing.scope);
      const name = (input.name ?? existing.name).trim();
      const now = new Date();
      const result = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET name=?,canonicalName=?,kind=?,scope=jsonb(?),scopeKey=?,version=version+1,updatedAt=? WHERE id=? AND type='entity' AND version=?`,
        args: [
          name,
          canonicalName(name),
          input.kind ?? existing.kind,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          now.toISOString(),
          input.id,
          input.version,
        ],
      });
      if (result.rowsAffected === 0) throw new KnowledgeConflictError(input.id);
      await this.#activity(tx, 'entity-updated', 'entity', input.id, scope);
      if (knowledgeScopeKey(existing.scope) !== knowledgeScopeKey(scope)) {
        await this.#outbox(tx, 'entity', input.id, 'delete', createKnowledgeUlid(), existing.scope);
        const facts = await tx.execute({
          sql: `SELECT id,json(scope) AS scopeJson,deletedAt FROM "${TABLE_KNOWLEDGE_FACTS}" WHERE parentEntityId=?`,
          args: [input.id],
        });
        for (const row of facts.rows) {
          const factScope = parseJson<KnowledgeScope>(row.scopeJson);
          await this.#outbox(tx, 'fact', String(row.id), 'delete', createKnowledgeUlid(), factScope);
          if (row.deletedAt == null) {
            await this.#outbox(tx, 'fact', String(row.id), 'upsert', createKnowledgeUlid(), factScope);
          }
        }
      }
      await this.#outbox(tx, 'entity', input.id, 'upsert', input.version + 1, scope);
      return {
        ...existing,
        name,
        kind: input.kind ?? existing.kind,
        scope,
        version: input.version + 1,
        updatedAt: now,
      };
    });
  }

  async mergeEntities(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeEntity> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge entity into itself');
    return this.#transaction(async tx => {
      const source = await this.#getEntity(tx, input.sourceId);
      if (!source) throw new KnowledgeNotFoundError('entity', input.sourceId);
      const target = await this.#resolveTerminalEntity(tx, input.targetId);
      if (!target) throw new KnowledgeNotFoundError('entity', input.targetId);
      if (target.id === source.id) throw new Error('Cannot create a knowledge merge cycle');
      if (!isKnowledgeScopeVisible(target.scope, source.scope)) {
        throw new Error('Cannot merge a knowledge entity into a target that is narrower than its source scope');
      }
      const affected = await tx.execute({
        sql: `SELECT DISTINCT m.sourceType,m.sourceId,json(COALESCE(f.scope,r.scope)) AS scopeJson,CASE WHEN f.deletedAt IS NULL THEN 0 ELSE 1 END AS deleted FROM "${TABLE_KNOWLEDGE_MENTIONS}" m LEFT JOIN "${TABLE_KNOWLEDGE_FACTS}" f ON m.sourceType='fact' AND f.id=m.sourceId LEFT JOIN "${TABLE_KNOWLEDGE_RECORDS}" r ON m.sourceType='page' AND r.id=m.sourceId WHERE m.recordId=?`,
        args: [source.id],
      });
      const movedFacts = await tx.execute({
        sql: `SELECT id,json(scope) AS scopeJson,deletedAt FROM "${TABLE_KNOWLEDGE_FACTS}" WHERE parentEntityId=?`,
        args: [source.id],
      });
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET mergedInto=?,version=version+1,updatedAt=? WHERE id=? AND type='entity' AND version=? AND mergedInto IS NULL`,
        args: [target.id, new Date().toISOString(), source.id, input.sourceVersion],
      });
      if (updated.rowsAffected === 0) throw new KnowledgeConflictError(source.id);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_FACTS}" SET parentEntityId=? WHERE parentEntityId=?`,
        args: [target.id, source.id],
      });
      await tx.execute({
        sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=? AND EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_MENTIONS}" target WHERE target.sourceType="${TABLE_KNOWLEDGE_MENTIONS}".sourceType AND target.sourceId="${TABLE_KNOWLEDGE_MENTIONS}".sourceId AND target.recordId=?)`,
        args: [source.id, target.id],
      });
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_MENTIONS}" SET recordId=? WHERE recordId=?`,
        args: [target.id, source.id],
      });
      for (const row of movedFacts.rows)
        await this.#outbox(
          tx,
          'fact',
          String(row.id),
          row.deletedAt == null ? 'upsert' : 'delete',
          createKnowledgeUlid(),
          parseJson(row.scopeJson),
        );
      for (const row of affected.rows)
        await this.#outbox(
          tx,
          String(row.sourceType) as 'fact' | 'page',
          String(row.sourceId),
          Number(row.deleted) ? 'delete' : 'upsert',
          createKnowledgeUlid(),
          parseJson<KnowledgeScope>(row.scopeJson),
        );
      await this.#activity(tx, 'entity-merged', 'entity', source.id, source.scope);
      await this.#outbox(tx, 'entity', source.id, 'delete', input.sourceVersion + 1, source.scope);
      await this.#outbox(tx, 'entity', target.id, 'upsert', createKnowledgeUlid(), target.scope);
      return target;
    });
  }

  async createPage(input: CreateKnowledgePageInput): Promise<KnowledgePage> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#transaction(async tx => {
      const existing = await this.#getPageByExactName(tx, input.name, scope);
      if (existing) throw new Error(`Knowledge page already exists in scope: ${input.name}`);
      const now = new Date();
      const page: KnowledgePage = {
        id: input.id ?? crypto.randomUUID(),
        type: 'page',
        name: input.name.trim(),
        body: input.body,
        scope,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,type,name,canonicalName,kind,body,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,NULL,?,jsonb(?),?,?,NULL,?,?)`,
        args: [
          page.id,
          'page',
          page.name,
          canonicalName(page.name),
          page.body,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          page.version,
          now.toISOString(),
          now.toISOString(),
        ],
      });
      await this.#replaceMentions(tx, 'page', page.id, page.body, scope, scope);
      await this.#activity(tx, 'page-created', 'page', page.id, scope);
      await this.#outbox(tx, 'page', page.id, 'upsert', page.version, scope);
      return page;
    });
  }

  async getPage(id: string): Promise<KnowledgePage | null> {
    const result = await this.#client.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=? AND type='page'`,
      args: [id],
    });
    return result.rows[0] ? parsePage(result.rows[0]) : null;
  }

  async getPageByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgePage | null> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    for (let length = scope.length; length > 0; length--) {
      const page = await this.#getPageByExactName(this.#client, input.name, scope.slice(0, length));
      if (page) return page;
    }
    return null;
  }

  async listPages(input: Omit<ListKnowledgeRecordsInput, 'kind'>): Promise<KnowledgePage[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const clauses = [`type='page'`, visibleSql];
    const args: InValue[] = [key, key];
    if (input.namePrefix) {
      clauses.push('canonicalName LIKE ?');
      args.push(`${canonicalName(input.namePrefix)}%`);
    }
    args.push(input.limit ?? 100);
    const result = await this.#client.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE ${clauses.join(' AND ')} ORDER BY updatedAt DESC,name ASC LIMIT ?`,
      args,
    });
    return result.rows.map(parsePage);
  }

  async updatePage(input: UpdateKnowledgePageInput): Promise<KnowledgePage> {
    return this.#transaction(async tx => {
      const result = await tx.execute({
        sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=? AND type='page'`,
        args: [input.id],
      });
      if (!result.rows[0]) throw new KnowledgeNotFoundError('page', input.id);
      const existing = parsePage(result.rows[0]);
      const scope = canonicalizeKnowledgeScope(input.scope ?? existing.scope);
      const name = (input.name ?? existing.name).trim();
      const body = input.body ?? existing.body;
      const now = new Date();
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET name=?,canonicalName=?,body=?,scope=jsonb(?),scopeKey=?,version=version+1,updatedAt=? WHERE id=? AND type='page' AND version=?`,
        args: [
          name,
          canonicalName(name),
          body,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          now.toISOString(),
          input.id,
          input.version,
        ],
      });
      if (updated.rowsAffected === 0) throw new KnowledgeConflictError(input.id);
      if (input.body !== undefined || input.scope !== undefined)
        await this.#replaceMentions(
          tx,
          'page',
          input.id,
          body,
          canonicalizeKnowledgeScope(input.resolutionScope ?? scope),
          scope,
        );
      await this.#activity(tx, 'page-updated', 'page', input.id, scope);
      if (knowledgeScopeKey(existing.scope) !== knowledgeScopeKey(scope)) {
        await this.#outbox(tx, 'page', input.id, 'delete', createKnowledgeUlid(), existing.scope);
      }
      await this.#outbox(tx, 'page', input.id, 'upsert', input.version + 1, scope);
      return { ...existing, name, body, scope, version: input.version + 1, updatedAt: now };
    });
  }

  async appendFact(input: AppendKnowledgeFactInput): Promise<KnowledgeFact> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const resolutionScope = canonicalizeKnowledgeScope(input.resolutionScope);
    const defaultScope = canonicalizeKnowledgeScope(input.defaultScope);
    assertKnowledgeScopeWithinCeiling(scope, input.maxScope);
    return this.#transaction(async tx => {
      const parent = await this.#resolveTerminalEntity(tx, input.parentEntityId);
      if (!parent) throw new KnowledgeNotFoundError('entity', input.parentEntityId);
      const fact: KnowledgeFact = {
        id: input.id ?? createKnowledgeUlid(),
        parentEntityId: parent.id,
        text: input.text,
        scope,
        sourceThreadId: input.sourceThreadId,
        capturedAt: new Date(),
        when: input.when ? new Date(input.when) : undefined,
        maxScope: input.maxScope,
      };
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_FACTS}" (id,parentEntityId,text,scope,scopeKey,sourceThreadId,capturedAt,"when",maxScope,deletedAt,deletedBy) VALUES (?,?,?,jsonb(?),?,?,?,?,?,NULL,NULL)`,
        args: [
          fact.id,
          fact.parentEntityId,
          fact.text,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          fact.sourceThreadId,
          fact.capturedAt.toISOString(),
          fact.when?.toISOString() ?? null,
          fact.maxScope ?? null,
        ],
      });
      await this.#replaceMentions(tx, 'fact', fact.id, fact.text, resolutionScope, defaultScope);
      await this.#activity(tx, 'fact-created', 'fact', fact.id, scope, fact.sourceThreadId);
      await this.#outbox(tx, 'fact', fact.id, 'upsert', fact.id, scope);
      return fact;
    });
  }

  async getFact(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeFact | null> {
    const result = await this.#client.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_FACTS}" WHERE id=?${input.includeDeleted ? '' : ' AND deletedAt IS NULL'}`,
      args: [input.id],
    });
    return result.rows[0] ? parseFact(result.rows[0]) : null;
  }

  async factsAbout(input: ListKnowledgeFactsInput): Promise<ListKnowledgeFactsOutput> {
    return this.#listFacts(input, false);
  }
  async factsTouching(input: ListKnowledgeFactsInput): Promise<ListKnowledgeFactsOutput> {
    return this.#listFacts(input, true);
  }

  async removeFact(input: { id: string; deletedBy: string }): Promise<KnowledgeFact> {
    return this.#transaction(async tx => {
      const fact = await this.#getFact(tx, input.id, true);
      if (!fact) throw new KnowledgeNotFoundError('fact', input.id);
      if (fact.deletedAt) return fact;
      const deletedAt = new Date();
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_FACTS}" SET deletedAt=?,deletedBy=? WHERE id=? AND deletedAt IS NULL`,
        args: [deletedAt.toISOString(), input.deletedBy, input.id],
      });
      await this.#activity(tx, 'fact-deleted', 'fact', input.id, fact.scope, fact.sourceThreadId);
      await this.#outbox(tx, 'fact', input.id, 'delete', deletedAt.toISOString(), fact.scope);
      return { ...fact, deletedAt, deletedBy: input.deletedBy };
    });
  }

  async restoreFact(input: { id: string }): Promise<KnowledgeFact> {
    return this.#transaction(async tx => {
      const fact = await this.#getFact(tx, input.id, true);
      if (!fact) throw new KnowledgeNotFoundError('fact', input.id);
      if (!fact.deletedAt) return fact;
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_FACTS}" SET deletedAt=NULL,deletedBy=NULL WHERE id=?`,
        args: [input.id],
      });
      await this.#activity(tx, 'fact-restored', 'fact', input.id, fact.scope, fact.sourceThreadId);
      await this.#outbox(tx, 'fact', input.id, 'upsert', createKnowledgeUlid(), fact.scope);
      return { ...fact, deletedAt: undefined, deletedBy: undefined };
    });
  }

  async rescopeFact(input: { id: string; scope: KnowledgeScope }): Promise<KnowledgeFact> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#transaction(async tx => {
      const fact = await this.#getFact(tx, input.id, true);
      if (!fact) throw new KnowledgeNotFoundError('fact', input.id);
      assertKnowledgeScopeWithinCeiling(scope, fact.maxScope);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_FACTS}" SET scope=jsonb(?),scopeKey=? WHERE id=?`,
        args: [JSON.stringify(scope), knowledgeScopeKey(scope), input.id],
      });
      await this.#activity(tx, 'fact-rescoped', 'fact', input.id, scope, fact.sourceThreadId);
      if (knowledgeScopeKey(fact.scope) !== knowledgeScopeKey(scope))
        await this.#outbox(tx, 'fact', input.id, 'delete', createKnowledgeUlid(), fact.scope);
      if (!fact.deletedAt) await this.#outbox(tx, 'fact', input.id, 'upsert', createKnowledgeUlid(), scope);
      return { ...fact, scope };
    });
  }

  async raiseCeiling(input: { id: string; maxScope?: KnowledgeFact['maxScope'] }): Promise<KnowledgeFact> {
    return this.#transaction(async tx => {
      const fact = await this.#getFact(tx, input.id, true);
      if (!fact) throw new KnowledgeNotFoundError('fact', input.id);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_FACTS}" SET maxScope=? WHERE id=?`,
        args: [input.maxScope ?? null, input.id],
      });
      return { ...fact, maxScope: input.maxScope };
    });
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const query = `%${input.query.trim().toLocaleLowerCase()}%`;
    if (query === '%%') return [];
    const records = await this.#client.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE mergedInto IS NULL AND ${visibleSql} AND (canonicalName LIKE ? OR lower(COALESCE(kind,'')) LIKE ? OR lower(COALESCE(body,'')) LIKE ?) ORDER BY updatedAt DESC LIMIT ?`,
      args: [key, key, query, query, query, input.limit ?? 20],
    });
    const results: SearchKnowledgeResult[] = records.rows.map(row => ({
      type: String(row.type) as 'entity' | 'page',
      id: String(row.id),
      recordId: String(row.id),
      name: String(row.name),
      text: row.type === 'page' ? String(row.body ?? '') : String(row.name),
      scope: parseJson<KnowledgeScope>(row.scopeJson),
    }));
    if (results.length < (input.limit ?? 20)) {
      const facts = await this.#client.execute({
        sql: `SELECT f.*,json(f.scope) AS scopeJson,r.name FROM "${TABLE_KNOWLEDGE_FACTS}" f JOIN "${TABLE_KNOWLEDGE_RECORDS}" r ON r.id=f.parentEntityId AND r.type='entity' AND r.mergedInto IS NULL WHERE f.deletedAt IS NULL AND ${visibleSql.replaceAll('scopeKey', 'f.scopeKey')} AND ${visibleSql.replaceAll('scopeKey', 'r.scopeKey')} AND lower(f.text) LIKE ? ORDER BY f.id DESC LIMIT ?`,
        args: [key, key, key, key, query, (input.limit ?? 20) - results.length],
      });
      results.push(
        ...facts.rows.map(row => ({
          type: 'fact' as const,
          id: String(row.id),
          recordId: String(row.parentEntityId),
          name: String(row.name),
          text: String(row.text),
          scope: parseJson<KnowledgeScope>(row.scopeJson),
        })),
      );
    }
    return results;
  }

  async getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_CURSORS}" WHERE sourceThreadId=? AND agent=?`,
      args: [input.sourceThreadId, input.agent],
    });
    const row = result.rows[0];
    return row
      ? {
          sourceThreadId: String(row.sourceThreadId),
          agent: String(row.agent),
          lastFactId: String(row.lastFactId),
          updatedAt: toDate(row.updatedAt),
        }
      : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastFactId: string;
  }): Promise<KnowledgeCurationCursor> {
    const updatedAt = new Date();
    const result = await this.#client.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_CURSORS}" (sourceThreadId,agent,lastFactId,updatedAt) VALUES (?,?,?,?) ON CONFLICT(sourceThreadId,agent) DO UPDATE SET lastFactId=excluded.lastFactId,updatedAt=excluded.updatedAt WHERE excluded.lastFactId >= "${TABLE_KNOWLEDGE_CURSORS}".lastFactId`,
      args: [input.sourceThreadId, input.agent, input.lastFactId, updatedAt.toISOString()],
    });
    if (result.rowsAffected === 0) throw new Error('Knowledge curation cursor cannot move backwards');
    return { ...input, updatedAt };
  }

  async listActivity(input: {
    scope: KnowledgeScope;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const result = await this.#client.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_ACTIVITY}" WHERE ${visibleSql}${input.after ? ' AND id > ?' : ''} ORDER BY id DESC LIMIT ?`,
      args: [key, key, ...(input.after ? [input.after] : []), input.limit ?? 100],
    });
    return result.rows.map(row => ({
      id: String(row.id),
      action: String(row.action) as KnowledgeActivityAction,
      recordType: String(row.recordType) as KnowledgeSemanticDocumentType,
      recordId: String(row.recordId),
      scope: parseJson<KnowledgeScope>(row.scopeJson),
      sourceThreadId: row.sourceThreadId == null ? undefined : String(row.sourceThreadId),
      createdAt: toDate(row.createdAt),
    }));
  }

  async listSemanticOutbox(
    input: { status?: KnowledgeSemanticOutboxEntry['status']; scope?: KnowledgeScope; limit?: number } = {},
  ): Promise<KnowledgeSemanticOutboxEntry[]> {
    const clauses: string[] = [];
    const args: InValue[] = [];
    if (input.status) {
      clauses.push('status=?');
      args.push(input.status);
    }
    if (input.scope) {
      const key = knowledgeScopeKey(canonicalizeKnowledgeScope(input.scope));
      clauses.push(visibleSql);
      args.push(key, key);
    }
    args.push(input.limit ?? 100);
    const result = await this.#client.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY createdAt ASC,id ASC LIMIT ?`,
      args,
    });
    return result.rows.map(parseOutbox);
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    const now = input.now ?? new Date();
    const stale = new Date(now.getTime() - (input.claimTimeoutMs ?? 60_000));
    return this.#transaction(async tx => {
      const clauses = [`availableAt <= ?`, `(status='pending' OR (status='processing' AND claimedAt <= ?))`];
      const args: InValue[] = [now.toISOString(), stale.toISOString()];
      if (input.scope) {
        const key = knowledgeScopeKey(canonicalizeKnowledgeScope(input.scope));
        clauses.push(visibleSql);
        args.push(key, key);
      }
      args.push(input.limit ?? 100);
      const selected = await tx.execute({
        sql: `SELECT id FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" WHERE ${clauses.join(' AND ')} ORDER BY createdAt ASC,id ASC LIMIT ?`,
        args,
      });
      const ids = selected.rows.map(row => String(row.id));
      for (const id of ids)
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" SET status='processing',attempts=attempts+1,claimedAt=?,claimedBy=? WHERE id=?`,
          args: [now.toISOString(), input.workerId, id],
        });
      if (!ids.length) return [];
      const result = await tx.execute({
        sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY createdAt ASC,id ASC`,
        args: ids,
      });
      return result.rows.map(parseOutbox);
    });
  }

  async completeSemanticOutbox(input: { ids: string[]; workerId: string }): Promise<void> {
    if (!input.ids.length) return;
    const now = new Date().toISOString();
    await this.#transaction(async tx => {
      for (const id of input.ids)
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" SET status='completed',completedAt=? WHERE id=? AND status='processing' AND claimedBy=?`,
          args: [now, id, input.workerId],
        });
    });
  }
  async releaseSemanticOutbox(input: { ids: string[]; workerId: string; retryAt?: Date }): Promise<void> {
    if (!input.ids.length) return;
    await this.#transaction(async tx => {
      for (const id of input.ids)
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" SET status='pending',availableAt=?,claimedAt=NULL,claimedBy=NULL WHERE id=? AND status='processing' AND claimedBy=?`,
          args: [(input.retryAt ?? new Date()).toISOString(), id, input.workerId],
        });
    });
  }

  async #transaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.#db.executeWriteOperationWithRetry(
      () =>
        withClientWriteLock(this.#client, async () => {
          const tx = await this.#client.transaction('write');
          try {
            const result = await operation(tx);
            await tx.commit();
            return result;
          } catch (error) {
            if (!tx.closed) await tx.rollback();
            throw error;
          }
        }),
      'write knowledge state',
    );
  }
  async #getEntity(executor: Executor, id: string): Promise<KnowledgeEntity | null> {
    const result = await executor.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=? AND type='entity'`,
      args: [id],
    });
    return result.rows[0] ? parseEntity(result.rows[0]) : null;
  }
  async #getEntityByName(executor: Executor, name: string, scope: KnowledgeScope): Promise<KnowledgeEntity | null> {
    const result = await executor.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE type='entity' AND scopeKey=? AND canonicalName=?`,
      args: [knowledgeScopeKey(scope), canonicalName(name)],
    });
    return result.rows[0] ? parseEntity(result.rows[0]) : null;
  }
  async #resolveEntity(executor: Executor, name: string, scope: KnowledgeScope): Promise<KnowledgeEntity | null> {
    for (let length = scope.length; length > 0; length--) {
      const entity = await this.#getEntityByName(executor, name, scope.slice(0, length));
      if (entity) {
        const terminal = await this.#resolveTerminalEntity(executor, entity.id);
        if (terminal && isKnowledgeScopeVisible(terminal.scope, scope)) return terminal;
      }
    }
    return null;
  }
  async #resolveTerminalEntity(executor: Executor, id: string): Promise<KnowledgeEntity | null> {
    let entity = await this.#getEntity(executor, id);
    const seen = new Set<string>();
    while (entity?.mergedInto) {
      if (seen.has(entity.id)) throw new Error(`Knowledge merge cycle detected at ${entity.id}`);
      seen.add(entity.id);
      entity = await this.#getEntity(executor, entity.mergedInto);
    }
    return entity;
  }
  async #getPageByExactName(executor: Executor, name: string, scope: KnowledgeScope): Promise<KnowledgePage | null> {
    const result = await executor.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE type='page' AND scopeKey=? AND canonicalName=?`,
      args: [knowledgeScopeKey(scope), canonicalName(name)],
    });
    return result.rows[0] ? parsePage(result.rows[0]) : null;
  }
  async #getFact(executor: Executor, id: string, includeDeleted: boolean): Promise<KnowledgeFact | null> {
    const result = await executor.execute({
      sql: `SELECT *,json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_FACTS}" WHERE id=?${includeDeleted ? '' : ' AND deletedAt IS NULL'}`,
      args: [id],
    });
    return result.rows[0] ? parseFact(result.rows[0]) : null;
  }

  async #listFacts(input: ListKnowledgeFactsInput, touching: boolean): Promise<ListKnowledgeFactsOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const entity = await this.#resolveTerminalEntity(this.#client, input.entityId);
    if (!entity || !isKnowledgeScopeVisible(entity.scope, scope)) return { facts: [] };
    const key = knowledgeScopeKey(scope);
    const args: InValue[] = [entity.id, ...(touching ? [entity.id] : []), key, key];
    if (input.after) args.push(input.after);
    args.push((input.limit ?? 100) + 1);
    const result = await this.#client.execute({
      sql: `SELECT DISTINCT f.*,json(f.scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_FACTS}" f${touching ? ` LEFT JOIN "${TABLE_KNOWLEDGE_MENTIONS}" m ON m.sourceType='fact' AND m.sourceId=f.id` : ''} WHERE ${touching ? '(f.parentEntityId=? OR m.recordId=?)' : 'f.parentEntityId=?'} AND ${visibleSql.replaceAll('scopeKey', 'f.scopeKey')}${input.includeDeleted ? '' : ' AND f.deletedAt IS NULL'}${input.after ? ' AND f.id < ?' : ''} ORDER BY f.id DESC LIMIT ?`,
      args,
    });
    const facts = result.rows.map(parseFact);
    const limit = input.limit ?? 100;
    return { facts: facts.slice(0, limit), nextCursor: facts.length > limit ? facts[limit - 1]?.id : undefined };
  }

  async #replaceMentions(
    tx: Transaction,
    sourceType: 'fact' | 'page',
    sourceId: string,
    text: string,
    resolutionScope: KnowledgeScope,
    defaultScope: KnowledgeScope,
  ): Promise<void> {
    await tx.execute({
      sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE sourceType=? AND sourceId=?`,
      args: [sourceType, sourceId],
    });
    for (const name of parseKnowledgeWikilinks(text)) {
      let entity = await this.#resolveEntity(tx, name, resolutionScope);
      if (!entity) {
        entity = await this.#getEntityByName(tx, name, defaultScope);
        if (entity) entity = await this.#resolveTerminalEntity(tx, entity.id);
        if (!entity) {
          const now = new Date();
          entity = {
            id: crypto.randomUUID(),
            type: 'entity',
            name,
            kind: 'entity',
            scope: defaultScope,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
          await tx.execute({
            sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,type,name,canonicalName,kind,body,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,NULL,jsonb(?),?,?,NULL,?,?)`,
            args: [
              entity.id,
              'entity',
              entity.name,
              canonicalName(entity.name),
              entity.kind,
              JSON.stringify(defaultScope),
              knowledgeScopeKey(defaultScope),
              1,
              now.toISOString(),
              now.toISOString(),
            ],
          });
          await this.#activity(tx, 'entity-created', 'entity', entity.id, defaultScope);
          await this.#outbox(tx, 'entity', entity.id, 'upsert', 1, defaultScope);
        }
      }
      await tx.execute({
        sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_MENTIONS}" (sourceType,sourceId,recordId) VALUES (?,?,?)`,
        args: [sourceType, sourceId, entity.id],
      });
    }
  }

  async #activity(
    executor: Executor,
    action: KnowledgeActivityAction,
    recordType: KnowledgeSemanticDocumentType,
    recordId: string,
    scope: KnowledgeScope,
    sourceThreadId?: string,
  ): Promise<void> {
    const now = new Date();
    await executor.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_ACTIVITY}" (id,action,recordType,recordId,scope,scopeKey,sourceThreadId,createdAt) VALUES (?,?,?,?,jsonb(?),?,?,?)`,
      args: [
        createKnowledgeUlid(),
        action,
        recordType,
        recordId,
        JSON.stringify(scope),
        knowledgeScopeKey(scope),
        sourceThreadId ?? null,
        now.toISOString(),
      ],
    });
  }
  async #outbox(
    executor: Executor,
    documentType: KnowledgeSemanticDocumentType,
    id: string,
    operation: KnowledgeSemanticOperation,
    version: number | string,
    scope: KnowledgeScope,
  ): Promise<void> {
    const documentId = knowledgeSemanticDocumentId(documentType, id);
    const idempotencyKey = knowledgeSemanticIdempotencyKey(documentId, operation, version);
    const now = new Date();
    await executor.execute({
      sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (id,idempotencyKey,documentId,documentType,operation,scope,scopeKey,status,attempts,availableAt,claimedAt,claimedBy,createdAt,completedAt) VALUES (?,?,?,?,?,jsonb(?),?,'pending',0,?,NULL,NULL,?,NULL)`,
      args: [
        createKnowledgeUlid(),
        idempotencyKey,
        documentId,
        documentType,
        operation,
        JSON.stringify(scope),
        knowledgeScopeKey(scope),
        now.toISOString(),
        now.toISOString(),
      ],
    });
  }
}
