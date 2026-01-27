import type { Pool } from 'pg';
import type { Build, BuildStorage, BuildStatus } from '@mastra/admin';

interface DomainConfig {
  pool: Pool;
  schema: string;
}

export class BuildsPostgres implements BuildStorage {
  #pool: Pool;
  #schema: string;

  constructor(config: DomainConfig) {
    this.#pool = config.pool;
    this.#schema = config.schema;
  }

  async create(data: Omit<Build, 'id' | 'createdAt'>): Promise<Build> {
    const result = await this.#pool.query(
      `INSERT INTO ${this.#schema}.builds
       (deployment_id, trigger, status, log_path, queued_at, started_at, completed_at, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        data.deploymentId,
        data.trigger,
        data.status,
        data.logPath,
        data.queuedAt,
        data.startedAt,
        data.completedAt,
        data.errorMessage,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async getById(id: string): Promise<Build | null> {
    const result = await this.#pool.query(`SELECT * FROM ${this.#schema}.builds WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listByDeployment(deploymentId: string): Promise<Build[]> {
    const result = await this.#pool.query(
      `SELECT * FROM ${this.#schema}.builds WHERE deployment_id = $1 ORDER BY created_at DESC`,
      [deploymentId],
    );
    return result.rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  async listByStatus(status: BuildStatus): Promise<Build[]> {
    const result = await this.#pool.query(
      `SELECT * FROM ${this.#schema}.builds WHERE status = $1 ORDER BY queued_at ASC`,
      [status],
    );
    return result.rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  async update(id: string, data: Partial<Omit<Build, 'id' | 'createdAt'>>): Promise<Build> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.deploymentId !== undefined) {
      fields.push(`deployment_id = $${paramIndex++}`);
      values.push(data.deploymentId);
    }
    if (data.trigger !== undefined) {
      fields.push(`trigger = $${paramIndex++}`);
      values.push(data.trigger);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.logPath !== undefined) {
      fields.push(`log_path = $${paramIndex++}`);
      values.push(data.logPath);
    }
    if (data.queuedAt !== undefined) {
      fields.push(`queued_at = $${paramIndex++}`);
      values.push(data.queuedAt);
    }
    if (data.startedAt !== undefined) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(data.startedAt);
    }
    if (data.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(data.completedAt);
    }
    if (data.errorMessage !== undefined) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(data.errorMessage);
    }

    if (fields.length === 0) {
      const existing = await this.getById(id);
      if (!existing) throw new Error('Build not found');
      return existing;
    }

    values.push(id);
    const result = await this.#pool.query(
      `UPDATE ${this.#schema}.builds SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (!result.rows[0]) {
      throw new Error('Build not found');
    }
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: Record<string, unknown>): Build {
    return {
      id: row.id as string,
      deploymentId: row.deployment_id as string,
      trigger: row.trigger as 'manual' | 'webhook' | 'schedule',
      status: row.status as BuildStatus,
      logPath: (row.log_path as string) ?? null,
      queuedAt: new Date(row.queued_at as string),
      startedAt: row.started_at ? new Date(row.started_at as string) : null,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
      errorMessage: (row.error_message as string) ?? null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
