import {
  inspectKnowledgePagesSchema,
  KNOWLEDGE_PAGES_SCHEMA_VERSION,
  KNOWLEDGE_RESETTABLE_TABLE_NAMES,
  TABLE_KNOWLEDGE_PAGES_STATE,
} from '@internal/core/knowledge-compat';
import { KnowledgeSchemaResetRequiredError, KnowledgeStorage } from '@mastra/core/storage';
import type { KnowledgePageStore } from '@mastra/core/storage';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';
import { KNOWLEDGE_PAGE_DDL, MySQLKnowledgePages } from './pages';

export class KnowledgeMySQL extends KnowledgeStorage {
  static getExportDDL(): string[] {
    return KNOWLEDGE_PAGE_DDL.map(statement => `${statement};`);
  }

  readonly #pool: Pool;
  readonly #pages: MySQLKnowledgePages;

  constructor({ pool }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.#pool = pool;
    const rawExecutor = (client: Pick<Pool, 'query'> | Pick<PoolConnection, 'query'>) => ({
      async execute(statement: { sql: string; args?: (string | number | null)[] }) {
        const [result] = await client.query(statement.sql, statement.args ?? []);
        return { rows: Array.isArray(result) ? (result as RowDataPacket[]) : [] };
      },
    });
    this.#pages = new MySQLKnowledgePages({
      read: rawExecutor(pool),
      transaction: async operation => {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const result = await operation(rawExecutor(connection));
          await connection.commit();
          return result;
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      },
    });
  }

  // Schema-4 page store: delegates to MySQLKnowledgePages.
  async #inspectPages() {
    const exec = async (sql: string) => {
      const [rows] = await this.#pool.query(sql);
      return rows as RowDataPacket[];
    };
    const tables = await exec(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'mastra\\_knowledge\\_%'",
    );
    const tableNames = tables.map(row => String(row.name));
    let schemaVersion: number | undefined;
    if (tableNames.includes(TABLE_KNOWLEDGE_PAGES_STATE)) {
      const state = await exec(`SELECT schemaVersion FROM \`${TABLE_KNOWLEDGE_PAGES_STATE}\` WHERE id = 'knowledge'`);
      if (state[0]) schemaVersion = Number(state[0].schemaVersion);
    }
    return inspectKnowledgePagesSchema({ tableNames, schemaVersion });
  }

  override async inspectSchema() {
    return this.#inspectPages();
  }

  override async init(): Promise<void> {
    const inspection = await this.#inspectPages();
    if (inspection.status === 'incompatible-reset-required') throw new KnowledgeSchemaResetRequiredError(inspection);
    for (const statement of KNOWLEDGE_PAGE_DDL) await this.#pool.query(statement);
    await this.#pool.query(
      `INSERT IGNORE INTO \`${TABLE_KNOWLEDGE_PAGES_STATE}\` (id, schemaVersion) VALUES ('knowledge', ?)`,
      [KNOWLEDGE_PAGES_SCHEMA_VERSION],
    );
  }

  override async dangerouslyReset(): Promise<void> {
    for (const table of KNOWLEDGE_RESETTABLE_TABLE_NAMES) await this.#pool.query(`DROP TABLE IF EXISTS \`${table}\``);
    await this.init();
  }

  override materializeScope(
    input: Parameters<KnowledgePageStore['materializeScope']>[0],
  ): ReturnType<KnowledgePageStore['materializeScope']> {
    return this.#pages.materializeScope(input);
  }

  override getScopesByAddress(
    input: Parameters<KnowledgePageStore['getScopesByAddress']>[0],
  ): ReturnType<KnowledgePageStore['getScopesByAddress']> {
    return this.#pages.getScopesByAddress(input);
  }

  override listChildScopes(
    input: Parameters<KnowledgePageStore['listChildScopes']>[0],
  ): ReturnType<KnowledgePageStore['listChildScopes']> {
    return this.#pages.listChildScopes(input);
  }

  override getPage(input: Parameters<KnowledgePageStore['getPage']>[0]): ReturnType<KnowledgePageStore['getPage']> {
    return this.#pages.getPage(input);
  }

  override getPageByPath(
    input: Parameters<KnowledgePageStore['getPageByPath']>[0],
  ): ReturnType<KnowledgePageStore['getPageByPath']> {
    return this.#pages.getPageByPath(input);
  }

  override findPagesByName(
    input: Parameters<KnowledgePageStore['findPagesByName']>[0],
  ): ReturnType<KnowledgePageStore['findPagesByName']> {
    return this.#pages.findPagesByName(input);
  }

  override listChildPages(
    input: Parameters<KnowledgePageStore['listChildPages']>[0],
  ): ReturnType<KnowledgePageStore['listChildPages']> {
    return this.#pages.listChildPages(input);
  }

  override listPages(
    input: Parameters<KnowledgePageStore['listPages']>[0],
  ): ReturnType<KnowledgePageStore['listPages']> {
    return this.#pages.listPages(input);
  }

  override createPage(
    input: Parameters<KnowledgePageStore['createPage']>[0],
  ): ReturnType<KnowledgePageStore['createPage']> {
    return this.#pages.createPage(input);
  }

  override updatePage(
    input: Parameters<KnowledgePageStore['updatePage']>[0],
  ): ReturnType<KnowledgePageStore['updatePage']> {
    return this.#pages.updatePage(input);
  }

  override movePage(input: Parameters<KnowledgePageStore['movePage']>[0]): ReturnType<KnowledgePageStore['movePage']> {
    return this.#pages.movePage(input);
  }

  override mergePages(
    input: Parameters<KnowledgePageStore['mergePages']>[0],
  ): ReturnType<KnowledgePageStore['mergePages']> {
    return this.#pages.mergePages(input);
  }

  override deletePage(
    input: Parameters<KnowledgePageStore['deletePage']>[0],
  ): ReturnType<KnowledgePageStore['deletePage']> {
    return this.#pages.deletePage(input);
  }

  override getNote(input: Parameters<KnowledgePageStore['getNote']>[0]): ReturnType<KnowledgePageStore['getNote']> {
    return this.#pages.getNote(input);
  }

  override listNotes(
    input: Parameters<KnowledgePageStore['listNotes']>[0],
  ): ReturnType<KnowledgePageStore['listNotes']> {
    return this.#pages.listNotes(input);
  }

  override listNotesMentioning(
    input: Parameters<KnowledgePageStore['listNotesMentioning']>[0],
  ): ReturnType<KnowledgePageStore['listNotesMentioning']> {
    return this.#pages.listNotesMentioning(input);
  }

  override addNote(input: Parameters<KnowledgePageStore['addNote']>[0]): ReturnType<KnowledgePageStore['addNote']> {
    return this.#pages.addNote(input);
  }

  override restampNote(
    input: Parameters<KnowledgePageStore['restampNote']>[0],
  ): ReturnType<KnowledgePageStore['restampNote']> {
    return this.#pages.restampNote(input);
  }

  override removeNote(
    input: Parameters<KnowledgePageStore['removeNote']>[0],
  ): ReturnType<KnowledgePageStore['removeNote']> {
    return this.#pages.removeNote(input);
  }

  override restoreNote(
    input: Parameters<KnowledgePageStore['restoreNote']>[0],
  ): ReturnType<KnowledgePageStore['restoreNote']> {
    return this.#pages.restoreNote(input);
  }

  override searchPages(
    input: Parameters<KnowledgePageStore['searchPages']>[0],
  ): ReturnType<KnowledgePageStore['searchPages']> {
    return this.#pages.searchPages(input);
  }

  override listPageActivity(
    input: Parameters<KnowledgePageStore['listPageActivity']>[0],
  ): ReturnType<KnowledgePageStore['listPageActivity']> {
    return this.#pages.listPageActivity(input);
  }

  override addPinAudience(
    input: Parameters<KnowledgePageStore['addPinAudience']>[0],
  ): ReturnType<KnowledgePageStore['addPinAudience']> {
    return this.#pages.addPinAudience(input);
  }

  override removePinAudience(
    input: Parameters<KnowledgePageStore['removePinAudience']>[0],
  ): ReturnType<KnowledgePageStore['removePinAudience']> {
    return this.#pages.removePinAudience(input);
  }

  override listPins(input: Parameters<KnowledgePageStore['listPins']>[0]): ReturnType<KnowledgePageStore['listPins']> {
    return this.#pages.listPins(input);
  }

  override async dangerouslyClearAll(): Promise<void> {
    await this.#pages.clearAll();
  }
}
