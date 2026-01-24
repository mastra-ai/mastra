import type { Build, BuildStatus } from '@mastra/admin';
import { AdminPgDB, TABLES } from '../db';
import type { PgDomainConfig } from './utils';
import { resolvePgConfig } from './utils';

export class BuildsPG {
  private db: AdminPgDB;

  static readonly MANAGED_TABLES = [TABLES.builds] as const;

  constructor(config: PgDomainConfig) {
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.db = new AdminPgDB({ client, schemaName, skipDefaultIndexes });
  }

  async createBuild(data: Omit<Build, 'startedAt' | 'completedAt'>): Promise<Build> {
    return this.db.insert<Omit<Build, 'id'>>(TABLES.builds, {
      ...data,
      startedAt: null,
      completedAt: null,
    } as unknown as Record<string, unknown>);
  }

  async getBuildById(id: string): Promise<Build | null> {
    return this.db.findById<Build>(TABLES.builds, id);
  }

  async updateBuild(id: string, data: Partial<Omit<Build, 'id' | 'deploymentId' | 'queuedAt'>>): Promise<Build | null> {
    return this.db.update<Omit<Build, 'id'>>(TABLES.builds, id, data as unknown as Record<string, unknown>);
  }

  async updateBuildStatus(id: string, status: BuildStatus, errorMessage?: string): Promise<Build | null> {
    const updates: Partial<Build> = { status };

    if (status === 'building') {
      updates.startedAt = new Date();
    } else if (['succeeded', 'failed', 'cancelled'].includes(status)) {
      updates.completedAt = new Date();
    }

    if (errorMessage !== undefined) {
      updates.errorMessage = errorMessage;
    }

    return this.updateBuild(id, updates);
  }

  async appendBuildLogs(id: string, logs: string): Promise<void> {
    const sql = `
      UPDATE "${this.db.schemaName}"."${TABLES.builds}"
      SET logs = COALESCE(logs, '') || $1
      WHERE id = $2
    `;
    await this.db.db.none(sql, [logs, id]);
  }

  async deleteBuild(id: string): Promise<boolean> {
    return this.db.delete(TABLES.builds, id);
  }

  async listBuilds(
    deploymentId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: Build[]; total: number }> {
    const total = await this.db.count(TABLES.builds, { deploymentId });
    const data = await this.db.findBy<Build>(
      TABLES.builds,
      { deploymentId },
      { ...options, orderBy: 'created_at DESC' },
    );
    return { data, total };
  }

  // Build queue operations

  /**
   * Dequeue the next build for processing.
   * Uses FOR UPDATE SKIP LOCKED for concurrent-safe dequeue.
   */
  async dequeue(): Promise<Build | null> {
    const sql = `
      UPDATE "${this.db.schemaName}"."${TABLES.builds}"
      SET status = 'building', started_at = NOW()
      WHERE id = (
        SELECT id FROM "${this.db.schemaName}"."${TABLES.builds}"
        WHERE status = 'queued'
        ORDER BY queued_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *
    `;
    const rows = await this.db.query<Build>(sql);
    return rows[0] || null;
  }

  async getQueuePosition(buildId: string): Promise<number> {
    const build = await this.getBuildById(buildId);
    if (!build || build.status !== 'queued') return -1;

    const sql = `
      SELECT COUNT(*) as position
      FROM "${this.db.schemaName}"."${TABLES.builds}"
      WHERE status = 'queued' AND queued_at < $1
    `;
    const result = await this.db.db.one<{ position: string }>(sql, [build.queuedAt]);
    return parseInt(result.position, 10) + 1;
  }

  async getQueueLength(): Promise<number> {
    return this.db.count(TABLES.builds, { status: 'queued' });
  }

  async cancelQueuedBuilds(deploymentId: string): Promise<number> {
    const sql = `
      UPDATE "${this.db.schemaName}"."${TABLES.builds}"
      SET status = 'cancelled', completed_at = NOW()
      WHERE deployment_id = $1 AND status = 'queued'
      RETURNING id
    `;
    const result = await this.db.query<{ id: string }>(sql, [deploymentId]);
    return result.length;
  }
}
