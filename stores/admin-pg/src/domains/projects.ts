import type { Project, EncryptedEnvVar, ProjectApiToken } from '@mastra/admin';
import { AdminPgDB, TABLES } from '../db';
import type { PgDomainConfig } from './utils';
import { resolvePgConfig } from './utils';

export class ProjectsPG {
  private db: AdminPgDB;

  static readonly MANAGED_TABLES = [TABLES.projects, TABLES.project_env_vars, TABLES.project_api_tokens] as const;

  constructor(config: PgDomainConfig) {
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.db = new AdminPgDB({ client, schemaName, skipDefaultIndexes });
  }

  // Project operations
  async createProject(data: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    // Store envVars separately in project_env_vars table, not in main project record
    const { envVars, ...projectData } = data;

    // Create project first
    const project = await this.db.insert<Omit<Project, 'id' | 'envVars'>>(TABLES.projects, projectData as unknown as Record<string, unknown>);

    // Insert env vars if provided
    if (envVars && envVars.length > 0) {
      for (const envVar of envVars) {
        await this.setEnvVar(project.id, envVar);
      }
    }

    // Return project with envVars
    return {
      ...project,
      envVars: envVars || [],
    };
  }

  async getProjectById(id: string): Promise<Project | null> {
    const project = await this.db.findById<Omit<Project, 'envVars'>>(TABLES.projects, id);
    if (!project) return null;

    const envVars = await this.getEnvVars(id);
    return { ...project, envVars };
  }

  async getProjectBySlug(teamId: string, slug: string): Promise<Project | null> {
    const project = await this.db.findOneBy<Omit<Project, 'envVars'>>(TABLES.projects, { teamId, slug });
    if (!project) return null;

    const envVars = await this.getEnvVars(project.id);
    return { ...project, envVars };
  }

  async updateProject(id: string, data: Partial<Omit<Project, 'id' | 'teamId' | 'createdAt' | 'envVars'>>): Promise<Project | null> {
    const project = await this.db.update<Omit<Project, 'id' | 'envVars'>>(TABLES.projects, id, data as unknown as Record<string, unknown>);
    if (!project) return null;

    const envVars = await this.getEnvVars(id);
    return { ...project, envVars };
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.db.delete(TABLES.projects, id);
  }

  async listProjects(
    teamId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: Project[]; total: number }> {
    const total = await this.db.count(TABLES.projects, { teamId });
    const projects = await this.db.findBy<Omit<Project, 'envVars'>>(TABLES.projects, { teamId }, { ...options, orderBy: 'name' });

    // Load env vars for each project
    const data = await Promise.all(
      projects.map(async project => {
        const envVars = await this.getEnvVars(project.id);
        return { ...project, envVars };
      }),
    );

    return { data, total };
  }

  // Environment variable operations
  async setEnvVar(projectId: string, envVar: Omit<EncryptedEnvVar, 'createdAt' | 'updatedAt'>): Promise<EncryptedEnvVar> {
    // Check if exists, if so update, otherwise insert
    const existing = await this.db.findOneBy<EncryptedEnvVar & { projectId: string }>(TABLES.project_env_vars, {
      projectId,
      key: envVar.key,
    });

    if (existing) {
      const updated = await this.db.update<EncryptedEnvVar & { projectId: string; id: string }>(TABLES.project_env_vars, existing.id, {
        encryptedValue: envVar.encryptedValue,
        isSecret: envVar.isSecret,
      } as unknown as Record<string, unknown>);
      if (!updated) throw new Error('Failed to update env var');
      return {
        key: updated.key,
        encryptedValue: updated.encryptedValue,
        isSecret: updated.isSecret,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    }

    const created = await this.db.insert<EncryptedEnvVar & { projectId: string }>(TABLES.project_env_vars, {
      projectId,
      ...envVar,
    } as unknown as Record<string, unknown>);

    return {
      key: created.key,
      encryptedValue: created.encryptedValue,
      isSecret: created.isSecret,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async getEnvVars(projectId: string): Promise<EncryptedEnvVar[]> {
    const results = await this.db.findBy<EncryptedEnvVar & { projectId: string }>(
      TABLES.project_env_vars,
      { projectId },
      { orderBy: 'key' },
    );
    return results.map(r => ({
      key: r.key,
      encryptedValue: r.encryptedValue,
      isSecret: r.isSecret,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async deleteEnvVar(projectId: string, key: string): Promise<boolean> {
    const envVar = await this.db.findOneBy<EncryptedEnvVar & { projectId: string }>(TABLES.project_env_vars, {
      projectId,
      key,
    });
    if (!envVar) return false;
    return this.db.delete(TABLES.project_env_vars, envVar.id);
  }

  // API token operations
  async createApiToken(data: Omit<ProjectApiToken, 'createdAt' | 'lastUsedAt'>): Promise<ProjectApiToken> {
    return this.db.insert<Omit<ProjectApiToken, 'id'>>(TABLES.project_api_tokens, data as unknown as Record<string, unknown>);
  }

  async getApiTokenById(id: string): Promise<ProjectApiToken | null> {
    return this.db.findById<ProjectApiToken>(TABLES.project_api_tokens, id);
  }

  async getApiTokenByHash(tokenHash: string): Promise<ProjectApiToken | null> {
    return this.db.findOneBy<ProjectApiToken>(TABLES.project_api_tokens, { tokenHash });
  }

  async listApiTokens(projectId: string): Promise<ProjectApiToken[]> {
    return this.db.findBy<ProjectApiToken>(TABLES.project_api_tokens, { projectId }, { orderBy: 'created_at DESC' });
  }

  async updateApiTokenLastUsed(id: string): Promise<void> {
    await this.db.update<Omit<ProjectApiToken, 'id'>>(TABLES.project_api_tokens, id, {
      lastUsedAt: new Date(),
    } as unknown as Record<string, unknown>);
  }

  async deleteApiToken(id: string): Promise<boolean> {
    return this.db.delete(TABLES.project_api_tokens, id);
  }
}
