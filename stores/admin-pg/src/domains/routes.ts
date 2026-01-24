import type { RouteInfo, RouteConfig, RouteStatus } from '@mastra/admin';
import { AdminPgDB, TABLES } from '../db';
import type { PgDomainConfig } from './utils';
import { resolvePgConfig } from './utils';

// Internal database representation
interface RouteRecord {
  id: string;
  deploymentId: string;
  projectId: string;
  subdomain: string;
  targetHost: string;
  targetPort: number;
  publicUrl: string;
  status: RouteStatus;
  tlsEnabled: boolean;
  providerRouteId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastHealthCheck: Date | null;
}

export class RoutesPG {
  private db: AdminPgDB;

  static readonly MANAGED_TABLES = [TABLES.routes] as const;

  constructor(config: PgDomainConfig) {
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.db = new AdminPgDB({ client, schemaName, skipDefaultIndexes });
  }

  async createRoute(config: RouteConfig & { publicUrl: string }): Promise<RouteInfo> {
    const record = await this.db.insert<Omit<RouteRecord, 'id'>>(TABLES.routes, {
      deploymentId: config.deploymentId,
      projectId: config.projectId,
      subdomain: config.subdomain,
      targetHost: config.targetHost,
      targetPort: config.targetPort,
      publicUrl: config.publicUrl,
      status: 'pending',
      tlsEnabled: config.tls ?? true,
      providerRouteId: null,
      metadata: {},
    } as unknown as Record<string, unknown>);

    return this.toRouteInfo(record);
  }

  async getRouteById(id: string): Promise<RouteInfo | null> {
    const record = await this.db.findById<RouteRecord>(TABLES.routes, id);
    return record ? this.toRouteInfo(record) : null;
  }

  async getRouteByDeployment(deploymentId: string): Promise<RouteInfo | null> {
    const record = await this.db.findOneBy<RouteRecord>(TABLES.routes, { deploymentId });
    return record ? this.toRouteInfo(record) : null;
  }

  async getRouteBySubdomain(subdomain: string): Promise<RouteInfo | null> {
    const record = await this.db.findOneBy<RouteRecord>(TABLES.routes, { subdomain });
    return record ? this.toRouteInfo(record) : null;
  }

  async updateRoute(id: string, data: Partial<RouteConfig>): Promise<RouteInfo | null> {
    const record = await this.db.update<Omit<RouteRecord, 'id'>>(TABLES.routes, id, data as unknown as Record<string, unknown>);
    return record ? this.toRouteInfo(record) : null;
  }

  async updateRouteStatus(id: string, status: RouteStatus): Promise<RouteInfo | null> {
    const record = await this.db.update<Omit<RouteRecord, 'id'>>(TABLES.routes, id, { status } as unknown as Record<string, unknown>);
    return record ? this.toRouteInfo(record) : null;
  }

  async updateRouteHealth(id: string, healthy: boolean): Promise<RouteInfo | null> {
    const record = await this.db.update<Omit<RouteRecord, 'id'>>(TABLES.routes, id, {
      status: healthy ? 'active' : 'unhealthy',
      lastHealthCheck: new Date(),
    } as unknown as Record<string, unknown>);
    return record ? this.toRouteInfo(record) : null;
  }

  async setProviderRouteId(id: string, providerRouteId: string): Promise<RouteInfo | null> {
    const record = await this.db.update<Omit<RouteRecord, 'id'>>(TABLES.routes, id, { providerRouteId } as unknown as Record<string, unknown>);
    return record ? this.toRouteInfo(record) : null;
  }

  async deleteRoute(id: string): Promise<boolean> {
    return this.db.delete(TABLES.routes, id);
  }

  async listRoutes(projectId: string): Promise<RouteInfo[]> {
    const records = await this.db.findBy<RouteRecord>(TABLES.routes, { projectId }, { orderBy: 'created_at DESC' });
    return records.map(r => this.toRouteInfo(r));
  }

  async listActiveRoutes(): Promise<RouteInfo[]> {
    const records = await this.db.findBy<RouteRecord>(TABLES.routes, { status: 'active' }, { orderBy: 'subdomain' });
    return records.map(r => this.toRouteInfo(r));
  }

  private toRouteInfo(record: RouteRecord): RouteInfo {
    return {
      routeId: record.id,
      deploymentId: record.deploymentId,
      publicUrl: record.publicUrl,
      status: record.status,
      createdAt: record.createdAt,
      lastHealthCheck: record.lastHealthCheck ?? undefined,
    };
  }
}
