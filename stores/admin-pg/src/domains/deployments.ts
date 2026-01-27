import type { Pool } from 'pg';
import type { Deployment, DeploymentStorage, DeploymentStatus, EncryptedEnvVar } from '@mastra/admin';
import { safeArray } from '@mastra/admin';

interface DomainConfig {
  pool: Pool;
  schema: string;
}

export class DeploymentsPostgres implements DeploymentStorage {
  #pool: Pool;
  #schema: string;

  constructor(config: DomainConfig) {
    this.#pool = config.pool;
    this.#schema = config.schema;
  }

  async create(data: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deployment> {
    const result = await this.#pool.query(
      `INSERT INTO ${this.#schema}.deployments
       (project_id, type, branch, slug, status, current_build_id, public_url, port, process_id, env_var_overrides)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.projectId,
        data.type,
        data.branch,
        data.slug,
        data.status,
        data.currentBuildId,
        data.publicUrl,
        data.port,
        data.processId,
        JSON.stringify(data.envVarOverrides),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async getById(id: string): Promise<Deployment | null> {
    const result = await this.#pool.query(`SELECT * FROM ${this.#schema}.deployments WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listByProject(projectId: string): Promise<Deployment[]> {
    const result = await this.#pool.query(
      `SELECT * FROM ${this.#schema}.deployments WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return result.rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  async listByStatus(status: DeploymentStatus): Promise<Deployment[]> {
    const result = await this.#pool.query(
      `SELECT * FROM ${this.#schema}.deployments WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  async update(id: string, data: Partial<Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Deployment> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.projectId !== undefined) {
      fields.push(`project_id = $${paramIndex++}`);
      values.push(data.projectId);
    }
    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }
    if (data.branch !== undefined) {
      fields.push(`branch = $${paramIndex++}`);
      values.push(data.branch);
    }
    if (data.slug !== undefined) {
      fields.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.currentBuildId !== undefined) {
      fields.push(`current_build_id = $${paramIndex++}`);
      values.push(data.currentBuildId);
    }
    if (data.publicUrl !== undefined) {
      fields.push(`public_url = $${paramIndex++}`);
      values.push(data.publicUrl);
    }
    if (data.port !== undefined) {
      fields.push(`port = $${paramIndex++}`);
      values.push(data.port);
    }
    if (data.processId !== undefined) {
      fields.push(`process_id = $${paramIndex++}`);
      values.push(data.processId);
    }
    if (data.envVarOverrides !== undefined) {
      fields.push(`env_var_overrides = $${paramIndex++}`);
      values.push(JSON.stringify(data.envVarOverrides));
    }

    if (fields.length === 0) {
      const existing = await this.getById(id);
      if (!existing) throw new Error('Deployment not found');
      return existing;
    }

    values.push(id);
    const result = await this.#pool.query(
      `UPDATE ${this.#schema}.deployments SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (!result.rows[0]) {
      throw new Error('Deployment not found');
    }
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.#pool.query(`DELETE FROM ${this.#schema}.deployments WHERE id = $1`, [id]);
  }

  private mapRow(row: Record<string, unknown>): Deployment {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      type: row.type as 'production' | 'staging' | 'preview',
      branch: row.branch as string,
      slug: row.slug as string,
      status: row.status as DeploymentStatus,
      currentBuildId: (row.current_build_id as string) ?? null,
      publicUrl: (row.public_url as string) ?? null,
      port: (row.port as number) ?? null,
      processId: (row.process_id as number) ?? null,
      envVarOverrides: safeArray<EncryptedEnvVar>(row.env_var_overrides),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
