import {
  assertKnowledgeCeilingRaised,
  assertKnowledgeScopeWithinCeiling,
  canonicalizeKnowledgeScope,
  createKnowledgeUlid,
  isKnowledgeScopeVisible,
  KNOWLEDGE_ACTIVITY_SCHEMA,
  KNOWLEDGE_CURSORS_SCHEMA,
  KNOWLEDGE_RECORDS_SCHEMA,
  KNOWLEDGE_MENTIONS_SCHEMA,
  KNOWLEDGE_NODES_SCHEMA,
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
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_NODES,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
} from '@mastra/core/storage';
import type {
  AppendKnowledgeInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  QueryKnowledgeBySourceInput,
  QueryKnowledgeInput,
  QueryKnowledgeOutput,
  ListKnowledgeNodesInput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  UpdateKnowledgeNodeInput,
} from '@mastra/core/storage';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { generateTableSQL } from '../operations';
import type { StoreOperationsMySQL } from '../operations';

// #21830 shipped this helper in core 1.63.1; resolve it lazily so an older
// installed core fails feature-detection instead of breaking module load.
let assertDescriptionWithinBound: ((description: string | undefined) => void) | undefined;
async function assertKnowledgeDescriptionWithinBoundCompat(description: string | undefined): Promise<void> {
  let assertWithinBound = assertDescriptionWithinBound;
  if (!assertWithinBound) {
    const mod: Partial<typeof import('@mastra/core/storage')> = await import('@mastra/core/storage');
    const resolvedAssert: (description: string | undefined) => void =
      mod.assertKnowledgeDescriptionWithinBound ??
      (value => {
        if (value !== undefined && value.length > 400) {
          throw new Error('Knowledge node description exceeds the 400 UTF-16 code unit limit');
        }
      });
    assertDescriptionWithinBound = resolvedAssert;
    assertWithinBound = resolvedAssert;
  }
  assertWithinBound(description);
}

interface QueryResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}

interface Executor {
  execute(statement: string | { sql: string; args?: unknown[] }): Promise<QueryResult>;
}

function mysqlSql(sql: string): string {
  return sql
    .replaceAll('jsonb(?)', 'CAST(? AS JSON)')
    .replaceAll('INSERT OR IGNORE', 'INSERT IGNORE')
    .replaceAll('"', '`');
}

function createExecutor(client: Pick<Pool, 'query'> | Pick<PoolConnection, 'query'>): Executor {
  return {
    async execute(statement) {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      const args = (typeof statement === 'string' ? [] : (statement.args ?? [])).map(value =>
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
          ? value.replace('T', ' ').replace('Z', '')
          : value,
      );
      const [result] = await client.query(mysqlSql(sql), args);
      if (Array.isArray(result)) return { rows: result as RowDataPacket[], rowsAffected: 0 };
      return { rows: [], rowsAffected: (result as ResultSetHeader).affectedRows };
    },
  };
}

const visibleSql = `(scopeKey = ? OR LEFT(?, CHAR_LENGTH(scopeKey) + 1) = CONCAT(scopeKey, char(31)))`;

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

function databaseTimestamp(value: Date): string {
  const pad = (part: number, width = 2) => String(part).padStart(width, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`;
}

function canonicalName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function nodeReferenceId(node: KnowledgeNode | string): string {
  return typeof node === 'string' ? node : node.id;
}

function escapeLikePattern(value: string): string {
  return value.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_');
}

function parseNode(row: Record<string, unknown>): KnowledgeNode {
  return {
    id: String(row.id),
    type: 'node',
    name: String(row.name),
    kind: String(row.kind),
    content: row.content == null ? undefined : String(row.content),
    description: row.description == null ? undefined : String(row.description),
    scope: parseJson(row.scopeJson ?? row.scope),
    version: Number(row.version),
    mergedInto: row.mergedInto == null ? undefined : String(row.mergedInto),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function parseKnowledge(row: Record<string, unknown>): KnowledgeRecord {
  return {
    id: String(row.id),
    node: String(row.node),
    text: String(row.text),
    scope: parseJson(row.scopeJson ?? row.scope),
    sourceThreadId: String(row.sourceThreadId),
    capturedAt: toDate(row.capturedAt),
    when: optionalDate(row.when),
    maxScope: row.maxScope == null ? undefined : (String(row.maxScope) as KnowledgeRecord['maxScope']),
    metadata: row.metadata == null ? undefined : parseJson<Record<string, unknown>>(row.metadata),
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

const KNOWLEDGE_INDEX_DDL = [
  `CREATE UNIQUE INDEX idx_knowledge_nodes_identity ON "${TABLE_KNOWLEDGE_NODES}" (type(32), scopeKey(255), canonicalName(255))`,
  `CREATE INDEX idx_knowledge_nodes_scope ON "${TABLE_KNOWLEDGE_NODES}" (scopeKey(255), type(32))`,
  `CREATE INDEX idx_knowledge_records_node_latest ON "${TABLE_KNOWLEDGE_RECORDS}" (node(191), id(26) DESC)`,
  `CREATE INDEX idx_knowledge_records_thread_latest ON "${TABLE_KNOWLEDGE_RECORDS}" (sourceThreadId(191), id(26) DESC)`,
  `CREATE INDEX idx_knowledge_mentions_record ON "${TABLE_KNOWLEDGE_MENTIONS}" (recordId(191), sourceType(32), sourceId(191))`,
  `CREATE INDEX idx_knowledge_activity_latest ON "${TABLE_KNOWLEDGE_ACTIVITY}" (id(26) DESC)`,
  `CREATE UNIQUE INDEX idx_knowledge_outbox_idempotency ON "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (idempotencyKey(255))`,
  `CREATE INDEX idx_knowledge_outbox_claim ON "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (status(32), availableAt, createdAt)`,
];

export class KnowledgeMySQL extends KnowledgeStorage {
  static getExportDDL(): string[] {
    return [
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_NODES, schema: KNOWLEDGE_NODES_SCHEMA }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_RECORDS, schema: KNOWLEDGE_RECORDS_SCHEMA }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_MENTIONS,
        schema: KNOWLEDGE_MENTIONS_SCHEMA,
        compositePrimaryKey: ['sourceType', 'sourceId', 'recordId'],
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_CURSORS,
        schema: KNOWLEDGE_CURSORS_SCHEMA,
        compositePrimaryKey: ['sourceThreadId', 'agent'],
      }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_ACTIVITY, schema: KNOWLEDGE_ACTIVITY_SCHEMA }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, schema: KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA }),
      ...KNOWLEDGE_INDEX_DDL.map(mysqlSql),
    ];
  }

  readonly #pool: Pool;
  readonly #client: Executor;
  readonly #operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.#pool = pool;
    this.#client = createExecutor(pool);
    this.#operations = operations;
  }

  async init(): Promise<void> {
    await this.#operations.createTable({ tableName: TABLE_KNOWLEDGE_NODES, schema: KNOWLEDGE_NODES_SCHEMA });
    // Add description column for backwards compatibility with existing databases
    await this.#operations.alterTable({
      tableName: TABLE_KNOWLEDGE_NODES,
      schema: KNOWLEDGE_NODES_SCHEMA,
      ifNotExists: ['description'],
    });
    await this.#operations.createTable({ tableName: TABLE_KNOWLEDGE_RECORDS, schema: KNOWLEDGE_RECORDS_SCHEMA });
    await this.#operations.createTable({
      tableName: TABLE_KNOWLEDGE_MENTIONS,
      schema: KNOWLEDGE_MENTIONS_SCHEMA,
    });
    await this.#operations.createTable({
      tableName: TABLE_KNOWLEDGE_CURSORS,
      schema: KNOWLEDGE_CURSORS_SCHEMA,
    });
    await this.#operations.createTable({ tableName: TABLE_KNOWLEDGE_ACTIVITY, schema: KNOWLEDGE_ACTIVITY_SCHEMA });
    await this.#operations.createTable({
      tableName: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
      schema: KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
    });
    for (const sql of KNOWLEDGE_INDEX_DDL) {
      try {
        await this.#client.execute(sql);
      } catch (error) {
        if ((error as { code?: string }).code !== 'ER_DUP_KEYNAME') throw error;
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#transaction(async tx => {
      for (const table of [
        TABLE_KNOWLEDGE_MENTIONS,
        TABLE_KNOWLEDGE_RECORDS,
        TABLE_KNOWLEDGE_NODES,
        TABLE_KNOWLEDGE_CURSORS,
        TABLE_KNOWLEDGE_ACTIVITY,
        TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
      ]) {
        await tx.execute(`DELETE FROM "${table}"`);
      }
    });
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    await assertKnowledgeDescriptionWithinBoundCompat(input.description);
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#transaction(async tx => {
      const existing = await this.#getNodeByName(tx, input.name, scope);
      if (existing) {
        const terminal = (await this.#resolveTerminalNode(tx, existing.id))!;
        if (!isKnowledgeScopeVisible(terminal.scope, scope)) {
          throw new Error(`Merged knowledge node is not visible from scope: ${input.name}`);
        }
        return terminal;
      }
      const now = new Date();
      const node: KnowledgeNode = {
        id: input.id ?? crypto.randomUUID(),
        type: 'node',
        name: input.name.trim(),
        kind: input.kind,
        content: input.content,
        description: input.description,
        scope,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODES}" (id,type,name,canonicalName,kind,content,description,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,jsonb(?),?,?,NULL,?,?)`,
        args: [
          node.id,
          'node',
          node.name,
          canonicalName(node.name),
          node.kind,
          node.content ?? null,
          node.description ?? null,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          node.version,
          now.toISOString(),
          now.toISOString(),
        ],
      });
      await this.#replaceMentions(tx, 'node', node.id, node.content ?? '', input.resolutionScope ?? scope, scope);
      await this.#activity(tx, 'node-created', 'node', node.id, scope);
      await this.#outbox(tx, 'node', node.id, 'upsert', node.version, scope);
      return node;
    });
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.#getNode(this.#client, id);
  }

  async getNodeByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    return this.#getNodeByName(this.#client, input.name, canonicalizeKnowledgeScope(input.scope));
  }

  async resolveNode(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    return this.#resolveNode(this.#client, input.name, canonicalizeKnowledgeScope(input.scope));
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const clauses = [`type = 'node'`, 'mergedInto IS NULL', visibleSql];
    const args: unknown[] = [key, key];
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
      const updatedAt = databaseTimestamp(cursor.updatedAt);
      clauses.push('(updatedAt < ? OR (updatedAt = ? AND (name > ? OR (name = ? AND id > ?))))');
      args.push(updatedAt, updatedAt, cursor.name, cursor.name, cursor.id);
    }
    args.push(input.limit ?? 100);
    const result = await this.#client.execute({
      sql: `SELECT *, scope AS scopeJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE ${clauses.join(' AND ')} ORDER BY updatedAt DESC, name ASC, id ASC LIMIT ?`,
      args,
    });
    return result.rows.map(parseNode);
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    await assertKnowledgeDescriptionWithinBoundCompat(input.description);
    return this.#transaction(async tx => {
      const existing = await this.#getNode(tx, input.id);
      if (!existing) throw new KnowledgeNotFoundError('node', input.id);
      if (existing.mergedInto) throw new Error(`Cannot update merged knowledge node: ${input.id}`);
      const scope = canonicalizeKnowledgeScope(input.scope ?? existing.scope);
      const name = (input.name ?? existing.name).trim();
      const content = input.content ?? existing.content;
      const description = input.description ?? existing.description;
      const now = new Date();
      const result = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_NODES}" SET name=?,canonicalName=?,kind=?,content=?,description=?,scope=jsonb(?),scopeKey=?,version=version+1,updatedAt=? WHERE id=? AND type='node' AND version=?`,
        args: [
          name,
          canonicalName(name),
          input.kind ?? existing.kind,
          content ?? null,
          description ?? null,
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
        const records = await tx.execute({
          sql: `SELECT id,scope AS scopeJson,deletedAt FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE node=?`,
          args: [input.id],
        });
        for (const row of records.rows) {
          const factScope = parseJson<KnowledgeScope>(row.scopeJson);
          await this.#outbox(tx, 'record', String(row.id), 'delete', createKnowledgeUlid(), factScope);
          if (row.deletedAt == null) {
            await this.#outbox(tx, 'record', String(row.id), 'upsert', createKnowledgeUlid(), factScope);
          }
        }
      }
      await this.#outbox(tx, 'node', input.id, 'upsert', input.version + 1, scope);
      return {
        ...existing,
        name,
        kind: input.kind ?? existing.kind,
        content,
        description,
        scope,
        version: input.version + 1,
        updatedAt: now,
      };
    });
  }

  async mergeNodes(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeNode> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge node into itself');
    return this.#transaction(async tx => {
      const source = await this.#getNode(tx, input.sourceId);
      if (!source) throw new KnowledgeNotFoundError('node', input.sourceId);
      const target = await this.#resolveTerminalNode(tx, input.targetId);
      if (!target) throw new KnowledgeNotFoundError('node', input.targetId);
      if (target.id === source.id) throw new Error('Cannot create a knowledge merge cycle');
      if (!isKnowledgeScopeVisible(target.scope, source.scope)) {
        throw new Error('Cannot merge a knowledge node into a target that is narrower than its source scope');
      }
      const affected = await tx.execute({
        sql: `SELECT DISTINCT m.sourceType,m.sourceId,COALESCE(f.scope,r.scope) AS scopeJson,CASE WHEN f.deletedAt IS NULL THEN 0 ELSE 1 END AS deleted FROM "${TABLE_KNOWLEDGE_MENTIONS}" m LEFT JOIN "${TABLE_KNOWLEDGE_RECORDS}" f ON m.sourceType='record' AND f.id=m.sourceId LEFT JOIN "${TABLE_KNOWLEDGE_NODES}" r ON m.sourceType='node' AND r.id=m.sourceId WHERE m.recordId=?`,
        args: [source.id],
      });
      const movedFacts = await tx.execute({
        sql: `SELECT id,scope AS scopeJson,deletedAt FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE node=?`,
        args: [source.id],
      });
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_NODES}" SET mergedInto=?,version=version+1,updatedAt=? WHERE id=? AND type='node' AND version=? AND mergedInto IS NULL`,
        args: [target.id, new Date().toISOString(), source.id, input.sourceVersion],
      });
      if (updated.rowsAffected === 0) throw new KnowledgeConflictError(source.id);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET node=? WHERE node=?`,
        args: [target.id, source.id],
      });
      await tx.execute({
        sql: `DELETE source FROM "${TABLE_KNOWLEDGE_MENTIONS}" source JOIN "${TABLE_KNOWLEDGE_MENTIONS}" target ON target.sourceType=source.sourceType AND target.sourceId=source.sourceId WHERE source.recordId=? AND target.recordId=?`,
        args: [source.id, target.id],
      });
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_MENTIONS}" SET recordId=? WHERE recordId=?`,
        args: [target.id, source.id],
      });
      for (const row of movedFacts.rows)
        await this.#outbox(
          tx,
          'record',
          String(row.id),
          row.deletedAt == null ? 'upsert' : 'delete',
          createKnowledgeUlid(),
          parseJson(row.scopeJson),
        );
      for (const row of affected.rows)
        await this.#outbox(
          tx,
          String(row.sourceType) as 'record' | 'node',
          String(row.sourceId),
          Number(row.deleted) ? 'delete' : 'upsert',
          createKnowledgeUlid(),
          parseJson<KnowledgeScope>(row.scopeJson),
        );
      // Merge matrix: a target that NEVER had a description (undefined — '' is an explicit curator
      // clear and wins) adopts the source's; otherwise the target's state is preserved.
      let mergedTarget = target;
      if (target.description === undefined && source.description) {
        const adoptedAt = new Date();
        // Adoption is conditional on the target state this merge observed: a concurrent write (a new
        // description, or an intentional '' clear) bumps the version and loses the predicate, so the
        // merge leaves that newer value alone instead of clobbering it with the source's synopsis.
        const adopted = await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_NODES}" SET description=?,version=version+1,updatedAt=? WHERE id=? AND type='node' AND version=? AND description IS NULL`,
          args: [source.description, adoptedAt.toISOString(), target.id, target.version],
        });
        if (adopted.rowsAffected > 0) {
          mergedTarget = {
            ...target,
            description: source.description,
            version: target.version + 1,
            updatedAt: adoptedAt,
          };
          await this.#activity(tx, 'node-updated', 'node', target.id, target.scope);
        }
      }
      await this.#activity(tx, 'node-merged', 'node', source.id, source.scope);
      await this.#outbox(tx, 'node', source.id, 'delete', input.sourceVersion + 1, source.scope);
      await this.#outbox(tx, 'node', target.id, 'upsert', createKnowledgeUlid(), mergedTarget.scope);
      return mergedTarget;
    });
  }

  async appendKnowledge(input: AppendKnowledgeInput): Promise<KnowledgeRecord> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const resolutionScope = canonicalizeKnowledgeScope(input.resolutionScope);
    const defaultScope = canonicalizeKnowledgeScope(input.defaultScope);
    assertKnowledgeScopeWithinCeiling(scope, input.maxScope);
    return this.#transaction(async tx => {
      const parent = await this.#resolveTerminalNode(tx, nodeReferenceId(input.node));
      if (!parent) throw new KnowledgeNotFoundError('node', nodeReferenceId(input.node));
      const record: KnowledgeRecord = {
        id: input.id ?? createKnowledgeUlid(),
        node: parent.id,
        text: input.text,
        scope,
        sourceThreadId: input.sourceThreadId,
        capturedAt: new Date(),
        when: input.when ? new Date(input.when) : undefined,
        maxScope: input.maxScope,
        metadata: input.metadata,
      };
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,node,text,scope,scopeKey,sourceThreadId,capturedAt,"when",maxScope,metadata,deletedAt,deletedBy) VALUES (?,?,?,jsonb(?),?,?,?,?,?,jsonb(?),NULL,NULL)`,
        args: [
          record.id,
          record.node,
          record.text,
          JSON.stringify(scope),
          knowledgeScopeKey(scope),
          record.sourceThreadId,
          record.capturedAt.toISOString(),
          record.when?.toISOString() ?? null,
          record.maxScope ?? null,
          record.metadata ? JSON.stringify(record.metadata) : null,
        ],
      });
      await this.#replaceMentions(tx, 'record', record.id, record.text, resolutionScope, defaultScope);
      await this.#activity(tx, 'record-created', 'record', record.id, scope, record.sourceThreadId);
      await this.#outbox(tx, 'record', record.id, 'upsert', record.id, scope);
      return record;
    });
  }

  async getKnowledge(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null> {
    const result = await this.#client.execute({
      sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=?${input.includeDeleted ? '' : ' AND deletedAt IS NULL'}`,
      args: [input.id],
    });
    return result.rows[0] ? parseKnowledge(result.rows[0]) : null;
  }

  async listKnowledgeAbout(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput> {
    return this.#queryKnowledge(input, 'about');
  }
  async listKnowledgeMentioning(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput> {
    return this.#queryKnowledge(input, 'mentioning');
  }

  async listKnowledgeRelatedTo(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput> {
    return this.#queryKnowledge(input, 'related');
  }

  async knowledgeBySource(input: QueryKnowledgeBySourceInput): Promise<QueryKnowledgeOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const args: unknown[] = [input.sourceThreadId, key, key];
    if (input.after) args.push(input.after);
    const limit = input.limit ?? 100;
    args.push(limit + 1);
    const result = await this.#client.execute({
      sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE sourceThreadId=? AND ${visibleSql}${input.includeDeleted ? '' : ' AND deletedAt IS NULL'}${input.after ? ' AND id > ?' : ''} ORDER BY id ASC LIMIT ?`,
      args,
    });
    const records = result.rows.map(parseKnowledge);
    return {
      records: records.slice(0, limit),
      nextCursor: records.length > limit ? records[limit - 1]?.id : undefined,
    };
  }

  async removeKnowledge(input: { id: string; deletedBy: string }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      const record = await this.#getKnowledge(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (record.deletedAt) return record;
      const deletedAt = new Date();
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET deletedAt=?,deletedBy=? WHERE id=? AND deletedAt IS NULL`,
        args: [deletedAt.toISOString(), input.deletedBy, input.id],
      });
      await this.#activity(tx, 'record-deleted', 'record', input.id, record.scope, record.sourceThreadId);
      await this.#outbox(tx, 'record', input.id, 'delete', deletedAt.toISOString(), record.scope);
      return { ...record, deletedAt, deletedBy: input.deletedBy };
    });
  }

  async restoreKnowledge(input: { id: string }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      const record = await this.#getKnowledge(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (!record.deletedAt) return record;
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET deletedAt=NULL,deletedBy=NULL WHERE id=?`,
        args: [input.id],
      });
      await this.#activity(tx, 'record-restored', 'record', input.id, record.scope, record.sourceThreadId);
      await this.#outbox(tx, 'record', input.id, 'upsert', createKnowledgeUlid(), record.scope);
      return { ...record, deletedAt: undefined, deletedBy: undefined };
    });
  }

  async rescopeKnowledge(input: { id: string; scope: KnowledgeScope }): Promise<KnowledgeRecord> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#transaction(async tx => {
      const record = await this.#getKnowledge(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      assertKnowledgeScopeWithinCeiling(scope, record.maxScope);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET scope=jsonb(?),scopeKey=? WHERE id=?`,
        args: [JSON.stringify(scope), knowledgeScopeKey(scope), input.id],
      });
      await this.#activity(tx, 'record-rescoped', 'record', input.id, scope, record.sourceThreadId);
      if (knowledgeScopeKey(record.scope) !== knowledgeScopeKey(scope))
        await this.#outbox(tx, 'record', input.id, 'delete', createKnowledgeUlid(), record.scope);
      if (!record.deletedAt) await this.#outbox(tx, 'record', input.id, 'upsert', createKnowledgeUlid(), scope);
      return { ...record, scope };
    });
  }

  async raiseKnowledgeCeiling(input: { id: string; maxScope?: KnowledgeRecord['maxScope'] }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      const record = await this.#getKnowledge(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      assertKnowledgeScopeWithinCeiling(record.scope, input.maxScope);
      assertKnowledgeCeilingRaised(record.maxScope, input.maxScope);
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET maxScope=? WHERE id=?`,
        args: [input.maxScope ?? null, input.id],
      });
      return { ...record, maxScope: input.maxScope };
    });
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = knowledgeScopeKey(scope);
    const normalizedQuery = input.query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return [];
    const query = `%${escapeLikePattern(normalizedQuery)}%`;
    const records = await this.#client.execute({
      sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE mergedInto IS NULL AND ${visibleSql} AND (canonicalName LIKE ? ESCAPE '=' OR lower(COALESCE(kind,'')) LIKE ? ESCAPE '=' OR lower(COALESCE(content,'')) LIKE ? ESCAPE '=' OR lower(COALESCE(description,'')) LIKE ? ESCAPE '=') ORDER BY updatedAt DESC LIMIT ?`,
      args: [key, key, query, query, query, query, input.limit ?? 20],
    });
    const results: SearchKnowledgeResult[] = records.rows.map(row => ({
      type: String(row.type) as 'node',
      id: String(row.id),
      recordId: String(row.id),
      name: String(row.name),
      // Description joins the snippet only when present so description-less results stay byte-identical.
      text: [
        String(row.name),
        ...(row.description ? [String(row.description)] : []),
        ...(row.content ? [String(row.content)] : []),
      ].join('\n'),
      scope: parseJson<KnowledgeScope>(row.scopeJson),
    }));
    if (results.length < (input.limit ?? 20)) {
      const records = await this.#client.execute({
        sql: `SELECT f.*,f.scope AS scopeJson,r.name,r.scope AS parentScopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" f JOIN "${TABLE_KNOWLEDGE_NODES}" r ON r.id=f.node AND r.type='node' AND r.mergedInto IS NULL WHERE f.deletedAt IS NULL AND ${visibleSql.replaceAll('scopeKey', 'f.scopeKey')} AND lower(f.text) LIKE ? ESCAPE '=' ORDER BY f.id DESC LIMIT ?`,
        args: [key, key, query, (input.limit ?? 20) - results.length],
      });
      results.push(
        ...records.rows.map(row => {
          const parentVisible = isKnowledgeScopeVisible(parseJson<KnowledgeScope>(row.parentScopeJson), scope);
          return {
            type: 'record' as const,
            id: String(row.id),
            recordId: String(row.node),
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
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_CURSORS}" WHERE sourceThreadId=? AND agent=?`,
      args: [input.sourceThreadId, input.agent],
    });
    const row = result.rows[0];
    return row
      ? {
          sourceThreadId: String(row.sourceThreadId),
          agent: String(row.agent),
          lastKnowledgeId: String(row.lastKnowledgeId),
          updatedAt: toDate(row.updatedAt),
        }
      : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor> {
    const updatedAt = new Date();
    const result = await this.#client.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_CURSORS}" (sourceThreadId,agent,lastKnowledgeId,updatedAt) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE lastKnowledgeId=IF(VALUES(lastKnowledgeId) >= lastKnowledgeId, VALUES(lastKnowledgeId), lastKnowledgeId),updatedAt=IF(VALUES(lastKnowledgeId) >= lastKnowledgeId, VALUES(updatedAt), updatedAt)`,
      args: [input.sourceThreadId, input.agent, input.lastKnowledgeId, updatedAt.toISOString()],
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
      sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_ACTIVITY}" WHERE ${visibleSql}${input.after ? ' AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
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
    const args: unknown[] = [];
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
      sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY createdAt ASC,id ASC LIMIT ?`,
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
      const args: unknown[] = [now.toISOString(), stale.toISOString()];
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
        sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY createdAt ASC,id ASC`,
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
    const connection = await this.#pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await operation(createExecutor(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async #getNode(executor: Executor, id: string): Promise<KnowledgeNode | null> {
    const result = await executor.execute({
      sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE id=? AND type='node'`,
      args: [id],
    });
    return result.rows[0] ? parseNode(result.rows[0]) : null;
  }
  async #getNodeByName(executor: Executor, name: string, scope: KnowledgeScope): Promise<KnowledgeNode | null> {
    const result = await executor.execute({
      sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE type='node' AND scopeKey=? AND canonicalName=?`,
      args: [knowledgeScopeKey(scope), canonicalName(name)],
    });
    return result.rows[0] ? parseNode(result.rows[0]) : null;
  }
  async #resolveNode(executor: Executor, name: string, scope: KnowledgeScope): Promise<KnowledgeNode | null> {
    for (let length = scope.length; length > 0; length--) {
      const node = await this.#getNodeByName(executor, name, scope.slice(0, length));
      if (node) {
        const terminal = await this.#resolveTerminalNode(executor, node.id);
        if (terminal && isKnowledgeScopeVisible(terminal.scope, scope)) return terminal;
      }
    }
    return null;
  }
  async #resolveTerminalNode(executor: Executor, id: string): Promise<KnowledgeNode | null> {
    let node = await this.#getNode(executor, id);
    const seen = new Set<string>();
    while (node?.mergedInto) {
      if (seen.has(node.id)) throw new Error(`Knowledge merge cycle detected at ${node.id}`);
      seen.add(node.id);
      node = await this.#getNode(executor, node.mergedInto);
    }
    return node;
  }
  async #getKnowledge(executor: Executor, id: string, includeDeleted: boolean): Promise<KnowledgeRecord | null> {
    const result = await executor.execute({
      sql: `SELECT *,scope AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=?${includeDeleted ? '' : ' AND deletedAt IS NULL'}`,
      args: [id],
    });
    return result.rows[0] ? parseKnowledge(result.rows[0]) : null;
  }

  async #queryKnowledge(
    input: QueryKnowledgeInput,
    relationship: 'about' | 'mentioning' | 'related',
  ): Promise<QueryKnowledgeOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const node = await this.#resolveTerminalNode(this.#client, nodeReferenceId(input.node));
    if (!node) return { records: [] };
    const key = knowledgeScopeKey(scope);
    const args: unknown[] = [node.id, ...(relationship === 'related' ? [node.id] : []), key, key];
    if (input.after) args.push(input.after);
    args.push((input.limit ?? 100) + 1);
    const result = await this.#client.execute({
      sql: `SELECT DISTINCT f.*,f.scope AS scopeJson FROM "${TABLE_KNOWLEDGE_RECORDS}" f${relationship === 'about' ? '' : ` LEFT JOIN "${TABLE_KNOWLEDGE_MENTIONS}" m ON m.sourceType='record' AND m.sourceId=f.id`} WHERE ${relationship === 'about' ? 'f.node=?' : relationship === 'mentioning' ? 'm.recordId=?' : '(f.node=? OR m.recordId=?)'} AND ${visibleSql.replaceAll('scopeKey', 'f.scopeKey')}${input.includeDeleted ? '' : ' AND f.deletedAt IS NULL'}${input.after ? ' AND f.id < ?' : ''} ORDER BY f.id DESC LIMIT ?`,
      args,
    });
    const records = result.rows.map(parseKnowledge);
    const limit = input.limit ?? 100;
    return {
      records: records.slice(0, limit),
      nextCursor: records.length > limit ? records[limit - 1]?.id : undefined,
    };
  }

  async #replaceMentions(
    tx: Executor,
    sourceType: 'record' | 'node',
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
      let node = await this.#resolveNode(tx, name, resolutionScope);
      if (!node) {
        node = await this.#getNodeByName(tx, name, defaultScope);
        if (node) node = await this.#resolveTerminalNode(tx, node.id);
        if (!node) {
          const now = new Date();
          node = {
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
            sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODES}" (id,type,name,canonicalName,kind,content,scope,scopeKey,version,mergedInto,createdAt,updatedAt) VALUES (?,?,?,?,?,NULL,jsonb(?),?,?,NULL,?,?)`,
            args: [
              node.id,
              'node',
              node.name,
              canonicalName(node.name),
              node.kind,
              JSON.stringify(defaultScope),
              knowledgeScopeKey(defaultScope),
              1,
              now.toISOString(),
            ],
          });
          await this.#activity(tx, 'node-created', 'node', node.id, defaultScope);
          await this.#outbox(tx, 'node', node.id, 'upsert', 1, defaultScope);
        }
      }
      await tx.execute({
        sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_MENTIONS}" (sourceType,sourceId,recordId) VALUES (?,?,?)`,
        args: [sourceType, sourceId, node.id],
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
