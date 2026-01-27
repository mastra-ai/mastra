import type { Pool } from 'pg';
import type { Team, TeamStorage } from '@mastra/admin';

interface DomainConfig {
  pool: Pool;
  schema: string;
}

export class TeamsPostgres implements TeamStorage {
  #pool: Pool;
  #schema: string;

  constructor(config: DomainConfig) {
    this.#pool = config.pool;
    this.#schema = config.schema;
  }

  async create(data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>): Promise<Team> {
    const result = await this.#pool.query(
      `INSERT INTO ${this.#schema}.teams (name, slug) VALUES ($1, $2) RETURNING *`,
      [data.name, data.slug],
    );
    return this.mapRow(result.rows[0]);
  }

  async getById(id: string): Promise<Team | null> {
    const result = await this.#pool.query(`SELECT * FROM ${this.#schema}.teams WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getBySlug(slug: string): Promise<Team | null> {
    const result = await this.#pool.query(`SELECT * FROM ${this.#schema}.teams WHERE slug = $1`, [slug]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(): Promise<Team[]> {
    const result = await this.#pool.query(`SELECT * FROM ${this.#schema}.teams ORDER BY created_at DESC`);
    return result.rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  async update(id: string, data: Partial<Pick<Team, 'name' | 'slug'>>): Promise<Team> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      fields.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }

    if (fields.length === 0) {
      const existing = await this.getById(id);
      if (!existing) throw new Error('Team not found');
      return existing;
    }

    values.push(id);
    const result = await this.#pool.query(
      `UPDATE ${this.#schema}.teams SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (!result.rows[0]) {
      throw new Error('Team not found');
    }
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.#pool.query(`DELETE FROM ${this.#schema}.teams WHERE id = $1`, [id]);
  }

  private mapRow(row: Record<string, unknown>): Team {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
