import type { Deployment, DeploymentStatus } from '@mastra/admin';
import { AdminPgDB, TABLES } from '../db';
import type { PgDomainConfig } from './utils';
import { resolvePgConfig } from './utils';

export class DeploymentsPG {
  private db: AdminPgDB;

  static readonly MANAGED_TABLES = [TABLES.deployments] as const;

  constructor(config: PgDomainConfig) {
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.db = new AdminPgDB({ client, schemaName, skipDefaultIndexes });
  }

  async createDeployment(data: Omit<Deployment, 'createdAt' | 'updatedAt'>): Promise<Deployment> {
    return this.db.insert<Omit<Deployment, 'id'>>(TABLES.deployments, data as unknown as Record<string, unknown>);
  }

  async getDeploymentById(id: string): Promise<Deployment | null> {
    return this.db.findById<Deployment>(TABLES.deployments, id);
  }

  async getDeploymentBySlug(projectId: string, slug: string): Promise<Deployment | null> {
    return this.db.findOneBy<Deployment>(TABLES.deployments, { projectId, slug });
  }

  async updateDeployment(id: string, data: Partial<Omit<Deployment, 'id' | 'projectId' | 'createdAt'>>): Promise<Deployment | null> {
    return this.db.update<Omit<Deployment, 'id'>>(TABLES.deployments, id, data as unknown as Record<string, unknown>);
  }

  async updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<Deployment | null> {
    return this.updateDeployment(id, { status });
  }

  async setCurrentBuild(deploymentId: string, buildId: string | null): Promise<Deployment | null> {
    return this.updateDeployment(deploymentId, { currentBuildId: buildId });
  }

  async deleteDeployment(id: string): Promise<boolean> {
    return this.db.delete(TABLES.deployments, id);
  }

  async listDeployments(
    projectId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: Deployment[]; total: number }> {
    const total = await this.db.count(TABLES.deployments, { projectId });
    const data = await this.db.findBy<Deployment>(
      TABLES.deployments,
      { projectId },
      { ...options, orderBy: 'created_at DESC' },
    );
    return { data, total };
  }

  async getProductionDeployment(projectId: string): Promise<Deployment | null> {
    return this.db.findOneBy<Deployment>(TABLES.deployments, {
      projectId,
      type: 'production',
    });
  }

  async listActiveDeployments(projectId: string): Promise<Deployment[]> {
    return this.db.findBy<Deployment>(
      TABLES.deployments,
      { projectId, status: ['running', 'building', 'pending'] },
      { orderBy: 'created_at DESC' },
    );
  }

  async cleanupExpiredPreviews(): Promise<number> {
    const sql = `
      DELETE FROM "${this.db.schemaName}"."${TABLES.deployments}"
      WHERE type = 'preview' AND expires_at < NOW()
      RETURNING id
    `;
    const result = await this.db.query<{ id: string }>(sql);
    return result.length;
  }
}
