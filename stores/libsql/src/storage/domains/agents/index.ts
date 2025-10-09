import type { Client } from '@libsql/client';
import { TABLE_AGENTS, AgentsStorage } from '@mastra/core/storage';
import type { StorageAgentType, CreateAgentConfig } from '@mastra/core/storage';
import type { StoreOperationsLibSQL } from '../operations';

export class AgentsLibSQL extends AgentsStorage {
  operations: StoreOperationsLibSQL;
  client: Client;

  constructor({ operations, client }: { operations: StoreOperationsLibSQL; client: Client }) {
    super();
    this.operations = operations;
    this.client = client;
  }

  async createAgent(config: CreateAgentConfig): Promise<void> {
    const now = new Date().toISOString();

    await this.client.execute({
      sql: `INSERT INTO ${TABLE_AGENTS} 
            (id, name, description, workflowIds, agentIds, toolIds, model, instructions, memoryConfig, createdAt, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        config.id,
        config.name,
        config.description ?? null,
        JSON.stringify(config.workflowIds ?? []),
        JSON.stringify(config.agentIds ?? []),
        JSON.stringify(config.toolIds ?? []),
        config.model,
        config.instructions,
        config.memoryConfig ? JSON.stringify(config.memoryConfig) : null,
        now,
        now,
      ],
    });
  }

  async getAgent(id: string): Promise<StorageAgentType | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_AGENTS} WHERE id = ?`,
      args: [id],
    });

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;

    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description ? (row.description as string) : undefined,
      workflowIds: JSON.parse(row.workflowIds as string),
      agentIds: JSON.parse(row.agentIds as string),
      toolIds: JSON.parse(row.toolIds as string),
      model: row.model as string,
      instructions: row.instructions as string,
      memoryConfig: row.memoryConfig ? JSON.parse(row.memoryConfig as string) : undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  async listAgents(): Promise<StorageAgentType[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_AGENTS} ORDER BY createdAt DESC`,
      args: [],
    });

    if (!result.rows || result.rows.length === 0) {
      return [];
    }

    return result.rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description ? (row.description as string) : undefined,
      workflowIds: JSON.parse(row.workflowIds as string),
      agentIds: JSON.parse(row.agentIds as string),
      toolIds: JSON.parse(row.toolIds as string),
      model: row.model as string,
      instructions: row.instructions as string,
      memoryConfig: row.memoryConfig ? JSON.parse(row.memoryConfig as string) : undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    }));
  }

  async updateAgent(id: string, updates: Partial<Omit<CreateAgentConfig, 'id'>>): Promise<StorageAgentType | null> {
    // First, get the existing agent
    const existing = await this.getAgent(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();

    // Build the update statement dynamically based on what's being updated
    const setClauses: string[] = [];
    const args: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      args.push(updates.name);
    }

    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      args.push(updates.description);
    }

    if (updates.workflowIds !== undefined) {
      setClauses.push('workflowIds = ?');
      args.push(JSON.stringify(updates.workflowIds));
    }

    if (updates.agentIds !== undefined) {
      setClauses.push('agentIds = ?');
      args.push(JSON.stringify(updates.agentIds));
    }

    if (updates.toolIds !== undefined) {
      setClauses.push('toolIds = ?');
      args.push(JSON.stringify(updates.toolIds));
    }

    if (updates.model !== undefined) {
      setClauses.push('model = ?');
      args.push(updates.model);
    }

    if (updates.instructions !== undefined) {
      setClauses.push('instructions = ?');
      args.push(updates.instructions);
    }

    if (updates.memoryConfig !== undefined) {
      setClauses.push('memoryConfig = ?');
      args.push(updates.memoryConfig ? JSON.stringify(updates.memoryConfig) : null);
    }

    // Always update the updatedAt timestamp
    setClauses.push('updatedAt = ?');
    args.push(now);

    // Add the id to the end for the WHERE clause
    args.push(id);

    await this.client.execute({
      sql: `UPDATE ${TABLE_AGENTS} SET ${setClauses.join(', ')} WHERE id = ?`,
      args,
    });

    return this.getAgent(id);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.client.execute({
      sql: `DELETE FROM ${TABLE_AGENTS} WHERE id = ?`,
      args: [id],
    });
  }
}
