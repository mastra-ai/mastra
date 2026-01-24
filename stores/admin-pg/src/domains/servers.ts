import type { RunningServer, HealthStatus } from '@mastra/admin';
import { AdminPgDB, TABLES } from '../db';
import type { PgDomainConfig } from './utils';
import { resolvePgConfig } from './utils';

export class RunningServersPG {
  private db: AdminPgDB;

  static readonly MANAGED_TABLES = [TABLES.running_servers] as const;

  constructor(config: PgDomainConfig) {
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.db = new AdminPgDB({ client, schemaName, skipDefaultIndexes });
  }

  async createRunningServer(data: Omit<RunningServer, 'stoppedAt'>): Promise<RunningServer> {
    return this.db.insert<Omit<RunningServer, 'id'>>(TABLES.running_servers, {
      ...data,
      stoppedAt: null,
    } as unknown as Record<string, unknown>);
  }

  async getServerById(id: string): Promise<RunningServer | null> {
    return this.db.findById<RunningServer>(TABLES.running_servers, id);
  }

  async getServerForDeployment(deploymentId: string): Promise<RunningServer | null> {
    return this.db.findOneBy<RunningServer>(TABLES.running_servers, {
      deploymentId,
      stoppedAt: null,
    });
  }

  async updateServer(
    id: string,
    data: Partial<Omit<RunningServer, 'id' | 'deploymentId' | 'buildId' | 'startedAt'>>,
  ): Promise<RunningServer | null> {
    return this.db.update<Omit<RunningServer, 'id'>>(TABLES.running_servers, id, data as unknown as Record<string, unknown>);
  }

  async updateHealthStatus(
    id: string,
    status: HealthStatus,
    metrics?: { memoryUsageMb?: number; cpuPercent?: number },
  ): Promise<RunningServer | null> {
    return this.updateServer(id, {
      healthStatus: status,
      lastHealthCheck: new Date(),
      ...metrics,
    });
  }

  async stopServer(id: string): Promise<RunningServer | null> {
    return this.updateServer(id, {
      healthStatus: 'stopping',
      stoppedAt: new Date(),
    });
  }

  async listRunningServers(): Promise<RunningServer[]> {
    return this.db.findBy<RunningServer>(
      TABLES.running_servers,
      { stoppedAt: null },
      { orderBy: 'started_at DESC' },
    );
  }

  async listServersForDeployment(deploymentId: string, options?: { limit?: number }): Promise<RunningServer[]> {
    return this.db.findBy<RunningServer>(
      TABLES.running_servers,
      { deploymentId },
      { orderBy: 'started_at DESC', limit: options?.limit },
    );
  }

  async getUnhealthyServers(thresholdMinutes: number = 5): Promise<RunningServer[]> {
    const sql = `
      SELECT * FROM "${this.db.schemaName}"."${TABLES.running_servers}"
      WHERE stopped_at IS NULL
        AND (
          health_status = 'unhealthy'
          OR (last_health_check IS NOT NULL AND last_health_check < NOW() - INTERVAL '${thresholdMinutes} minutes')
        )
      ORDER BY started_at DESC
    `;
    return this.db.query<RunningServer>(sql);
  }

  async cleanupStoppedServers(olderThanDays: number = 7): Promise<number> {
    const sql = `
      DELETE FROM "${this.db.schemaName}"."${TABLES.running_servers}"
      WHERE stopped_at IS NOT NULL
        AND stopped_at < NOW() - INTERVAL '${olderThanDays} days'
      RETURNING id
    `;
    const result = await this.db.query<{ id: string }>(sql);
    return result.length;
  }
}
