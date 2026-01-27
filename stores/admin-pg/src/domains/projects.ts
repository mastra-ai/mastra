import type { Pool } from 'pg';
import type { Project, ProjectStorage, EncryptedEnvVar } from '@mastra/admin';
import { safeArray } from '@mastra/admin';

interface DomainConfig {
  pool: Pool;
  schema: string;
}

export class ProjectsPostgres implements ProjectStorage {
  #pool: Pool;
  #schema: string;

  constructor(config: DomainConfig) {
    this.#pool = config.pool;
    this.#schema = config.schema;
  }

  async create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const result = await this.#pool.query(
      `INSERT INTO ${this.#schema}.projects
       (team_id, name, slug, source_type, source_config, default_branch, env_vars)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.teamId,
        data.name,
        data.slug,
        data.sourceType,
        JSON.stringify(data.sourceConfig),
        data.defaultBranch,
        JSON.stringify(data.envVars),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async getById(id: string): Promise<Project | null> {
    const result = await this.#pool.query(`SELECT * FROM ${this.#schema}.projects WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getBySlug(teamId: string, slug: string): Promise<Project | null> {
    const result = await this.#pool.query(
      `SELECT * FROM ${this.#schema}.projects WHERE team_id = $1 AND slug = $2`,
      [teamId, slug],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listByTeam(teamId: string): Promise<Project[]> {
    const result = await this.#pool.query(
      `SELECT * FROM ${this.#schema}.projects WHERE team_id = $1 ORDER BY created_at DESC`,
      [teamId],
    );
    return result.rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  async update(id: string, data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.teamId !== undefined) {
      fields.push(`team_id = $${paramIndex++}`);
      values.push(data.teamId);
    }
    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      fields.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }
    if (data.sourceType !== undefined) {
      fields.push(`source_type = $${paramIndex++}`);
      values.push(data.sourceType);
    }
    if (data.sourceConfig !== undefined) {
      fields.push(`source_config = $${paramIndex++}`);
      values.push(JSON.stringify(data.sourceConfig));
    }
    if (data.defaultBranch !== undefined) {
      fields.push(`default_branch = $${paramIndex++}`);
      values.push(data.defaultBranch);
    }
    if (data.envVars !== undefined) {
      fields.push(`env_vars = $${paramIndex++}`);
      values.push(JSON.stringify(data.envVars));
    }

    if (fields.length === 0) {
      const existing = await this.getById(id);
      if (!existing) throw new Error('Project not found');
      return existing;
    }

    values.push(id);
    const result = await this.#pool.query(
      `UPDATE ${this.#schema}.projects SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (!result.rows[0]) {
      throw new Error('Project not found');
    }
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.#pool.query(`DELETE FROM ${this.#schema}.projects WHERE id = $1`, [id]);
  }

  private mapRow(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      teamId: row.team_id as string,
      name: row.name as string,
      slug: row.slug as string,
      sourceType: row.source_type as 'local' | 'github',
      sourceConfig: (row.source_config as Record<string, unknown>) ?? {},
      defaultBranch: row.default_branch as string,
      envVars: safeArray<EncryptedEnvVar>(row.env_vars),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
