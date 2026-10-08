import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { SessionRetirementCoordinator } from '../sandbox/session-retirement.js';
import type {
  FactoryProject,
  FactoryProjectsStorage,
  UpdateFactoryProjectInput,
} from '../storage/domains/projects/base.js';
import type {
  ProjectRepository,
  SourceControlRepository,
  SourceControlStorage,
  SourceControlStorageHandle,
  UpdateProjectRepositoryInput,
} from '../storage/domains/source-control/base.js';
import { ACTIVE_RUN_BINDING_STAGES } from '../storage/domains/work-items/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;
const MAX_REPOSITORY_COMMAND_LENGTH = 2_000;
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
  repositoryId?: string;
  repository?: { externalId: string; slug: string };
  branch: string | null;
  sandboxProvider: string;
  sandboxWorkdir: string;
  setupCommand: string | null;
  teardownCommand: string | null;
} | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const repositoryId =
    typeof input.repositoryId === 'string' && UUID_RE.test(input.repositoryId) ? input.repositoryId : undefined;
  const repositoryInput = input.repository;
  let repository: { externalId: string; slug: string } | undefined;
  if (repositoryInput && typeof repositoryInput === 'object') {
    const candidate = repositoryInput as Record<string, unknown>;
    const externalId = parseOptionalString(candidate.externalId, { maxLength: MAX_NAME_LENGTH });
    const slug = parseOptionalString(candidate.slug, { maxLength: MAX_NAME_LENGTH });
    if (typeof externalId !== 'string' || typeof slug !== 'string') return null;
    repository = { externalId, slug };
  }
  if (!repositoryId && !repository) return null;
  const branch = parseOptionalString(input.branch, { maxLength: MAX_BRANCH_LENGTH, nullable: true });
  const sandboxProvider = parseOptionalString(input.sandboxProvider, { maxLength: MAX_SANDBOX_PROVIDER_LENGTH });
  const sandboxWorkdir = parseOptionalString(input.sandboxWorkdir, { maxLength: MAX_SANDBOX_WORKDIR_LENGTH });
  const setupCommand = parseOptionalString(input.setupCommand, {
    maxLength: MAX_REPOSITORY_COMMAND_LENGTH,
    nullable: true,
  });
  const teardownCommand = parseOptionalString(input.teardownCommand, {
    maxLength: MAX_REPOSITORY_COMMAND_LENGTH,
    nullable: true,
  });
  if (
    branch === false ||
    typeof sandboxProvider !== 'string' ||
    typeof sandboxWorkdir !== 'string' ||
    setupCommand === false ||
    teardownCommand === false
  )
    return null;
  return {
    ...(repositoryId ? { repositoryId } : {}),
    ...(repository ? { repository } : {}),
    branch: branch ?? null,
    sandboxProvider,
    sandboxWorkdir,
    setupCommand: setupCommand ?? null,
    teardownCommand: teardownCommand ?? null,
  };
}

function parseRepositoryUpdateInput(value: unknown): UpdateProjectRepositoryInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const patch: UpdateProjectRepositoryInput = {};
  const branch = parseOptionalString(input.branch, { maxLength: MAX_BRANCH_LENGTH, nullable: true });
  const sandboxProvider = parseOptionalString(input.sandboxProvider, { maxLength: MAX_SANDBOX_PROVIDER_LENGTH });
  const sandboxWorkdir = parseOptionalString(input.sandboxWorkdir, { maxLength: MAX_SANDBOX_WORKDIR_LENGTH });
  const setupCommand = parseOptionalString(input.setupCommand, {
    maxLength: MAX_REPOSITORY_COMMAND_LENGTH,
    nullable: true,
  });
  const teardownCommand = parseOptionalString(input.teardownCommand, {
    maxLength: MAX_REPOSITORY_COMMAND_LENGTH,
    nullable: true,
  });
  if (
    branch === false ||
    sandboxProvider === false ||
    sandboxProvider === null ||
    sandboxWorkdir === false ||
    sandboxWorkdir === null ||
    setupCommand === false ||
    teardownCommand === false
  )
    return null;
  if (branch !== undefined) patch.branch = branch;
  if (sandboxProvider !== undefined) patch.sandboxProvider = sandboxProvider;
  if (sandboxWorkdir !== undefined) patch.sandboxWorkdir = sandboxWorkdir;
  if (setupCommand !== undefined) patch.setupCommand = setupCommand;
  if (teardownCommand !== undefined) patch.teardownCommand = teardownCommand;
  return Object.keys(patch).length > 0 ? patch : null;
}

interface ModelApplySession {
  thread: {
    getById: (args: { threadId: string }) => Promise<{ metadata?: Record<string, unknown> | null } | null>;
    setSettingOn: (args: { threadId: string; key: string; value: unknown }) => Promise<unknown> | unknown;
  };
}

interface ModelApplyController {
  getSessionByResource: (resourceId: string) => Promise<ModelApplySession | undefined>;
}

export interface ProjectRoutesDeps extends RouteDependencies {
  /** Factory projects domain backing the CRUD surface. */
  projects: FactoryProjectsStorage;
  /** Source-control domain the connection/repository routes fan out over. */
  sourceControl: SourceControlStorage;
  /** Integration ids allowed as source-control connection targets. */
  versionControlIntegrationIds?: string[];
  /** Validate and persist a repository selected from a provider-backed listing. */
  resolveRepository?: (input: {
    integrationId: string;
    orgId: string;
    userId: string;
    installationId: string;
    externalId: string;
    slug: string;
  }) => Promise<SourceControlRepository | null>;
  /**
   * Fire-and-forget hook invoked after a repository is linked to a project —
   * kicks the initial base-checkpoint build. Must never throw.
   */
  onProjectRepositoryLinked?: (args: { orgId: string; projectRepository: ProjectRepository }) => void;
  /** Shared lifecycle for retiring sessions before their owning records are deleted. */
  sessionRetirement?: SessionRetirementCoordinator;
  /** Work-items domain used by session retirement and running-thread model updates. */
  workItems?: Pick<WorkItemsStorage, 'clearSessionReferences' | 'listRunBindings' | 'get'>;
  /** Controller used to reach the thread store behind each active binding. */
  controller?: ModelApplyController;
  /** How this host learns about pushes to linked repositories (shown with the build triggers). */
  pushSignal?: 'polling' | 'webhook' | 'none';
}

/** Environment fields whose change alters the template, so a PATCH touching them queues a build. */
const TEMPLATE_AFFECTING_PROJECT_FIELDS = [
  'sandboxProvider',
  'sandboxWorkdir',
  'sandboxCpuCount',
  'sandboxMemoryMb',
  'workspaceSetupCommand',
] as const;
const TEMPLATE_AFFECTING_REPOSITORY_FIELDS = ['position', 'inEnvironment', 'setupCommand', 'teardownCommand'] as const;

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

  /** Every link of the project across every handle, with the handle that owns it, in position order. */
  async #environmentLinks(orgId: string, projectId: string) {
    const links: Array<{ handle: SourceControlStorageHandle; projectRepository: ProjectRepository }> = [];
    for (const handle of await this.#handles()) {
      for (const projectRepository of await handle.projectRepositories.listByProject({
        orgId,
        factoryProjectId: projectId,
      })) {
        links.push({ handle, projectRepository });
      }
    }
    return links.sort(
      (a, b) =>
        a.projectRepository.position - b.projectRepository.position ||
        a.projectRepository.createdAt.getTime() - b.projectRepository.createdAt.getTime(),
    );
  }

  async #environmentPayload(orgId: string, project: FactoryProject) {
    const repositories = [];
    for (const { handle, projectRepository } of await this.#environmentLinks(orgId, project.id)) {
      const repository = await handle.repositories.get({ orgId, id: projectRepository.repositoryId });
      repositories.push({
        projectRepositoryId: projectRepository.id,
        connectionId: projectRepository.connectionId,
        repositoryId: projectRepository.repositoryId,
        slug: repository?.slug ?? null,
        defaultBranch: repository?.defaultBranch ?? null,
        position: projectRepository.position,
        inEnvironment: projectRepository.inEnvironment,
        setupCommand: projectRepository.setupCommand,
        teardownCommand: projectRepository.teardownCommand,
        lastBuildStatus: projectRepository.lastBuildStatus,
        lastBuildError: projectRepository.lastBuildError,
        lastBuiltAt: projectRepository.lastBuiltAt,
      });
    }
    return {
      environment: {
        sandboxWorkdir: project.sandboxWorkdir,
        sandboxCpuCount: project.sandboxCpuCount,
        sandboxMemoryMb: project.sandboxMemoryMb,
        sandboxIdleTimeoutMinutes: project.sandboxIdleTimeoutMinutes,
        workspaceSetupCommand: project.workspaceSetupCommand,
        activeTemplateId: project.activeTemplateId,
        activeTemplateHeads: project.activeTemplateHeads,
        repositories,
        buildTriggers: {
          schedule: { enabled: project.buildScheduleEnabled, hours: project.buildScheduleHours },
          onPush: {
            enabled: project.buildOnPushEnabled,
            debounceMinutes: project.buildPushDebounceMinutes,
            maxPerHour: project.buildPushMaxPerHour === 0 ? null : project.buildPushMaxPerHour,
          },
        },
        build: this.#buildPayload(project),
      },
    };
  }

  #buildPayload(project: FactoryProject) {
    return {
      status: project.lastBuildStatus,
      error: project.lastBuildError,
      lastBuiltAt: project.lastBuiltAt?.toISOString() ?? null,
      activeTemplateId: project.activeTemplateId,
      requestedAt: project.buildRequestedAt?.toISOString() ?? null,
      pushSignal: this.deps.pushSignal ?? 'none',
    };
  }

  async #retireProjectRepositorySessions(
    handle: SourceControlStorageHandle,
    orgId: string,
    projectRepositoryId: string,
  ): Promise<boolean> {
    const sessions = await handle.sessions.listByProjectRepository({ projectRepositoryId });
    if (sessions.length === 0) return true;
    if (!this.deps.sessionRetirement) return false;
    await this.deps.sessionRetirement.retireProjectRepositorySessions({
      sourceControl: handle,
      ...(this.deps.workItems ? { workItems: this.deps.workItems } : {}),
      orgId,
      projectRepositoryId,
    });
    return true;
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
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectList.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectList.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          return context.json({ projects: await (await this.#projects()).list({ orgId: tenant.orgId }) });
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectCreate.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectCreate.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const parsed = FACTORY_ROUTE_CONTRACTS.projectCreate.bodySchema.safeParse(await readJson(context));
          if (!parsed.success) return context.json({ error: 'invalid_project' }, 400);
          const project = await (
            await this.#projects()
          ).create({ orgId: tenant.orgId, userId: tenant.userId, input: parsed.data });
          return context.json({ project }, 201);
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectGet.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectGet.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const parsedPath = FACTORY_ROUTE_CONTRACTS.projectGet.pathSchema.safeParse({ id: context.req.param('id') });
          if (!parsedPath.success) return context.json({ error: 'Project not found' }, 404);
          const { id } = parsedPath.data;
          const project = await this.#project(tenant.orgId, id);
          return project ? context.json({ project }) : context.json({ error: 'Project not found' }, 404);
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectUpdate.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectUpdate.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const parsedPath = FACTORY_ROUTE_CONTRACTS.projectUpdate.pathSchema.safeParse({
            id: context.req.param('id'),
          });
          if (!parsedPath.success) return context.json({ error: 'Project not found' }, 404);
          const parsedBody = FACTORY_ROUTE_CONTRACTS.projectUpdate.bodySchema.safeParse(await readJson(context));
          if (!parsedBody.success) return context.json({ error: 'invalid_project' }, 400);
          const project = await (
            await this.#projects()
          ).update({ orgId: tenant.orgId, id: parsedPath.data.id, input: parsedBody.data });
          return project ? context.json({ project }) : context.json({ error: 'Project not found' }, 404);
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectApplyDefaultModel.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectApplyDefaultModel.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          if (!(await this.deps.auth.isOrganizationAdmin(context, tenant.orgId))) {
            return context.json(
              {
                error: 'forbidden',
                message: 'Organization administrator access is required to update running sessions.',
              },
              403,
            );
          }
          const parsedPath = FACTORY_ROUTE_CONTRACTS.projectApplyDefaultModel.pathSchema.safeParse({
            id: context.req.param('id'),
          });
          if (!parsedPath.success) return context.json({ error: 'Project not found' }, 404);
          const project = await this.#project(tenant.orgId, parsedPath.data.id);
          if (!project) return context.json({ error: 'Project not found' }, 404);
          const modelId = project.defaultModelId;
          if (!modelId) {
            return context.json(
              { error: 'default_model_not_set', message: 'Set a default model on the project first.' },
              400,
            );
          }
          const { workItems, controller } = this.deps;
          if (!workItems || !controller) return context.json({ error: 'model_apply_unavailable' }, 503);

          const bindings = (await workItems.listRunBindings(tenant.orgId, project.id)).filter(
            binding => binding.status === 'active',
          );
          const seen = new Set<string>();
          const applied: string[] = [];
          const skipped: Array<{
            threadId: string;
            reason:
              | 'not-running'
              | 'work-item-missing'
              | 'stage-inactive'
              | 'thread-missing'
              | 'mode-unknown'
              | 'apply-failed';
          }> = [];

          for (const binding of bindings) {
            const key = `${binding.sessionId}:${binding.threadId}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const item = await workItems.get({ orgId: tenant.orgId, id: binding.workItemId });
            if (!item || item.factoryProjectId !== project.id) {
              skipped.push({ threadId: binding.threadId, reason: 'work-item-missing' });
              continue;
            }
            if (!ACTIVE_RUN_BINDING_STAGES.has(item.stages[0] ?? '')) {
              skipped.push({ threadId: binding.threadId, reason: 'stage-inactive' });
              continue;
            }
            const session = await controller.getSessionByResource(binding.resourceId);
            if (!session) {
              skipped.push({ threadId: binding.threadId, reason: 'not-running' });
              continue;
            }
            const thread = await session.thread.getById({ threadId: binding.threadId });
            if (!thread) {
              skipped.push({ threadId: binding.threadId, reason: 'thread-missing' });
              continue;
            }
            try {
              // This route targets inactive bound threads, so persist the controller-owned key through the session gateway.
              await session.thread.setSettingOn({
                threadId: binding.threadId,
                key: 'currentModelId',
                value: modelId,
              });
              applied.push(binding.threadId);
            } catch (error) {
              console.warn('[factory] apply-default-model failed for thread', binding.threadId, error);
              skipped.push({ threadId: binding.threadId, reason: 'apply-failed' });
            }
          }

          return context.json({ modelId, applied, skipped });
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectDelete.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectDelete.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const parsedPath = FACTORY_ROUTE_CONTRACTS.projectDelete.pathSchema.safeParse({
            id: context.req.param('id'),
          });
          if (!parsedPath.success) return context.json({ error: 'Project not found' }, 404);
          const { id } = parsedPath.data;
          if (!(await this.#project(tenant.orgId, id))) return context.json({ error: 'Project not found' }, 404);
          for (const handle of await this.#handles()) {
            for (const connection of await handle.connections.list({ orgId: tenant.orgId, factoryProjectId: id })) {
              for (const projectRepository of await handle.projectRepositories.list({
                orgId: tenant.orgId,
                connectionId: connection.id,
              })) {
                if (!(await this.#retireProjectRepositorySessions(handle, tenant.orgId, projectRepository.id))) {
                  return context.json({ error: 'session_retirement_unavailable' }, 409);
                }
              }
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
              // Skip orphaned connections whose installation was pruned (e.g.
              // the user uninstalled the GitHub App). Otherwise
              // `projectRepositories.list` throws `requireConnection` and the
              // whole endpoint 500s, which hangs the web UI on the page
              // loader for every project. New code cascade-deletes these on
              // installation removal, but this defensive skip lets already-
              // orphaned rows in existing databases self-heal on read.
              if (!installation) continue;
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
          for (const projectRepository of await found.handle.projectRepositories.list({
            orgId: tenant.orgId,
            connectionId,
          })) {
            if (!(await this.#retireProjectRepositorySessions(found.handle, tenant.orgId, projectRepository.id))) {
              return context.json({ error: 'session_retirement_unavailable' }, 409);
            }
          }
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
          const repository = input.repositoryId
            ? await found.handle.repositories.get({ orgId: tenant.orgId, id: input.repositoryId })
            : input.repository && this.deps.resolveRepository
              ? await this.deps.resolveRepository({
                  integrationId: found.connection.integrationId,
                  orgId: tenant.orgId,
                  userId: tenant.userId,
                  installationId: found.connection.installationId,
                  ...input.repository,
                })
              : null;
          if (!repository || repository.installationId !== found.connection.installationId)
            return context.json({ error: 'Source-control repository not found' }, 404);
          const { repositoryId: _repositoryId, repository: _repository, ...linkInput } = input;
          const projectRepository = await found.handle.projectRepositories.link({
            orgId: tenant.orgId,
            connectionId,
            createdByUserId: tenant.userId,
            repositoryId: repository.id,
            ...linkInput,
          });
          try {
            this.deps.onProjectRepositoryLinked?.({ orgId: tenant.orgId, projectRepository });
          } catch (error) {
            console.warn('[factory] onProjectRepositoryLinked failed after a successful repository link:', error);
          }
          return context.json(
            { projectRepository: await this.#repositoryPayload(found.handle, tenant.orgId, projectRepository) },
            201,
          );
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectEnvironmentGet.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectEnvironmentGet.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          if (!projectId || !UUID_RE.test(projectId)) return context.json({ error: 'Project not found' }, 404);
          const project = await this.#project(tenant.orgId, projectId);
          if (!project) return context.json({ error: 'Project not found' }, 404);
          return context.json(await this.#environmentPayload(tenant.orgId, project));
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectEnvironmentUpdate.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectEnvironmentUpdate.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          if (!projectId || !UUID_RE.test(projectId)) return context.json({ error: 'Project not found' }, 404);
          const project = await this.#project(tenant.orgId, projectId);
          if (!project) return context.json({ error: 'Project not found' }, 404);
          const parsed = FACTORY_ROUTE_CONTRACTS.projectEnvironmentUpdate.bodySchema.safeParse(await readJson(context));
          if (!parsed.success) return context.json({ error: 'invalid_environment' }, 400);
          const { repositories: repositoryPatches, buildTriggers, ...projectInput } = parsed.data;

          // Resolve every listed link before writing anything, so a foreign id leaves the project untouched.
          const links = new Map(
            (await this.#environmentLinks(tenant.orgId, projectId)).map(link => [link.projectRepository.id, link]),
          );
          for (const patch of repositoryPatches ?? []) {
            if (!links.has(patch.projectRepositoryId))
              return context.json({ error: 'Project repository not found' }, 404);
          }
          // A reorder must cover every link, or two links would share a position.
          if (
            repositoryPatches?.some(patch => patch.position !== undefined) &&
            repositoryPatches.length !== links.size
          ) {
            return context.json({ error: 'invalid_environment' }, 400);
          }

          const buildRequested =
            TEMPLATE_AFFECTING_PROJECT_FIELDS.some(field => projectInput[field] !== undefined) ||
            (repositoryPatches ?? []).some(patch =>
              TEMPLATE_AFFECTING_REPOSITORY_FIELDS.some(field => patch[field] !== undefined),
            );
          const projectUpdate: UpdateFactoryProjectInput = {
            ...projectInput,
            ...(buildTriggers?.schedule?.enabled !== undefined
              ? { buildScheduleEnabled: buildTriggers.schedule.enabled }
              : {}),
            ...(buildTriggers?.schedule?.hours !== undefined
              ? { buildScheduleHours: buildTriggers.schedule.hours }
              : {}),
            ...(buildTriggers?.onPush?.enabled !== undefined
              ? { buildOnPushEnabled: buildTriggers.onPush.enabled }
              : {}),
            ...(buildTriggers?.onPush?.debounceMinutes !== undefined
              ? { buildPushDebounceMinutes: buildTriggers.onPush.debounceMinutes }
              : {}),
            // Null (unlimited) is stored as 0: the column is never null, so a never-written row keeps its default.
            ...(buildTriggers?.onPush?.maxPerHour !== undefined
              ? { buildPushMaxPerHour: buildTriggers.onPush.maxPerHour ?? 0 }
              : {}),
            ...(buildRequested ? { buildRequestedAt: new Date() } : {}),
          };

          // Repositories first: the build request on the project row is the
          // last write, so a worker tick cannot claim it on a half-applied change.
          for (const { projectRepositoryId, ...input } of repositoryPatches ?? []) {
            if (Object.keys(input).length === 0) continue;
            await links.get(projectRepositoryId)!.handle.projectRepositories.update({
              orgId: tenant.orgId,
              id: projectRepositoryId,
              input,
            });
          }
          let updated = project;
          if (Object.keys(projectUpdate).length > 0) {
            updated =
              (await (await this.#projects()).update({ orgId: tenant.orgId, id: projectId, input: projectUpdate })) ??
              project;
          }
          return context.json({
            ...(await this.#environmentPayload(tenant.orgId, updated)),
            ...(buildRequested ? { buildRequested: true } : {}),
          });
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectEnvironmentBuild.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectEnvironmentBuild.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          if (!projectId || !UUID_RE.test(projectId)) return context.json({ error: 'Project not found' }, 404);
          const project = await this.#project(tenant.orgId, projectId);
          if (!project) return context.json({ error: 'Project not found' }, 404);
          const updated = await (
            await this.#projects()
          ).update({ orgId: tenant.orgId, id: projectId, input: { buildRequestedAt: new Date() } });
          return context.json({ requested: true, build: this.#buildPayload(updated ?? project) });
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
          if (!(await this.#retireProjectRepositorySessions(found.handle, tenant.orgId, projectRepositoryId))) {
            return context.json({ error: 'session_retirement_unavailable' }, 409);
          }
          await found.handle.projectRepositories.unlink({ orgId: tenant.orgId, id: projectRepositoryId });
          return context.body(null, 204);
        },
      }),
    ];
  }
}
