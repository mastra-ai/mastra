import { TABLE_WORKFLOW_SNAPSHOT } from '../../constants';
import type { TABLE_NAMES, TABLE_OBSERVATIONAL_MEMORY } from '../../constants';
import type { StorageColumn } from '../../types';
import { StoreOperations } from './base';

// InMemory storage supports all tables including observational memory
type InMemoryTableNames = TABLE_NAMES | typeof TABLE_OBSERVATIONAL_MEMORY;

export class StoreOperationsInMemory extends StoreOperations {
  data: Record<InMemoryTableNames, Map<string, Record<string, any>>>;

  constructor() {
    super();
    this.data = {
      mastra_workflow_snapshot: new Map(),
      mastra_messages: new Map(),
      mastra_threads: new Map(),
      mastra_traces: new Map(),
      mastra_resources: new Map(),
      mastra_scorers: new Map(),
      mastra_ai_spans: new Map(),
      mastra_agents: new Map(),
      mastra_agent_versions: new Map(),
      mastra_observational_memory: new Map(),
      mastra_prompt_blocks: new Map(),
      mastra_prompt_block_versions: new Map(),
      mastra_scorer_definitions: new Map(),
      mastra_scorer_definition_versions: new Map(),
      mastra_mcp_clients: new Map(),
      mastra_mcp_client_versions: new Map(),
      mastra_mcp_servers: new Map(),
      mastra_mcp_server_versions: new Map(),
      mastra_workspaces: new Map(),
      mastra_workspace_versions: new Map(),
      mastra_skills: new Map(),
      mastra_skill_versions: new Map(),
      mastra_skill_blobs: new Map(),
      mastra_datasets: new Map(),
      mastra_dataset_items: new Map(),
      mastra_dataset_versions: new Map(),
      mastra_experiments: new Map(),
      mastra_experiment_results: new Map(),
    };
  }

  getDatabase() {
    return this.data;
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const table = this.data[tableName];
    let key = record.id;
    if ([TABLE_WORKFLOW_SNAPSHOT].includes(tableName) && !record.id && record.run_id) {
      key = record.workflow_name ? `${record.workflow_name}-${record.run_id}` : record.run_id;
      record.id = key;
    } else if (!record.id) {
      key = `auto-${Date.now()}-${Math.random()}`;
      record.id = key;
    }
    table.set(key, record);
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    const table = this.data[tableName];
    for (const record of records) {
      let key = record.id;
      if ([TABLE_WORKFLOW_SNAPSHOT].includes(tableName) && !record.id && record.run_id) {
        key = record.run_id;
        record.id = key;
      } else if (!record.id) {
        key = `auto-${Date.now()}-${Math.random()}`;
        record.id = key;
      }
      table.set(key, record);
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    this.logger.debug(`MockStore: load called for ${tableName} with keys`, keys);

    const table = this.data[tableName];

    const records = Array.from(table.values());

    return records.filter(record => Object.keys(keys).every(key => record[key] === keys[key]))?.[0] as R | null;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    this.logger.debug(`MockStore: createTable called for ${tableName} with schema`, schema);

    this.data[tableName] = new Map();
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.logger.debug(`MockStore: clearTable called for ${tableName}`);

    this.data[tableName].clear();
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.logger.debug(`MockStore: dropTable called for ${tableName}`);
    this.data[tableName].clear();
  }

  async alterTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    this.logger.debug(`MockStore: alterTable called for ${tableName} with schema`, schema);
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    this.logger.debug(`MockStore: hasColumn called for ${table} with column ${column}`);
    return true;
  }
}
