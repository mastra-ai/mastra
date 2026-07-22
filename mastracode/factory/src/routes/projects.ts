import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type {
  CreateFactoryProjectInput,
  FactoryProjectsStorage,
  UpdateFactoryProjectInput,
} from '../storage/domains/projects/base.js';
import type {
  ProjectRepository,
  SourceControlStorage,
  SourceControlStorageHandle,
  UpdateProjectRepositoryInput,
} from '../storage/domains/source-control/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_SETUP_COMMAND_LENGTH = 2_000;
const MAX_BRANCH_LENGTH = 255;
const MAX_SANDBOX_PROVIDER_LENGTH = 100;
const MAX_SANDBOX_WORKDIR_LENGTH = 1_000;
const CONTROL_CHAR_RE = /[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/;

function loose(context: unknown): Context {
  return context as Context;
}

async function readJson(context: Context): Promise<unknown | undefined> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

function parseCreateInput(value: unknown): CreateFactoryProjectInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== 'string') return null;
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  if (input.description !== undefined && input.description !== null && typeof input.description !== 'string')
    return null;
  const description = typeof input.description === 'string' ? input.description.trim() || null : null;
  if (description && description.length > MAX_DESCRIPTION_LENGTH) return null;
  return { name, description };
}

function parseUpdateInput(value: unknown): UpdateFactoryProjectInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const patch: UpdateFactoryProjectInput = {};
  if (input.name !== undefined) {
    if (typeof input.name !== 'string') return null;
    const name = input.name.trim();
    if (!name || name.length > MAX_NAME_LENGTH) return null;
    patch.name = name;
  }
  if (input.description !== undefined) {
    if (input.description !== null && typeof input.description !== 'string') return null;
    const description = typeof input.description === 'string' ? input.description.trim() || null : null;
    if (description && description.length > MAX_DESCRIPTION_LENGTH) return null;
    patch.description = description;
  }
  if (input.defaultModelId !== undefined) {
    const defaultModelId = parseOptionalString(input.defaultModelId, { maxLength: MAX_NAME_LENGTH, nullable: true });
    if (defaultModelId === false) return null;
    patch.defaultModelId = defaultModelId ?? null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function parseConnectionInput(value: unknown): { integrationId: string; installationId: string } | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (typeof input.integrationId !== 'string' || !input.integrationId.trim()) return null;
  if (typeof input.installationId !== 'string' || !UUID_RE.test(input.installationId)) return null;
  return { integrationId: input.integrationId.trim(), installationId: input.installationId };
}

function parseOptionalString(
  value: unknown,
  { maxLength, nullable = false }: { maxLength: number; nullable?: boolean },
): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null) return nullable ? null : false;
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return nullable ? null : false;
  if (normalized.length > maxLength || CONTROL_CHAR_RE.test(normalized)) return false;
  return normalized;
}

function parseRepositoryLinkInput(value: unknown): {
  repositoryId: string;
  branch: string | null;
  sandboxProvider: string;
  sandboxWorkdir: string;
  setupCommand: string | null;
} | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (typeof input.repositoryId !== 'string' || !UUID_RE.test(input.repositoryId)) return null;
  const branch = parseOptionalString(input.branch, { maxLength: MAX_BRANCH_LENGTH, nullable: true });
  const sandboxProvider = parseOptionalString(input.sandboxProvider, { maxLength: MAX_SANDBOX_PROVIDER_LENGTH });
  const sandboxWorkdir = parseOptionalString(input.sandboxWorkdir, { maxLength: MAX_SANDBOX_WORKDIR_LENGTH });
  const setupCommand = parseOptionalString(input.setupCommand, { maxLength: MAX_SETUP_COMMAND_LENGTH, nullable: true });
  if (
    branch === false ||
    typeof sandboxProvider !== 'string' ||
    typeof sandboxWorkdir !== 'string' ||
    setupCommand === false
  )
    return null;
  return {
    repositoryId: input.repositoryId,
    branch: branch ?? null,
    sandboxProvider,
    sandboxWorkdir,
    setupCommand: setupCommand ?? null,
  };
}

function parseRepositoryUpdateInput(value: unknown): UpdateProjectRepositoryInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const patch: UpdateProjectRepositoryInput = {};
  const branch = parseOptionalString(input.branch, { maxLength: MAX_BRANCH_LENGTH, nullable: true });
  const sandboxProvider = parseOptionalString(input.sandboxProvider, { maxLength: MAX_SANDBOX_PROVIDER_LENGTH });
  const sandboxWorkdir = parseOptionalString(input.sandboxWorkdir, { maxLength: MAX_SANDBOX_WORKDIR_LENGTH });
  const setupCommand = parseOptionalString(input.setupCommand, { maxLength: MAX_SETUP_COMMAND_LENGTH, nullable: true });
  if (
    branch === false ||
    sandboxProvider === false ||
    sandboxProvider === null ||
    sandboxWorkdir === false ||
    sandboxWorkdir === null ||
    setupCommand === false
  )
    return null;
  if (branch !== undefined) patch.branch = branch;
  if (sandboxProvider !== undefined) patch.sandboxProvider = sandboxProvider;
  if (sandboxWorkdir !== undefined) patch.sandboxWorkdir = sandboxWorkdir;
  if (setupCommand !== undefined) patch.setupCommand = setupCommand;
  return Object.keys(patch).length > 0 ? patch : null;
}

export interface ProjectRoutesDeps extends RouteDependencies {
  /** Factory projects domain backing the CRUD surface. */
  projects: FactoryProjectsStorage;
  /** Source-control domain the connection/repository routes fan out over. */
  sourceControl: SourceControlStorage;
  /** Integration ids allowed as source-control connection targets. */
  versionControlIntegrationIds?: string[];
}

export class ProjectRoutes extends Route<ProjectRoutesDeps> {
  readonly #versionControlIntegrationIds: Set<string>;

  constructor(deps: ProjectRoutesDeps) {
    super(deps);
    this.#versionControlIntegrationIds = new Set(deps.versionControlIntegrationIds ?? []);
  }

  async #projects(): Promise<FactoryProjectsStorage> {
    await this.deps.projects.ensureReady();
    return this.deps.projects;
  }

  async #sourceControl(): Promise<SourceControlStorage> {
    await this.deps.sourceControl.ensureReady();
    return this.deps.sourceControl;
  }

  async #handles(): Promise<SourceControlStorageHandle[]> {
    const storage = await this.#sourceControl();
    return [...this.#versionControlIntegrationIds].map(integrationId => storage.forIntegration(integrationId));
  }

  async #project(orgId: string, id: string) {
    return (await this.#projects()).get({ orgId, id });
  }

  async #findConnection({ orgId, projectId, id }: { orgId: string; projectId: string; id: string }) {
    for (const handle of await this.#handles()) {
      const connection = await handle.connections.get({ orgId, id });
      if (connection?.factoryProjectId === projectId) return { handle, connection };
    }
    return null;
  }

  async #findProjectRepository({ orgId, projectId, id }: { orgId: string; projectId: string; id: string }) {
    for (const handle of await this.#handles()) {
      const projectRepository = await handle.projectRepositories.get({ orgId, id });
      if (!projectRepository) continue;
      const connection = await handle.connections.get({ orgId, id: projectRepository.connectionId });
      if (connection?.factoryProjectId === projectId) return { handle, connection, projectRepository };
    }
    return null;
  }

  async #repositoryPayload(handle: SourceControlStorageHandle, orgId: string, projectRepository: ProjectRepository) {
    const repository = await handle.repositories.get({ orgId, id: projectRepository.repositoryId });
    return { ...projectRepository, repository };
  }

  async #resolveTenant(context: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(context);
    const tenant = this.deps.auth.tenant(context);
    if (!tenant) return { response: context.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: context.json(
          { error: 'organization_required', message: 'Factory projects require an organization.' },
          403,
        ),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute('/web/factory/projects', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          return context.json({ projects: await (await this.#projects()).list({ orgId: tenant.orgId }) });
        },
      }),
      registerApiRoute('/web/factory/projects', {
        method: 'POST',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const input = parseCreateInput(await readJson(context));
          if (!input) return context.json({ error: 'invalid_project' }, 400);
          const project = await (await this.#projects()).create({ orgId: tenant.orgId, userId: tenant.userId, input });
          return context.json({ project }, 201);
        },
      }),
      registerApiRoute('/web/factory/projects/:id', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const id = context.req.param('id');
          if (!id || !UUID_RE.test(id)) return context.json({ error: 'Project not found' }, 404);
          const project = await this.#project(tenant.orgId, id);
          return project ? context.json({ project }) : context.json({ error: 'Project not found' }, 404);
        },
      }),
      registerApiRoute('/web/factory/projects/:id', {
        method: 'PATCH',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const id = context.req.param('id');
          if (!id || !UUID_RE.test(id)) return context.json({ error: 'Project not found' }, 404);
          const input = parseUpdateInput(await readJson(context));
          if (!input) return context.json({ error: 'invalid_project' }, 400);
          const project = await (await this.#projects()).update({ orgId: tenant.orgId, id, input });
          return project ? context.json({ project }) : context.json({ error: 'Project not found' }, 404);
        },
      }),
      registerApiRoute('/web/factory/projects/:id', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const id = context.req.param('id');
          if (!id || !UUID_RE.test(id)) return context.json({ error: 'Project not found' }, 404);
          if (!(await this.#project(tenant.orgId, id))) return context.json({ error: 'Project not found' }, 404);
          for (const handle of await this.#handles()) {
            for (const connection of await handle.connections.list({ orgId: tenant.orgId, factoryProjectId: id })) {
              await handle.connections.delete({ orgId: tenant.orgId, id: connection.id });
            }
          }
          await (await this.#projects()).delete({ orgId: tenant.orgId, id });
          return context.body(null, 204);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/source-control-connections', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          if (!projectId || !UUID_RE.test(projectId) || !(await this.#project(tenant.orgId, projectId)))
            return context.json({ error: 'Project not found' }, 404);
          const connections = [];
          for (const handle of await this.#handles()) {
            for (const connection of await handle.connections.list({
              orgId: tenant.orgId,
              factoryProjectId: projectId,
            })) {
              const installation = await handle.installations.get({
                orgId: tenant.orgId,
                id: connection.installationId,
              });
              const links = await handle.projectRepositories.list({ orgId: tenant.orgId, connectionId: connection.id });
              connections.push({
                ...connection,
                installation,
                repositories: await Promise.all(links.map(link => this.#repositoryPayload(handle, tenant.orgId, link))),
              });
            }
          }
          return context.json({ connections });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/source-control-connections', {
        method: 'POST',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          if (!projectId || !UUID_RE.test(projectId) || !(await this.#project(tenant.orgId, projectId)))
            return context.json({ error: 'Project not found' }, 404);
          const input = parseConnectionInput(await readJson(context));
          if (!input) return context.json({ error: 'invalid_source_control_connection' }, 400);
          if (!this.#versionControlIntegrationIds.has(input.integrationId))
            return context.json({ error: 'Source-control integration not found' }, 404);
          const handle = (await this.#sourceControl()).forIntegration(input.integrationId);
          if (!(await handle.installations.get({ orgId: tenant.orgId, id: input.installationId })))
            return context.json({ error: 'Source-control installation not found' }, 404);
          const connection = await handle.connections.create({
            orgId: tenant.orgId,
            factoryProjectId: projectId,
            installationId: input.installationId,
            createdByUserId: tenant.userId,
          });
          return context.json({ connection }, 201);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/source-control-connections/:connectionId', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          const connectionId = context.req.param('connectionId');
          if (!projectId || !UUID_RE.test(projectId) || !connectionId || !UUID_RE.test(connectionId))
            return context.json({ error: 'Source-control connection not found' }, 404);
          const found = await this.#findConnection({ orgId: tenant.orgId, projectId, id: connectionId });
          if (!found) return context.json({ error: 'Source-control connection not found' }, 404);
          await found.handle.connections.delete({ orgId: tenant.orgId, id: connectionId });
          return context.body(null, 204);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/source-control-connections/:connectionId/repositories', {
        method: 'POST',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          const connectionId = context.req.param('connectionId');
          if (!projectId || !UUID_RE.test(projectId) || !connectionId || !UUID_RE.test(connectionId))
            return context.json({ error: 'Source-control connection not found' }, 404);
          const found = await this.#findConnection({ orgId: tenant.orgId, projectId, id: connectionId });
          if (!found) return context.json({ error: 'Source-control connection not found' }, 404);
          const input = parseRepositoryLinkInput(await readJson(context));
          if (!input) return context.json({ error: 'invalid_project_repository' }, 400);
          const repository = await found.handle.repositories.get({ orgId: tenant.orgId, id: input.repositoryId });
          if (!repository || repository.installationId !== found.connection.installationId)
            return context.json({ error: 'Source-control repository not found' }, 404);
          const projectRepository = await found.handle.projectRepositories.link({
            orgId: tenant.orgId,
            connectionId,
            createdByUserId: tenant.userId,
            ...input,
          });
          return context.json(
            { projectRepository: await this.#repositoryPayload(found.handle, tenant.orgId, projectRepository) },
            201,
          );
        },
      }),
      registerApiRoute('/web/factory/projects/:id/repositories/:projectRepositoryId', {
        method: 'PATCH',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          const projectRepositoryId = context.req.param('projectRepositoryId');
          if (!projectId || !UUID_RE.test(projectId) || !projectRepositoryId || !UUID_RE.test(projectRepositoryId))
            return context.json({ error: 'Project repository not found' }, 404);
          const found = await this.#findProjectRepository({ orgId: tenant.orgId, projectId, id: projectRepositoryId });
          if (!found) return context.json({ error: 'Project repository not found' }, 404);
          const input = parseRepositoryUpdateInput(await readJson(context));
          if (!input) return context.json({ error: 'invalid_project_repository' }, 400);
          const projectRepository = await found.handle.projectRepositories.update({
            orgId: tenant.orgId,
            id: projectRepositoryId,
            input,
          });
          return context.json({
            projectRepository: await this.#repositoryPayload(found.handle, tenant.orgId, projectRepository!),
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/repositories/:projectRepositoryId', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          const projectRepositoryId = context.req.param('projectRepositoryId');
          if (!projectId || !UUID_RE.test(projectId) || !projectRepositoryId || !UUID_RE.test(projectRepositoryId))
            return context.json({ error: 'Project repository not found' }, 404);
          const found = await this.#findProjectRepository({ orgId: tenant.orgId, projectId, id: projectRepositoryId });
          if (!found) return context.json({ error: 'Project repository not found' }, 404);
          await found.handle.projectRepositories.unlink({ orgId: tenant.orgId, id: projectRepositoryId });
          return context.body(null, 204);
        },
      }),
    ];
  }
}
