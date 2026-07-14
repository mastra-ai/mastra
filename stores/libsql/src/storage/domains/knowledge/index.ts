import type { Client, InValue, ResultSet } from '@libsql/client';
import {
  InMemoryDB,
  InMemoryKnowledgeStorage,
  KNOWLEDGE_ACTIVITY_SCHEMA,
  KNOWLEDGE_CURSORS_SCHEMA,
  KNOWLEDGE_FACTS_SCHEMA,
  KNOWLEDGE_MENTIONS_SCHEMA,
  KNOWLEDGE_RECORDS_SCHEMA,
  KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
  KnowledgeStorage,
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
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgePage,
  KnowledgeScope,
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

function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  if (value instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(value)) as T;
  if (value instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(value)) as T;
  return value as T;
}

function date(value: unknown): Date {
  return new Date(String(value));
}

function optionalDate(value: unknown): Date | undefined {
  return value == null ? undefined : date(value);
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
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_MENTIONS, schema: KNOWLEDGE_MENTIONS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_CURSORS, schema: KNOWLEDGE_CURSORS_SCHEMA });
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
    await this.#write(async store => store.dangerouslyClearAll());
  }

  async createEntity(input: CreateKnowledgeEntityInput): Promise<KnowledgeEntity> {
    return this.#write(store => store.createEntity(input));
  }
  async getEntity(id: string): Promise<KnowledgeEntity | null> {
    return this.#read(store => store.getEntity(id));
  }
  async getEntityByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeEntity | null> {
    return this.#read(store => store.getEntityByName(input));
  }
  async resolveEntity(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeEntity | null> {
    return this.#read(store => store.resolveEntity(input));
  }
  async listEntities(input: ListKnowledgeRecordsInput): Promise<KnowledgeEntity[]> {
    return this.#read(store => store.listEntities(input));
  }
  async updateEntity(input: UpdateKnowledgeEntityInput): Promise<KnowledgeEntity> {
    return this.#write(store => store.updateEntity(input));
  }
  async mergeEntities(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeEntity> {
    return this.#write(store => store.mergeEntities(input));
  }

  async createPage(input: CreateKnowledgePageInput): Promise<KnowledgePage> {
    return this.#write(store => store.createPage(input));
  }
  async getPage(id: string): Promise<KnowledgePage | null> {
    return this.#read(store => store.getPage(id));
  }
  async getPageByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgePage | null> {
    return this.#read(store => store.getPageByName(input));
  }
  async listPages(input: Omit<ListKnowledgeRecordsInput, 'kind'>): Promise<KnowledgePage[]> {
    return this.#read(store => store.listPages(input));
  }
  async updatePage(input: UpdateKnowledgePageInput): Promise<KnowledgePage> {
    return this.#write(store => store.updatePage(input));
  }

  async appendFact(input: AppendKnowledgeFactInput): Promise<KnowledgeFact> {
    return this.#write(store => store.appendFact(input));
  }
  async getFact(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeFact | null> {
    return this.#read(store => store.getFact(input));
  }
  async factsAbout(input: ListKnowledgeFactsInput): Promise<ListKnowledgeFactsOutput> {
    return this.#read(store => store.factsAbout(input));
  }
  async factsTouching(input: ListKnowledgeFactsInput): Promise<ListKnowledgeFactsOutput> {
    return this.#read(store => store.factsTouching(input));
  }
  async removeFact(input: { id: string; deletedBy: string }): Promise<KnowledgeFact> {
    return this.#write(store => store.removeFact(input));
  }
  async restoreFact(input: { id: string }): Promise<KnowledgeFact> {
    return this.#write(store => store.restoreFact(input));
  }
  async rescopeFact(input: { id: string; scope: KnowledgeScope }): Promise<KnowledgeFact> {
    return this.#write(store => store.rescopeFact(input));
  }
  async raiseCeiling(input: { id: string; maxScope?: KnowledgeFact['maxScope'] }): Promise<KnowledgeFact> {
    return this.#write(store => store.raiseCeiling(input));
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    return this.#read(store => store.search(input));
  }
  async getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    return this.#read(store => store.getCurationCursor(input));
  }
  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastFactId: string;
  }): Promise<KnowledgeCurationCursor> {
    return this.#write(store => store.advanceCurationCursor(input));
  }
  async listActivity(input: {
    scope: KnowledgeScope;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    return this.#read(store => store.listActivity(input));
  }

  async listSemanticOutbox(input?: {
    status?: KnowledgeSemanticOutboxEntry['status'];
    scope?: KnowledgeScope;
    limit?: number;
  }): Promise<KnowledgeSemanticOutboxEntry[]> {
    return this.#read(store => store.listSemanticOutbox(input));
  }
  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    return this.#write(store => store.claimSemanticOutbox(input));
  }
  async completeSemanticOutbox(input: { ids: string[]; workerId: string }): Promise<void> {
    return this.#write(store => store.completeSemanticOutbox(input));
  }
  async releaseSemanticOutbox(input: { ids: string[]; workerId: string; retryAt?: Date }): Promise<void> {
    return this.#write(store => store.releaseSemanticOutbox(input));
  }

  async #read<T>(operation: (store: InMemoryKnowledgeStorage) => Promise<T>): Promise<T> {
    const db = await this.#load(this.#client);
    return operation(new InMemoryKnowledgeStorage({ db }));
  }

  async #write<T>(operation: (store: InMemoryKnowledgeStorage) => Promise<T>): Promise<T> {
    return this.#db.executeWriteOperationWithRetry(
      () =>
        withClientWriteLock(this.#client, async () => {
          const tx = await this.#client.transaction('write');
          try {
            const db = await this.#load(tx);
            const result = await operation(new InMemoryKnowledgeStorage({ db }));
            await this.#save(tx, db);
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

  async #load(executor: Executor): Promise<InMemoryDB> {
    const db = new InMemoryDB();
    const [records, facts, mentions, cursors, activity, outbox] = await Promise.all([
      executor.execute(`SELECT *, json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}"`),
      executor.execute(`SELECT *, json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_FACTS}"`),
      executor.execute(`SELECT * FROM "${TABLE_KNOWLEDGE_MENTIONS}"`),
      executor.execute(`SELECT * FROM "${TABLE_KNOWLEDGE_CURSORS}"`),
      executor.execute(`SELECT *, json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_ACTIVITY}"`),
      executor.execute(`SELECT *, json(scope) AS scopeJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}"`),
    ]);

    for (const row of records.rows) {
      const scope = parseJson<KnowledgeScope>(row.scopeJson);
      if (row.type === 'entity') {
        const entity: KnowledgeEntity = {
          id: String(row.id),
          type: 'entity',
          name: String(row.name),
          kind: String(row.kind),
          scope,
          version: Number(row.version),
          mergedInto: row.mergedInto == null ? undefined : String(row.mergedInto),
          createdAt: date(row.createdAt),
          updatedAt: date(row.updatedAt),
        };
        db.knowledgeEntities.set(entity.id, entity);
        db.knowledgeEntityKeys.set(`${String(row.scopeKey)}\u0000${String(row.canonicalName)}`, entity.id);
      } else {
        const page: KnowledgePage = {
          id: String(row.id),
          type: 'page',
          name: String(row.name),
          body: String(row.body ?? ''),
          scope,
          version: Number(row.version),
          createdAt: date(row.createdAt),
          updatedAt: date(row.updatedAt),
        };
        db.knowledgePages.set(page.id, page);
        db.knowledgePageKeys.set(`${String(row.scopeKey)}\u0000${String(row.canonicalName)}`, page.id);
      }
    }
    for (const row of facts.rows) {
      const fact: KnowledgeFact = {
        id: String(row.id),
        parentEntityId: String(row.parentEntityId),
        text: String(row.text),
        scope: parseJson(row.scopeJson),
        sourceThreadId: String(row.sourceThreadId),
        capturedAt: date(row.capturedAt),
        when: optionalDate(row.when),
        maxScope: row.maxScope == null ? undefined : (String(row.maxScope) as KnowledgeFact['maxScope']),
        deletedAt: optionalDate(row.deletedAt),
        deletedBy: row.deletedBy == null ? undefined : String(row.deletedBy),
      };
      db.knowledgeFacts.set(fact.id, fact);
    }
    for (const row of mentions.rows) {
      const key = `${String(row.sourceType)}:${String(row.sourceId)}`;
      const targets = db.knowledgeMentions.get(key) ?? new Set<string>();
      targets.add(String(row.recordId));
      db.knowledgeMentions.set(key, targets);
    }
    for (const row of cursors.rows) {
      const cursor: KnowledgeCurationCursor = {
        sourceThreadId: String(row.sourceThreadId),
        agent: String(row.agent),
        lastFactId: String(row.lastFactId),
        updatedAt: date(row.updatedAt),
      };
      db.knowledgeCursors.set(`${cursor.sourceThreadId}\u0000${cursor.agent}`, cursor);
    }
    for (const row of activity.rows) {
      db.knowledgeActivity.push({
        id: String(row.id),
        action: String(row.action) as KnowledgeActivityEvent['action'],
        recordType: String(row.recordType) as KnowledgeActivityEvent['recordType'],
        recordId: String(row.recordId),
        scope: parseJson(row.scopeJson),
        sourceThreadId: row.sourceThreadId == null ? undefined : String(row.sourceThreadId),
        createdAt: date(row.createdAt),
      });
    }
    for (const row of outbox.rows) {
      const entry: KnowledgeSemanticOutboxEntry = {
        id: String(row.id),
        idempotencyKey: String(row.idempotencyKey),
        documentId: String(row.documentId),
        documentType: String(row.documentType) as KnowledgeSemanticOutboxEntry['documentType'],
        operation: String(row.operation) as KnowledgeSemanticOutboxEntry['operation'],
        scope: parseJson(row.scopeJson),
        status: String(row.status) as KnowledgeSemanticOutboxEntry['status'],
        attempts: Number(row.attempts),
        availableAt: date(row.availableAt),
        claimedAt: optionalDate(row.claimedAt),
        claimedBy: row.claimedBy == null ? undefined : String(row.claimedBy),
        createdAt: date(row.createdAt),
        completedAt: optionalDate(row.completedAt),
      };
      db.knowledgeSemanticOutbox.set(entry.id, entry);
      db.knowledgeSemanticIdempotency.set(entry.idempotencyKey, entry.id);
    }
    return db;
  }

  async #save(executor: Executor, db: InMemoryDB): Promise<void> {
    for (const table of [
      TABLE_KNOWLEDGE_MENTIONS,
      TABLE_KNOWLEDGE_FACTS,
      TABLE_KNOWLEDGE_RECORDS,
      TABLE_KNOWLEDGE_CURSORS,
      TABLE_KNOWLEDGE_ACTIVITY,
      TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
    ]) {
      await executor.execute(`DELETE FROM "${table}"`);
    }

    for (const entity of db.knowledgeEntities.values()) {
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,type,name,canonicalName,kind,body,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,NULL,jsonb(?),?,?,?,?,?)`,
        args: [
          entity.id,
          'entity',
          entity.name,
          entity.name.toLocaleLowerCase(),
          entity.kind,
          JSON.stringify(entity.scope),
          entity.scope.join('\u001f'),
          entity.version,
          entity.mergedInto ?? null,
          entity.createdAt.toISOString(),
          entity.updatedAt.toISOString(),
        ],
      });
    }
    for (const page of db.knowledgePages.values()) {
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,type,name,canonicalName,kind,body,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,NULL,?,jsonb(?),?,?,NULL,?,?)`,
        args: [
          page.id,
          'page',
          page.name,
          page.name.toLocaleLowerCase(),
          page.body,
          JSON.stringify(page.scope),
          page.scope.join('\u001f'),
          page.version,
          page.createdAt.toISOString(),
          page.updatedAt.toISOString(),
        ],
      });
    }
    for (const fact of db.knowledgeFacts.values()) {
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_FACTS}" (id,parentEntityId,text,scope,scopeKey,sourceThreadId,capturedAt,"when",maxScope,deletedAt,deletedBy) VALUES (?,?,?,jsonb(?),?,?,?,?,?,?,?)`,
        args: [
          fact.id,
          fact.parentEntityId,
          fact.text,
          JSON.stringify(fact.scope),
          fact.scope.join('\u001f'),
          fact.sourceThreadId,
          fact.capturedAt.toISOString(),
          fact.when?.toISOString() ?? null,
          fact.maxScope ?? null,
          fact.deletedAt?.toISOString() ?? null,
          fact.deletedBy ?? null,
        ],
      });
    }
    for (const [key, recordIds] of db.knowledgeMentions) {
      const separator = key.indexOf(':');
      const sourceType = key.slice(0, separator);
      const sourceId = key.slice(separator + 1);
      for (const recordId of recordIds) {
        await executor.execute({
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_MENTIONS}" (sourceType,sourceId,recordId) VALUES (?,?,?)`,
          args: [sourceType, sourceId, recordId],
        });
      }
    }
    for (const cursor of db.knowledgeCursors.values()) {
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_CURSORS}" (sourceThreadId,agent,lastFactId,updatedAt) VALUES (?,?,?,?)`,
        args: [cursor.sourceThreadId, cursor.agent, cursor.lastFactId, cursor.updatedAt.toISOString()],
      });
    }
    for (const event of db.knowledgeActivity) {
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_ACTIVITY}" (id,action,recordType,recordId,scope,scopeKey,sourceThreadId,createdAt) VALUES (?,?,?,?,jsonb(?),?,?,?)`,
        args: [
          event.id,
          event.action,
          event.recordType,
          event.recordId,
          JSON.stringify(event.scope),
          event.scope.join('\u001f'),
          event.sourceThreadId ?? null,
          event.createdAt.toISOString(),
        ],
      });
    }
    for (const entry of db.knowledgeSemanticOutbox.values()) {
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (id,idempotencyKey,documentId,documentType,operation,scope,scopeKey,status,attempts,availableAt,claimedAt,claimedBy,createdAt,completedAt) VALUES (?,?,?,?,?,jsonb(?),?,?,?,?,?,?,?,?)`,
        args: [
          entry.id,
          entry.idempotencyKey,
          entry.documentId,
          entry.documentType,
          entry.operation,
          JSON.stringify(entry.scope),
          entry.scope.join('\u001f'),
          entry.status,
          entry.attempts,
          entry.availableAt.toISOString(),
          entry.claimedAt?.toISOString() ?? null,
          entry.claimedBy ?? null,
          entry.createdAt.toISOString(),
          entry.completedAt?.toISOString() ?? null,
        ],
      });
    }
  }
}
