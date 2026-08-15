import {
  assertKnowledgeScopeWithinCeiling,
  canonicalizeKnowledgeScope,
  createKnowledgeUlid,
  isKnowledgeScopeVisible,
  KNOWLEDGE_ACTIVITY_SCHEMA,
  KNOWLEDGE_CURSORS_SCHEMA,
  KNOWLEDGE_ITEMS_SCHEMA,
  KNOWLEDGE_MENTIONS_SCHEMA,
  KNOWLEDGE_RECORDS_SCHEMA,
  KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
  knowledgeScopeKey,
  knowledgeSemanticDocumentId,
  knowledgeSemanticIdempotencyKey,
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  KnowledgeStorage,
  parseKnowledgeNodeCursor,
  parseKnowledgeWikilinks,
  TABLE_KNOWLEDGE_ACTIVITY,
  TABLE_KNOWLEDGE_CURSORS,
  TABLE_KNOWLEDGE_ITEMS,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
} from '@mastra/core/storage';
import type {
  AppendKnowledgeItemInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeNode,
  KnowledgeItem,
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  ListKnowledgeItemsBySourceInput,
  ListKnowledgeItemsInput,
  ListKnowledgeItemsOutput,
  ListKnowledgeNodesInput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  UpdateKnowledgeNodeInput,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import type { QueryValues, TxClient } from '../../client';
import { generateTableSQL, PgDB, resolvePgConfig } from '../../db';
import type { DbClient, PgDomainConfig } from '../../db';

interface QueryResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}

interface Executor {
  execute(statement: string | { sql: string; args?: QueryValues }): Promise<QueryResult>;
}

const camelCaseColumns = [
  'canonicalName',
  'scopeKey',
  'mergedInto',
  'createdAt',
  'updatedAt',
  'parentNodeId',
  'sourceThreadId',
  'capturedAt',
  'maxScope',
  'deletedAt',
  'deletedBy',
  'sourceType',
  'sourceId',
  'recordId',
  'lastItemId',
  'recordType',
  'idempotencyKey',
  'documentId',
  'documentType',
  'availableAt',
  'claimedAt',
  'claimedBy',
  'completedAt',
] as const;

function postgresSql(sql: string, schemaName?: string): string {
  let normalized = sql.replace(/jsonb\(\?\)/g, '?::jsonb');
  for (const column of camelCaseColumns) {
    normalized = normalized.replace(new RegExp(`(?<!")\\b${column}\\b(?!")`, 'g'), `"${column}"`);
  }
  if (schemaName) {
    const quotedSchema = `"${parseSqlIdentifier(schemaName, 'schema name')}"`;
    for (const table of [
      TABLE_KNOWLEDGE_RECORDS,
      TABLE_KNOWLEDGE_ITEMS,
      TABLE_KNOWLEDGE_MENTIONS,
      TABLE_KNOWLEDGE_CURSORS,
      TABLE_KNOWLEDGE_ACTIVITY,
      TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
    ]) {
      normalized = normalized.replaceAll(`"${table}"`, `${quotedSchema}."${table}"`);
    }
  }
  let index = 0;
  return normalized.replace(/\?/g, () => `$${++index}`);
}

function createExecutor(client: Pick<DbClient, 'query'> | TxClient, schemaName?: string): Executor {
  return {
    async execute(statement) {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      const args = typeof statement === 'string' ? [] : (statement.args ?? []);
      const result = await client.query(postgresSql(sql, schemaName), args);
      return { rows: result.rows as Record<string, unknown>[], rowsAffected: result.rowCount ?? 0 };
    },
  };
}

const visibleSql = `(scopeKey = ? OR LEFT(?, LENGTH(scopeKey) + 1) = scopeKey || chr(31))`;

function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  if (value instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(value)) as T;
  if (value instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(value)) as T;
  return value as T;
}

function toDate(value: unknown): Date {
  return value instanceof Date ? new Date(value) : new Date(String(value));
}

function optionalDate(value: unknown): Date | undefined {
  return value == null ? undefined : toDate(value);
}

function postgresTimestamp(value: Date): string {
  const pad = (part: number, width = 2) => String(part).padStart(width, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`;
}

function canonicalName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function escapeLikePattern(value: string): string {
  return value.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_');
}

function parseEntity(row: Record<string, unknown>): KnowledgeNode {
  return {
    id: String(row.id),
    type: 'node',
    name: String(row.name),
    kind: String(row.kind),
    content: row.content == null ? undefined : String(row.content),
    scope: parseJson(row.scopeJson ?? row.scope),
    version: Number(row.version),
    mergedInto: row.mergedInto == null ? undefined : String(row.mergedInto),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function parseFact(row: Record<string, unknown>): KnowledgeItem {
  return {
    id: String(row.id),
    parentNodeId: String(row.parentNodeId),
    text: String(row.text),
    scope: parseJson(row.scopeJson ?? row.scope),
    sourceThreadId: String(row.sourceThreadId),
    capturedAt: toDate(row.capturedAt),
    when: optionalDate(row.when),
    maxScope: row.maxScope == null ? undefined : (String(row.maxScope) as KnowledgeItem['maxScope']),
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

function knowledgeIndexDDL(schemaName?: string): string[] {
  const table = (name: string) => {
    const quotedName = `"${parseSqlIdentifier(name, 'table name')}"`;
    return schemaName ? `"${parseSqlIdentifier(schemaName, 'schema name')}".${quotedName}` : quotedName;
  };
  return [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_records_identity ON ${table(TABLE_KNOWLEDGE_RECORDS)} ("type", "scopeKey", "canonicalName")`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_records_scope ON ${table(TABLE_KNOWLEDGE_RECORDS)} ("scopeKey", "type")`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_facts_parent_latest ON ${table(TABLE_KNOWLEDGE_ITEMS)} ("parentNodeId", "id" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_facts_thread_latest ON ${table(TABLE_KNOWLEDGE_ITEMS)} ("sourceThreadId", "id" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_mentions_record ON ${table(TABLE_KNOWLEDGE_MENTIONS)} ("recordId", "sourceType", "sourceId")`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_activity_latest ON ${table(TABLE_KNOWLEDGE_ACTIVITY)} ("id" DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_outbox_idempotency ON ${table(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX)} ("idempotencyKey")`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_outbox_claim ON ${table(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX)} ("status", "availableAt", "createdAt")`,
  ].map(statement => `${statement};`);
}

export class KnowledgePG extends KnowledgeStorage {
  static readonly MANAGED_TABLES = [
    TABLE_KNOWLEDGE_RECORDS,
    TABLE_KNOWLEDGE_ITEMS,
    TABLE_KNOWLEDGE_MENTIONS,
    TABLE_KNOWLEDGE_CURSORS,
    TABLE_KNOWLEDGE_ACTIVITY,
    TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
  ] as const;

  static getExportDDL(schemaName?: string): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_RECORDS,
        schema: KNOWLEDGE_RECORDS_SCHEMA,
        schemaName,
        includeAllConstraints: true,
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_ITEMS,
        schema: KNOWLEDGE_ITEMS_SCHEMA,
        schemaName,
        includeAllConstraints: true,
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_MENTIONS,
        schema: KNOWLEDGE_MENTIONS_SCHEMA,
        schemaName,
        compositePrimaryKey: ['sourceType', 'sourceId', 'recordId'],
        includeAllConstraints: true,
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_CURSORS,
        schema: KNOWLEDGE_CURSORS_SCHEMA,
        schemaName,
        compositePrimaryKey: ['sourceThreadId', 'agent'],
        includeAllConstraints: true,
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_ACTIVITY,
        schema: KNOWLEDGE_ACTIVITY_SCHEMA,
        schemaName,
        includeAllConstraints: true,
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
        schema: KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
        schemaName,
        includeAllConstraints: true,
      }),
      ...knowledgeIndexDDL(schemaName),
    ];
  }

  readonly #client: DbClient;
  readonly #executor: Executor;
  readonly #db: PgDB;
  readonly #schemaName?: string;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#client = client;
    this.#schemaName = schemaName;
    this.#executor = createExecutor(client, schemaName);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_RECORDS, schema: KNOWLEDGE_RECORDS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_ITEMS, schema: KNOWLEDGE_ITEMS_SCHEMA });
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
    await Promise.all(knowledgeIndexDDL().map(sql => this.#executor.execute({ sql, args: [] })));
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#transaction(async tx => {
      for (const table of [
        TABLE_KNOWLEDGE_MENTIONS,
        TABLE_KNOWLEDGE_ITEMS,
        TABLE_KNOWLEDGE_RECORDS,
        TABLE_KNOWLEDGE_CURSORS,
        TABLE_KNOWLEDGE_ACTIVITY,
        TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
      ]) {
        await tx.execute(`DELETE FROM "${table}"`);
      }
    });
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#transaction(async tx => {
      const existing = await this.#getNodeByName(tx, input.name, scope);
      if (existing) {
        const terminal = (await this.#resolveTerminalNode(tx, existing.id))!;
        if (!isKnowledgeScopeVisible(terminal.scope, scope)) {
          throw new Error(`Merged knowledge entity is not visible from scope: ${input.name}`);
        }
        return terminal;
      }
      const now = new Date();
      const entity: KnowledgeNode = {
        id: input.id ?? crypto.randomUUID(),
        type: 'node',
        name: input.name.trim(),
        kind: input.kind,
        content: input.content,
        scope,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,type,name,canonicalName,kind,content,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,?,jsonb(?),?,?,NULL,?,?)`,
        args: [
          entity.id,
          'node',
          entity.name,
          canonicalName(entity.name),
          entity.kind,
          entity.content ?? null,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          entity.version,
          now.toISOString(),
          now.toISOString(),
        ],
      });
      await this.#replaceMentions(tx, 'node', entity.id, entity.content ?? '', input.resolutionScope ?? scope, scope);
      await this.#activity(tx, 'node-created', 'node', entity.id, scope);
      await this.#outbox(tx, 'node', entity.id, 'upsert', entity.version, scope);
      return entity;
    });
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.#getNode(this.#executor, id);
  }

  async getNodeByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    return this.#getNodeByName(this.#executor, input.name, canonicalizeKnowledgeScope(input.scope));
  }

  async resolveNode(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    return this.#resolveNode(this.#executor, input.name, canonicalizeKnowledgeScope(input.scope));
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const clauses = [`type = 'node'`, 'mergedInto IS NULL', visibleSql];
    const args: QueryValues = [key, key];
    if (input.namePrefix) {
      clauses.push("canonicalName LIKE ? ESCAPE '='");
      args.push(`${escapeLikePattern(canonicalName(input.namePrefix))}%`);
    }
    if (input.kind) {
      clauses.push('kind = ?');
      args.push(input.kind);
    }
    if (input.hasContent !== undefined)
      clauses.push(input.hasContent ? "content IS NOT NULL AND content <> ''" : "(content IS NULL OR content = '')");
    if (input.cursor) {
      const cursor = parseKnowledgeNodeCursor(input.cursor, {
        namePrefix: input.namePrefix,
        kind: input.kind,
        hasContent: input.hasContent,
      });
      const updatedAt = postgresTimestamp(cursor.updatedAt);
      clauses.push('(updatedAt < ? OR (updatedAt = ? AND (name > ? OR (name = ? AND id > ?))))');
      args.push(updatedAt, updatedAt, cursor.name, cursor.name, cursor.id);
    }
    args.push(input.limit ?? 100);
    const result = await this.#executor.execute({
      sql: `SELECT *, scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE ${clauses.join(' AND ')} ORDER BY updatedAt DESC, name ASC, id ASC LIMIT ?`,
      args,
    });
    return result.rows.map(parseEntity);
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(async tx => {
      const existing = await this.#getNode(tx, input.id);
      if (!existing) throw new KnowledgeNotFoundError('node', input.id);
      if (existing.mergedInto) throw new Error(`Cannot update merged knowledge entity: ${input.id}`);
      const scope = canonicalizeKnowledgeScope(input.scope ?? existing.scope);
      const name = (input.name ?? existing.name).trim();
      const content = input.content ?? existing.content;
      const now = new Date();
      const result = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET name=?,canonicalName=?,kind=?,content=?,scope=jsonb(?),scopeKey=?,version=version+1,updatedAt=? WHERE id=? AND type='node' AND version=?`,
        args: [
          name,
          canonicalName(name),
          input.kind ?? existing.kind,
          content ?? null,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          now.toISOString(),
          input.id,
          input.version,
        ],
      });
      if (result.rowsAffected === 0) throw new KnowledgeConflictError(input.id);
      if (input.content !== undefined || input.name !== undefined || input.scope !== undefined) {
        await this.#replaceMentions(tx, 'node', input.id, content ?? '', input.resolutionScope ?? scope, scope);
      }
      await this.#activity(tx, 'node-updated', 'node', input.id, scope);
      if (knowledgeScopeKey(existing.scope) !== knowledgeScopeKey(scope)) {
        await this.#outbox(tx, 'node', input.id, 'delete', createKnowledgeUlid(), existing.scope);
        const facts = await tx.execute({
          sql: `SELECT id,scope AS "scopeJson",deletedAt FROM "${TABLE_KNOWLEDGE_ITEMS}" WHERE parentNodeId=?`,
          args: [input.id],
        });
        for (const row of facts.rows) {
          const factScope = parseJson<KnowledgeScope>(row.scopeJson);
          await this.#outbox(tx, 'item', String(row.id), 'delete', createKnowledgeUlid(), factScope);
          if (row.deletedAt == null) {
            await this.#outbox(tx, 'item', String(row.id), 'upsert', createKnowledgeUlid(), factScope);
          }
        }
      }
      await this.#outbox(tx, 'node', input.id, 'upsert', input.version + 1, scope);
      return {
        ...existing,
        name,
        kind: input.kind ?? existing.kind,
        content,
        scope,
        version: input.version + 1,
        updatedAt: now,
      };
    });
  }

  async mergeNodes(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeNode> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge entity into itself');
    return this.#transaction(async tx => {
      const source = await this.#getNode(tx, input.sourceId);
      if (!source) throw new KnowledgeNotFoundError('node', input.sourceId);
      const target = await this.#resolveTerminalNode(tx, input.targetId);
      if (!target) throw new KnowledgeNotFoundError('node', input.targetId);
      if (target.id === source.id) throw new Error('Cannot create a knowledge merge cycle');
      if (!isKnowledgeScopeVisible(target.scope, source.scope)) {
        throw new Error('Cannot merge a knowledge entity into a target that is narrower than its source scope');
      }
      const affected = await tx.execute({
        sql: `SELECT DISTINCT m.sourceType,m.sourceId,COALESCE(f.scope,r.scope) AS "scopeJson",CASE WHEN f.deletedAt IS NULL THEN 0 ELSE 1 END AS deleted FROM "${TABLE_KNOWLEDGE_MENTIONS}" m LEFT JOIN "${TABLE_KNOWLEDGE_ITEMS}" f ON m.sourceType='item' AND f.id=m.sourceId LEFT JOIN "${TABLE_KNOWLEDGE_RECORDS}" r ON m.sourceType='node' AND r.id=m.sourceId WHERE m.recordId=?`,
        args: [source.id],
      });
      const movedFacts = await tx.execute({
        sql: `SELECT id,scope AS "scopeJson",deletedAt FROM "${TABLE_KNOWLEDGE_ITEMS}" WHERE parentNodeId=?`,
        args: [source.id],
      });
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET mergedInto=?,version=version+1,updatedAt=? WHERE id=? AND type='node' AND version=? AND mergedInto IS NULL`,
        args: [target.id, new Date().toISOString(), source.id, input.sourceVersion],
      });
      if (updated.rowsAffected === 0) throw new KnowledgeConflictError(source.id);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_ITEMS}" SET parentNodeId=? WHERE parentNodeId=?`,
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
          'item',
          String(row.id),
          row.deletedAt == null ? 'upsert' : 'delete',
          createKnowledgeUlid(),
          parseJson(row.scopeJson),
        );
      for (const row of affected.rows)
        await this.#outbox(
          tx,
          String(row.sourceType) as 'item' | 'node',
          String(row.sourceId),
          Number(row.deleted) ? 'delete' : 'upsert',
          createKnowledgeUlid(),
          parseJson<KnowledgeScope>(row.scopeJson),
        );
      await this.#activity(tx, 'node-merged', 'node', source.id, source.scope);
      await this.#outbox(tx, 'node', source.id, 'delete', input.sourceVersion + 1, source.scope);
      await this.#outbox(tx, 'node', target.id, 'upsert', createKnowledgeUlid(), target.scope);
      return target;
    });
  }

  async appendItem(input: AppendKnowledgeItemInput): Promise<KnowledgeItem> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const resolutionScope = canonicalizeKnowledgeScope(input.resolutionScope);
    const defaultScope = canonicalizeKnowledgeScope(input.defaultScope);
    assertKnowledgeScopeWithinCeiling(scope, input.maxScope);
    return this.#transaction(async tx => {
      const parent = await this.#resolveTerminalNode(tx, input.parentNodeId);
      if (!parent) throw new KnowledgeNotFoundError('node', input.parentNodeId);
      const fact: KnowledgeItem = {
        id: input.id ?? createKnowledgeUlid(),
        parentNodeId: parent.id,
        text: input.text,
        scope,
        sourceThreadId: input.sourceThreadId,
        capturedAt: new Date(),
        when: input.when ? new Date(input.when) : undefined,
        maxScope: input.maxScope,
      };
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_ITEMS}" (id,parentNodeId,text,scope,scopeKey,sourceThreadId,capturedAt,"when",maxScope,deletedAt,deletedBy) VALUES (?,?,?,jsonb(?),?,?,?,?,?,NULL,NULL)`,
        args: [
          fact.id,
          fact.parentNodeId,
          fact.text,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          fact.sourceThreadId,
          fact.capturedAt.toISOString(),
          fact.when?.toISOString() ?? null,
          fact.maxScope ?? null,
        ],
      });
      await this.#replaceMentions(tx, 'item', fact.id, fact.text, resolutionScope, defaultScope);
      await this.#activity(tx, 'item-created', 'item', fact.id, scope, fact.sourceThreadId);
      await this.#outbox(tx, 'item', fact.id, 'upsert', fact.id, scope);
      return fact;
    });
  }

  async getItem(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeItem | null> {
    const result = await this.#executor.execute({
      sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_ITEMS}" WHERE id=?${input.includeDeleted ? '' : ' AND deletedAt IS NULL'}`,
      args: [input.id],
    });
    return result.rows[0] ? parseFact(result.rows[0]) : null;
  }

  async itemsAbout(input: ListKnowledgeItemsInput): Promise<ListKnowledgeItemsOutput> {
    return this.#listFacts(input, false);
  }
  async itemsTouching(input: ListKnowledgeItemsInput): Promise<ListKnowledgeItemsOutput> {
    return this.#listFacts(input, true);
  }

  async listItemsBySource(input: ListKnowledgeItemsBySourceInput): Promise<ListKnowledgeItemsOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const args: QueryValues = [input.sourceThreadId, key, key];
    if (input.after) args.push(input.after);
    const limit = input.limit ?? 100;
    args.push(limit + 1);
    const result = await this.#executor.execute({
      sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_ITEMS}" WHERE sourceThreadId=? AND ${visibleSql}${input.includeDeleted ? '' : ' AND deletedAt IS NULL'}${input.after ? ' AND id > ?' : ''} ORDER BY id ASC LIMIT ?`,
      args,
    });
    const facts = result.rows.map(parseFact);
    return { items: facts.slice(0, limit), nextCursor: facts.length > limit ? facts[limit - 1]?.id : undefined };
  }

  async removeItem(input: { id: string; deletedBy: string }): Promise<KnowledgeItem> {
    return this.#transaction(async tx => {
      const fact = await this.#getItem(tx, input.id, true);
      if (!fact) throw new KnowledgeNotFoundError('item', input.id);
      if (fact.deletedAt) return fact;
      const deletedAt = new Date();
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_ITEMS}" SET deletedAt=?,deletedBy=? WHERE id=? AND deletedAt IS NULL`,
        args: [deletedAt.toISOString(), input.deletedBy, input.id],
      });
      await this.#activity(tx, 'item-deleted', 'item', input.id, fact.scope, fact.sourceThreadId);
      await this.#outbox(tx, 'item', input.id, 'delete', deletedAt.toISOString(), fact.scope);
      return { ...fact, deletedAt, deletedBy: input.deletedBy };
    });
  }

  async restoreItem(input: { id: string }): Promise<KnowledgeItem> {
    return this.#transaction(async tx => {
      const fact = await this.#getItem(tx, input.id, true);
      if (!fact) throw new KnowledgeNotFoundError('item', input.id);
      if (!fact.deletedAt) return fact;
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_ITEMS}" SET deletedAt=NULL,deletedBy=NULL WHERE id=?`,
        args: [input.id],
      });
      await this.#activity(tx, 'item-restored', 'item', input.id, fact.scope, fact.sourceThreadId);
      await this.#outbox(tx, 'item', input.id, 'upsert', createKnowledgeUlid(), fact.scope);
      return { ...fact, deletedAt: undefined, deletedBy: undefined };
    });
  }

  async rescopeItem(input: { id: string; scope: KnowledgeScope }): Promise<KnowledgeItem> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#transaction(async tx => {
      const fact = await this.#getItem(tx, input.id, true);
      if (!fact) throw new KnowledgeNotFoundError('item', input.id);
      assertKnowledgeScopeWithinCeiling(scope, fact.maxScope);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_ITEMS}" SET scope=jsonb(?),scopeKey=? WHERE id=?`,
        args: [JSON.stringify(scope), knowledgeScopeKey(scope), input.id],
      });
      await this.#activity(tx, 'item-rescoped', 'item', input.id, scope, fact.sourceThreadId);
      if (knowledgeScopeKey(fact.scope) !== knowledgeScopeKey(scope))
        await this.#outbox(tx, 'item', input.id, 'delete', createKnowledgeUlid(), fact.scope);
      if (!fact.deletedAt) await this.#outbox(tx, 'item', input.id, 'upsert', createKnowledgeUlid(), scope);
      return { ...fact, scope };
    });
  }

  async raiseCeiling(input: { id: string; maxScope?: KnowledgeItem['maxScope'] }): Promise<KnowledgeItem> {
    return this.#transaction(async tx => {
      const fact = await this.#getItem(tx, input.id, true);
      if (!fact) throw new KnowledgeNotFoundError('item', input.id);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_ITEMS}" SET maxScope=? WHERE id=?`,
        args: [input.maxScope ?? null, input.id],
      });
      return { ...fact, maxScope: input.maxScope };
    });
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const normalizedQuery = input.query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return [];
    const query = `%${escapeLikePattern(normalizedQuery)}%`;
    const records = await this.#executor.execute({
      sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE mergedInto IS NULL AND ${visibleSql} AND (canonicalName LIKE ? ESCAPE '=' OR lower(COALESCE(kind,'')) LIKE ? ESCAPE '=' OR lower(COALESCE(content,'')) LIKE ? ESCAPE '=') ORDER BY updatedAt DESC LIMIT ?`,
      args: [key, key, query, query, query, input.limit ?? 20],
    });
    const results: SearchKnowledgeResult[] = records.rows.map(row => ({
      type: String(row.type) as 'node',
      id: String(row.id),
      recordId: String(row.id),
      name: String(row.name),
      text: row.content ? `${String(row.name)}\n${String(row.content)}` : String(row.name),
      scope: parseJson<KnowledgeScope>(row.scopeJson),
    }));
    if (results.length < (input.limit ?? 20)) {
      const facts = await this.#executor.execute({
        sql: `SELECT f.*,f.scope AS "scopeJson",r.name,r.scope AS "parentScopeJson" FROM "${TABLE_KNOWLEDGE_ITEMS}" f JOIN "${TABLE_KNOWLEDGE_RECORDS}" r ON r.id=f.parentNodeId AND r.type='node' AND r.mergedInto IS NULL WHERE f.deletedAt IS NULL AND ${visibleSql.replaceAll('scopeKey', 'f.scopeKey')} AND lower(f.text) LIKE ? ESCAPE '=' ORDER BY f.id DESC LIMIT ?`,
        args: [key, key, query, (input.limit ?? 20) - results.length],
      });
      results.push(
        ...facts.rows.map(row => {
          const parentVisible = isKnowledgeScopeVisible(parseJson<KnowledgeScope>(row.parentScopeJson), scope);
          return {
            type: 'item' as const,
            id: String(row.id),
            recordId: String(row.parentNodeId),
            name: parentVisible ? String(row.name) : '(private node)',
            text: String(row.text),
            scope: parseJson<KnowledgeScope>(row.scopeJson),
          };
        }),
      );
    }
    return results;
  }

  async getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    const result = await this.#executor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_CURSORS}" WHERE sourceThreadId=? AND agent=?`,
      args: [input.sourceThreadId, input.agent],
    });
    const row = result.rows[0];
    return row
      ? {
          sourceThreadId: String(row.sourceThreadId),
          agent: String(row.agent),
          lastItemId: String(row.lastItemId),
          updatedAt: toDate(row.updatedAt),
        }
      : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastItemId: string;
  }): Promise<KnowledgeCurationCursor> {
    const updatedAt = new Date();
    const result = await this.#executor.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_CURSORS}" (sourceThreadId,agent,lastItemId,updatedAt) VALUES (?,?,?,?) ON CONFLICT(sourceThreadId,agent) DO UPDATE SET lastItemId=excluded.lastItemId,updatedAt=excluded.updatedAt WHERE excluded.lastItemId >= "${TABLE_KNOWLEDGE_CURSORS}".lastItemId`,
      args: [input.sourceThreadId, input.agent, input.lastItemId, updatedAt.toISOString()],
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
    const result = await this.#executor.execute({
      sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_ACTIVITY}" WHERE ${visibleSql}${input.after ? ' AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
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
    const args: QueryValues = [];
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
    const result = await this.#executor.execute({
      sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY createdAt ASC,id ASC LIMIT ?`,
      args,
    });
    return result.rows.map(parseOutbox);
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    const now = input.now ?? new Date();
    const stale = new Date(now.getTime() - (input.claimTimeoutMs ?? 60_000));
    return this.#transaction(async tx => {
      const clauses = [
        `availableAt <= ?`,
        `(status='pending' OR (status='processing' AND claimedAt <= ?))`,
        `NOT EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" AS earlier WHERE earlier.documentId = "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}".documentId AND earlier.status != 'completed' AND (earlier.createdAt < "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}".createdAt OR (earlier.createdAt = "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}".createdAt AND earlier.id < "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}".id)))`,
      ];
      const args: QueryValues = [now.toISOString(), stale.toISOString()];
      if (input.scope) {
        const key = knowledgeScopeKey(canonicalizeKnowledgeScope(input.scope));
        clauses.push(visibleSql);
        args.push(key, key);
      }
      args.push(input.limit ?? 100);
      const selected = await tx.execute({
        sql: `SELECT id FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" WHERE ${clauses.join(' AND ')} ORDER BY createdAt ASC,id ASC LIMIT ? FOR UPDATE SKIP LOCKED`,
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
        sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY createdAt ASC,id ASC`,
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

  async #transaction<T>(operation: (tx: Executor) => Promise<T>): Promise<T> {
    return this.#client.tx(tx => operation(createExecutor(tx, this.#schemaName)));
  }
  async #getNode(executor: Executor, id: string): Promise<KnowledgeNode | null> {
    const result = await executor.execute({
      sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=? AND type='node'`,
      args: [id],
    });
    return result.rows[0] ? parseEntity(result.rows[0]) : null;
  }
  async #getNodeByName(executor: Executor, name: string, scope: KnowledgeScope): Promise<KnowledgeNode | null> {
    const result = await executor.execute({
      sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE type='node' AND scopeKey=? AND canonicalName=?`,
      args: [knowledgeScopeKey(scope), canonicalName(name)],
    });
    return result.rows[0] ? parseEntity(result.rows[0]) : null;
  }
  async #resolveNode(executor: Executor, name: string, scope: KnowledgeScope): Promise<KnowledgeNode | null> {
    for (let length = scope.length; length > 0; length--) {
      const entity = await this.#getNodeByName(executor, name, scope.slice(0, length));
      if (entity) {
        const terminal = await this.#resolveTerminalNode(executor, entity.id);
        if (terminal && isKnowledgeScopeVisible(terminal.scope, scope)) return terminal;
      }
    }
    return null;
  }
  async #resolveTerminalNode(executor: Executor, id: string): Promise<KnowledgeNode | null> {
    let entity = await this.#getNode(executor, id);
    const seen = new Set<string>();
    while (entity?.mergedInto) {
      if (seen.has(entity.id)) throw new Error(`Knowledge merge cycle detected at ${entity.id}`);
      seen.add(entity.id);
      entity = await this.#getNode(executor, entity.mergedInto);
    }
    return entity;
  }
  async #getItem(executor: Executor, id: string, includeDeleted: boolean): Promise<KnowledgeItem | null> {
    const result = await executor.execute({
      sql: `SELECT *,scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_ITEMS}" WHERE id=?${includeDeleted ? '' : ' AND deletedAt IS NULL'}`,
      args: [id],
    });
    return result.rows[0] ? parseFact(result.rows[0]) : null;
  }

  async #listFacts(input: ListKnowledgeItemsInput, touching: boolean): Promise<ListKnowledgeItemsOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const entity = await this.#resolveTerminalNode(this.#executor, input.nodeId);
    if (!entity) return { items: [] };
    const key = knowledgeScopeKey(scope);
    const args: QueryValues = [entity.id, ...(touching ? [entity.id] : []), key, key];
    if (input.after) args.push(input.after);
    args.push((input.limit ?? 100) + 1);
    const result = await this.#executor.execute({
      sql: `SELECT DISTINCT f.*,f.scope AS "scopeJson" FROM "${TABLE_KNOWLEDGE_ITEMS}" f${touching ? ` LEFT JOIN "${TABLE_KNOWLEDGE_MENTIONS}" m ON m.sourceType='item' AND m.sourceId=f.id` : ''} WHERE ${touching ? '(f.parentNodeId=? OR m.recordId=?)' : 'f.parentNodeId=?'} AND ${visibleSql.replaceAll('scopeKey', 'f.scopeKey')}${input.includeDeleted ? '' : ' AND f.deletedAt IS NULL'}${input.after ? ' AND f.id < ?' : ''} ORDER BY f.id DESC LIMIT ?`,
      args,
    });
    const facts = result.rows.map(parseFact);
    const limit = input.limit ?? 100;
    return { items: facts.slice(0, limit), nextCursor: facts.length > limit ? facts[limit - 1]?.id : undefined };
  }

  async #replaceMentions(
    tx: Executor,
    sourceType: 'item' | 'node',
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
      let entity = await this.#resolveNode(tx, name, resolutionScope);
      if (!entity) {
        entity = await this.#getNodeByName(tx, name, defaultScope);
        if (entity) entity = await this.#resolveTerminalNode(tx, entity.id);
        if (!entity) {
          const now = new Date();
          entity = {
            id: crypto.randomUUID(),
            type: 'node',
            name,
            kind: 'node',
            scope: defaultScope,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
          await tx.execute({
            sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,type,name,canonicalName,kind,content,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,NULL,jsonb(?),?,?,NULL,?,?)`,
            args: [
              entity.id,
              'node',
              entity.name,
              canonicalName(entity.name),
              entity.kind,
              JSON.stringify(defaultScope),
              knowledgeScopeKey(defaultScope),
              1,
              now.toISOString(),
            ],
          });
          await this.#activity(tx, 'node-created', 'node', entity.id, defaultScope);
          await this.#outbox(tx, 'node', entity.id, 'upsert', 1, defaultScope);
        }
      }
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_MENTIONS}" (sourceType,sourceId,recordId) VALUES (?,?,?) ON CONFLICT DO NOTHING`,
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
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (id,idempotencyKey,documentId,documentType,operation,scope,scopeKey,status,attempts,availableAt,claimedAt,claimedBy,createdAt,completedAt) VALUES (?,?,?,?,?,jsonb(?),?,'pending',0,?,NULL,NULL,?,NULL) ON CONFLICT DO NOTHING`,
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
