import { join, resolve, isAbsolute } from 'node:path';
import { createClient } from '@libsql/client/web';
import type { Client, InValue } from '@libsql/client/web';

import type { MetricResult, TestInfo } from '../../eval';
import type { MessageType, StorageThreadType } from '../../memory/types';
import { MastraStorage } from '../base';
import { TABLE_EVALS, TABLE_MESSAGES, TABLE_THREADS, TABLE_TRACES, TABLE_WORKFLOW_SNAPSHOT } from '../constants';
import type { TABLE_NAMES } from '../constants';
import type { StorageColumn, StorageGetMessagesArg, EvalRow } from '../types';

function safelyParseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
}

export interface LibSQLConfig {
  url: string;
  authToken?: string;
}

export class LibSQLStore extends MastraStorage {
  private client: Client;

  constructor({ config }: { config: LibSQLConfig }) {
    super({ name: `LibSQLStore` });

    // need to re-init every time for in memory dbs or the tables might not exist
    if (config.url === ':memory:' || config.url.startsWith('file::memory:')) {
      this.shouldCacheInit = false;
    }

    this.client = createClient({
      url: this.rewriteDbUrl(config.url),
      authToken: config.authToken,
    });
  }

  // If we're in the .mastra/output directory, use the dir outside .mastra dir
  // reason we need to do this is libsql relative file paths are based on cwd, not current file path
  // since mastra dev sets cwd to .mastra/output this means running an agent directly vs running with mastra dev
  // will put db files in different locations, leading to an inconsistent experience between the two.
  // Ex: with `file:ex.db`
  // 1. `mastra dev`: ${cwd}/.mastra/output/ex.db
  // 2. `tsx src/index.ts`: ${cwd}/ex.db
  // so if we're in .mastra/output we need to rewrite the file url to be relative to the project root dir
  // or the experience will be inconsistent
  // this means `file:` urls are always relative to project root
  // TODO: can we make this easier via bundling? https://github.com/mastra-ai/mastra/pull/2783#pullrequestreview-2662444241
  protected rewriteDbUrl(url: string): string {
    if (url.startsWith('file:') && url !== 'file::memory:') {
      const pathPart = url.slice('file:'.length);

      if (isAbsolute(pathPart)) {
        return url;
      }

      const cwd = process.cwd();

      if (cwd.includes('.mastra') && (cwd.endsWith(`output`) || cwd.endsWith(`output/`) || cwd.endsWith(`output\\`))) {
        const baseDir = join(cwd, `..`, `..`); // <- .mastra/output/../../

        const fullPath = resolve(baseDir, pathPart);

        this.logger.debug(
          `Initializing LibSQL db with url ${url} with relative file path from inside .mastra/output directory. Rewriting relative file url to "file:${fullPath}". This ensures it's outside the .mastra/output directory.`,
        );

        return `file:${fullPath}`;
      }
    }

    return url;
  }

  private getCreateTableSQL(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): string {
    const columns = Object.entries(schema).map(([name, col]) => {
      let type = col.type.toUpperCase();
      if (type === 'TEXT') type = 'TEXT';
      if (type === 'TIMESTAMP') type = 'TEXT'; // Store timestamps as ISO strings
      // if (type === 'BIGINT') type = 'INTEGER';

      const nullable = col.nullable ? '' : 'NOT NULL';
      const primaryKey = col.primaryKey ? 'PRIMARY KEY' : '';

      return `${name} ${type} ${nullable} ${primaryKey}`.trim();
    });

    // For workflow_snapshot table, create a composite primary key
    if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
      const stmnt = `CREATE TABLE IF NOT EXISTS ${tableName} (
                ${columns.join(',\n')},
                PRIMARY KEY (workflow_name, run_id)
            )`;
      return stmnt;
    }

    return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      this.logger.debug(`Creating database table`, { tableName, operation: 'schema init' });
      const sql = this.getCreateTableSQL(tableName, schema);
      await this.client.execute(sql);
    } catch (error) {
      this.logger.error(`Error creating table ${tableName}: ${error}`);
      throw error;
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.client.execute(`DELETE FROM ${tableName}`);
    } catch (e) {
      if (e instanceof Error) {
        this.logger.error(e.message);
      }
    }
  }

  private prepareStatement({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): {
    sql: string;
    args: InValue[];
  } {
    const columns = Object.keys(record);
    const values = Object.values(record).map(v => {
      if (typeof v === `undefined`) {
        // returning an undefined value will cause libsql to throw
        return null;
      }
      if (v instanceof Date) {
        return v.toISOString();
      }
      return typeof v === 'object' ? JSON.stringify(v) : v;
    });
    const placeholders = values.map(() => '?').join(', ');

    return {
      sql: `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      args: values,
    };
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      await this.client.execute(
        this.prepareStatement({
          tableName,
          record,
        }),
      );
    } catch (error) {
      this.logger.error(`Error upserting into table ${tableName}: ${error}`);
      throw error;
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (records.length === 0) return;

    try {
      const batchStatements = records.map(r => this.prepareStatement({ tableName, record: r }));
      await this.client.batch(batchStatements, 'write');
    } catch (error) {
      this.logger.error(`Error upserting into table ${tableName}: ${error}`);
      throw error;
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const conditions = Object.entries(keys)
      .map(([key]) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(keys);

    const result = await this.client.execute({
      sql: `SELECT * FROM ${tableName} WHERE ${conditions} ORDER BY createdAt DESC LIMIT 1`,
      args: values,
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    // Checks whether the string looks like a JSON object ({}) or array ([])
    // If the string starts with { or [, it assumes it's JSON and parses it
    // Otherwise, it just returns, preventing unintended number conversions
    const parsed = Object.fromEntries(
      Object.entries(row || {}).map(([k, v]) => {
        try {
          return [k, typeof v === 'string' ? (v.startsWith('{') || v.startsWith('[') ? JSON.parse(v) : v) : v];
        } catch {
          return [k, v];
        }
      }),
    );

    return parsed as R;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const result = await this.load<StorageThreadType>({
      tableName: TABLE_THREADS,
      keys: { id: threadId },
    });

    if (!result) {
      return null;
    }

    return {
      ...result,
      metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
    };
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_THREADS} WHERE resourceId = ?`,
      args: [resourceId],
    });

    if (!result.rows) {
      return [];
    }

    return result.rows.map(thread => ({
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
    })) as any as StorageThreadType[];
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await this.insert({
      tableName: TABLE_THREADS,
      record: {
        ...thread,
        metadata: JSON.stringify(thread.metadata),
      },
    });

    return thread;
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const thread = await this.getThreadById({ threadId: id });
    if (!thread) {
      throw new Error(`Thread ${id} not found`);
    }

    const updatedThread = {
      ...thread,
      title,
      metadata: {
        ...thread.metadata,
        ...metadata,
      },
    };

    await this.client.execute({
      sql: `UPDATE ${TABLE_THREADS} SET title = ?, metadata = ? WHERE id = ?`,
      args: [title, JSON.stringify(updatedThread.metadata), id],
    });

    return updatedThread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await this.client.execute({
      sql: `DELETE FROM ${TABLE_THREADS} WHERE id = ?`,
      args: [threadId],
    });
    // Messages will be automatically deleted due to CASCADE constraint
  }

  private parseRow(row: any): MessageType {
    let content = row.content;
    try {
      content = JSON.parse(row.content);
    } catch {
      // use content as is if it's not JSON
    }
    return {
      id: row.id,
      content,
      role: row.role,
      type: row.type,
      createdAt: new Date(row.createdAt as string),
      threadId: row.thread_id,
    } as MessageType;
  }

  async getMessages<T extends MessageType[]>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    try {
      const messages: MessageType[] = [];
      const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;

      // If we have specific messages to select
      if (selectBy?.include?.length) {
        const includeIds = selectBy.include.map(i => i.id);
        const maxPrev = Math.max(...selectBy.include.map(i => i.withPreviousMessages || 0));
        const maxNext = Math.max(...selectBy.include.map(i => i.withNextMessages || 0));

        // Get messages around all specified IDs in one query using row numbers
        const includeResult = await this.client.execute({
          sql: `
            WITH numbered_messages AS (
              SELECT 
                id,
                content,
                role,
                type,
                "createdAt",
                thread_id,
                ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
              FROM "${TABLE_MESSAGES}"
              WHERE thread_id = ?
            ),
            target_positions AS (
              SELECT row_num as target_pos
              FROM numbered_messages
              WHERE id IN (${includeIds.map(() => '?').join(', ')})
            )
            SELECT DISTINCT m.*
            FROM numbered_messages m
            CROSS JOIN target_positions t
            WHERE m.row_num BETWEEN (t.target_pos - ?) AND (t.target_pos + ?)
            ORDER BY m."createdAt" ASC
          `,
          args: [threadId, ...includeIds, maxPrev, maxNext],
        });

        if (includeResult.rows) {
          messages.push(...includeResult.rows.map((row: any) => this.parseRow(row)));
        }
      }

      // Get remaining messages, excluding already fetched IDs
      const excludeIds = messages.map(m => m.id);
      const remainingSql = `
        SELECT 
          id, 
          content, 
          role, 
          type,
          "createdAt", 
          thread_id
        FROM "${TABLE_MESSAGES}"
        WHERE thread_id = ?
        ${excludeIds.length ? `AND id NOT IN (${excludeIds.map(() => '?').join(', ')})` : ''}
        ORDER BY "createdAt" DESC
        LIMIT ?
      `;
      const remainingArgs = [threadId, ...(excludeIds.length ? excludeIds : []), limit];

      const remainingResult = await this.client.execute({
        sql: remainingSql,
        args: remainingArgs,
      });

      if (remainingResult.rows) {
        messages.push(...remainingResult.rows.map((row: any) => this.parseRow(row)));
      }

      // Sort all messages by creation date
      messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return messages as T;
    } catch (error) {
      this.logger.error('Error getting messages:', error as Error);
      throw error;
    }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return messages;

    const tx = await this.client.transaction('write');

    try {
      const threadId = messages[0]?.threadId;
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      for (const message of messages) {
        const time = message.createdAt || new Date();
        await tx.execute({
          sql: `INSERT INTO ${TABLE_MESSAGES} (id, thread_id, content, role, type, createdAt) 
                              VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            message.id,
            threadId,
            typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
            message.role,
            message.type,
            time instanceof Date ? time.toISOString() : time,
          ],
        });
      }

      await tx.commit();

      return messages;
    } catch (error) {
      this.logger.error('Failed to save messages in database: ' + (error as any)?.message);
      await tx.rollback();
      throw error;
    }
  }

  private transformEvalRow(row: Record<string, any>): EvalRow {
    const resultValue = JSON.parse(row.result as string);
    const testInfoValue = row.test_info ? JSON.parse(row.test_info as string) : undefined;

    if (!resultValue || typeof resultValue !== 'object' || !('score' in resultValue)) {
      throw new Error(`Invalid MetricResult format: ${JSON.stringify(resultValue)}`);
    }

    return {
      input: row.input as string,
      output: row.output as string,
      result: resultValue as MetricResult,
      agentName: row.agent_name as string,
      metricName: row.metric_name as string,
      instructions: row.instructions as string,
      testInfo: testInfoValue as TestInfo,
      globalRunId: row.global_run_id as string,
      runId: row.run_id as string,
      createdAt: row.created_at as string,
    };
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const baseQuery = `SELECT * FROM ${TABLE_EVALS} WHERE agent_name = ?`;
      const typeCondition =
        type === 'test'
          ? " AND test_info IS NOT NULL AND test_info->>'testPath' IS NOT NULL"
          : type === 'live'
            ? " AND (test_info IS NULL OR test_info->>'testPath' IS NULL)"
            : '';

      const result = await this.client.execute({
        sql: `${baseQuery}${typeCondition} ORDER BY created_at DESC`,
        args: [agentName],
      });

      return result.rows?.map(row => this.transformEvalRow(row)) ?? [];
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('no such table')) {
        return [];
      }
      this.logger.error('Failed to get evals for the specified agent: ' + (error as any)?.message);
      throw error;
    }
  }

  // TODO: add types
  async getTraces(
    {
      name,
      scope,
      page,
      perPage,
      attributes,
    }: { name?: string; scope?: string; page: number; perPage: number; attributes?: Record<string, string> } = {
      page: 0,
      perPage: 100,
    },
  ): Promise<any[]> {
    const limit = perPage;
    const offset = page * perPage;

    const args: (string | number)[] = [];

    const conditions: string[] = [];
    if (name) {
      conditions.push("name LIKE CONCAT(?, '%')");
    }
    if (scope) {
      conditions.push('scope = ?');
    }
    if (attributes) {
      Object.keys(attributes).forEach(key => {
        conditions.push(`attributes->>'$.${key}' = ?`);
      });
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (name) {
      args.push(name);
    }

    if (scope) {
      args.push(scope);
    }

    if (attributes) {
      for (const [_key, value] of Object.entries(attributes)) {
        args.push(value);
      }
    }

    args.push(limit, offset);

    const result = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_TRACES} ${whereClause} ORDER BY "startTime" DESC LIMIT ? OFFSET ?`,
      args,
    });

    if (!result.rows) {
      return [];
    }

    return result.rows.map(row => ({
      id: row.id,
      parentSpanId: row.parentSpanId,
      traceId: row.traceId,
      name: row.name,
      scope: row.scope,
      kind: row.kind,
      status: safelyParseJSON(row.status as string),
      events: safelyParseJSON(row.events as string),
      links: safelyParseJSON(row.links as string),
      attributes: safelyParseJSON(row.attributes as string),
      startTime: row.startTime,
      endTime: row.endTime,
      other: safelyParseJSON(row.other as string),
      createdAt: row.createdAt,
    })) as any;
  }
}

export { LibSQLStore as DefaultStorage };
