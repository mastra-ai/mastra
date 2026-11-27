import { MastraError } from '@mastra/core/error';
import type { StandardSchemaWithJSON } from '@mastra/core/schema';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { FactoryStorageOps } from '@mastra/core/storage';
import type { FactorySandbox, FactorySandboxDescription } from '@mastra/core/workspace';
import type { Context } from 'hono';

import type { ProjectBoardCache } from '../boards/project-boards.js';
import type { EnvironmentBuildRunner } from '../environment/build-runner.js';
import { scheduleIdFor } from '../environment/build-schedule.js';
import { redactCredentials } from '../environment/build.js';
import { EnvironmentHandlers } from '../environment/handlers.js';
import type { EnvironmentScope } from '../environment/handlers.js';
import { ProjectEnvironment } from '../environment/project-environment.js';
import { maskSandboxEnvValues } from '../sandbox/sandbox-env.js';
import type { SessionRetirementCoordinator } from '../sandbox/session-retirement.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type {
  ProjectRepository,
  SourceControlRepository,
  SourceControlStorage,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { ProjectListRepository } from './contracts.js';
import type { RouteDependencies } from './route.js';
import { loose, Route } from './route.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;
const MAX_REPOSITORY_COMMAND_LENGTH = 2_000;
const MAX_BRANCH_LENGTH = 255;
const CONTROL_CHAR_RE = /[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/;

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
  setupCommand: string | null;
  teardownCommand: string | null;
  selectIntake: boolean;
} | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.selectIntake !== undefined && typeof input.selectIntake !== 'boolean') return null;
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
  const setupCommand = parseOptionalString(input.setupCommand, {
    maxLength: MAX_REPOSITORY_COMMAND_LENGTH,
    nullable: true,
  });
  const teardownCommand = parseOptionalString(input.teardownCommand, {
    maxLength: MAX_REPOSITORY_COMMAND_LENGTH,
    nullable: true,
  });
  if (branch === false || setupCommand === false || teardownCommand === false) return null;
  return {
    ...(repositoryId ? { repositoryId } : {}),
    ...(repository ? { repository } : {}),
    branch: branch ?? null,
    setupCommand: setupCommand ?? null,
    teardownCommand: teardownCommand ?? null,
    selectIntake: input.selectIntake !== false,
  };
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
  /** Work-items domain used by session retirement. */
  workItems?: Pick<WorkItemsStorage, 'clearSessionReferences' | 'listRunBindings' | 'get'>;
  /** The factory's normalized sandbox; describes and validates the environment settings. */
  sandbox?: FactorySandbox;
  /** Environment builds, present only when the sandbox has a `builds` capability. */
  environmentBuilds?: EnvironmentBuildRunner;
  /** Intake bindings, released when their Factory project is deleted. */
  intake?: Pick<IntakeStorage, 'ensureReady' | 'clearProjectBindings' | 'addSources'>;
  /** The per-project boards; loading a new project stores its copies of the code boards. */
  boards?: Pick<ProjectBoardCache, 'seedNewProject'>;
}

/**
 * Provider output is shown to the user; strip any clone credential and any
 * Build variable value from it first.
 */
function redactBuild<T extends { error?: string; logs?: string[] }>(build: T, buildEnv?: Record<string, string>): T {
  const redact = (text: string) => maskSandboxEnvValues(redactCredentials(text), buildEnv);
  return {
    ...build,
    ...(build.error !== undefined ? { error: redact(build.error) } : {}),
    ...(build.logs ? { logs: build.logs.map(redact) } : {}),
  };
}

let warnedAdditionalProject = false;

/** Warns once per process when an organization that already has a Factory project creates another. */
function warnAdditionalProject(): void {
  if (warnedAdditionalProject) return;
  warnedAdditionalProject = true;
  console.warn(
    '[Mastra Factory] Creating more than one Factory project in an organization is deprecated: each organization will have one Factory project. The project is still created; see the README "One project per Factory" section.',
  );
}

export class ProjectRoutes extends Route<ProjectRoutesDeps> {
  readonly #versionControlIntegrationIds: Set<string>;
  readonly #environment: ProjectEnvironment;
  readonly #handlers: EnvironmentHandlers;

  constructor(deps: ProjectRoutesDeps) {
    super(deps);
    this.#versionControlIntegrationIds = new Set(deps.versionControlIntegrationIds ?? []);
    this.#environment = new ProjectEnvironment({
      projects: deps.projects,
      sourceControl: deps.sourceControl,
      integrationIds: [...this.#versionControlIntegrationIds],
      ...(deps.sandbox ? { sandbox: deps.sandbox } : {}),
    });
    this.#handlers = new EnvironmentHandlers({
      environment: this.#environment,
      ...(deps.environmentBuilds ? { environmentBuilds: deps.environmentBuilds } : {}),
      ...(deps.sessionRetirement ? { sessionRetirement: deps.sessionRetirement } : {}),
      ...(deps.workItems ? { workItems: deps.workItems } : {}),
    });
  }

  async #projects(): Promise<FactoryProjectsStorage> {
    await this.deps.projects.ensureReady();
    return this.deps.projects;
  }

  async #sourceControl(): Promise<SourceControlStorage> {
    await this.deps.sourceControl.ensureReady();
    return this.deps.sourceControl;
  }

  async #intakeRelease(
    orgId: string,
    factoryProjectId: string,
  ): Promise<((ops: FactoryStorageOps) => Promise<void>) | undefined> {
    const { intake } = this.deps;
    if (!intake) return undefined;
    await intake.ensureReady();
    return ops => intake.clearProjectBindings({ orgId, factoryProjectId }, ops);
  }

  #handles(): Promise<SourceControlStorageHandle[]> {
    return this.#environment.handles();
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

  #findProjectRepository(args: { orgId: string; projectId: string; id: string }) {
    return this.#environment.findProjectRepository(args);
  }

  async #connectionsWithRepositories(orgId: string, factoryProjectIds: string[]) {
    if (factoryProjectIds.length === 0 || this.#versionControlIntegrationIds.size === 0) return [];
    const perIntegration = await Promise.all(
      (await this.#handles()).map(handle => handle.connections.listWithRepositories({ orgId, factoryProjectIds })),
    );
    return perIntegration.flat();
  }

  async #linkedRepositoriesByProject(orgId: string, factoryProjectIds: string[]) {
    const byProject = new Map<string, ProjectListRepository[]>();
    for (const connection of await this.#connectionsWithRepositories(orgId, factoryProjectIds)) {
      const repositories = byProject.get(connection.factoryProjectId) ?? [];
      for (const link of connection.repositories) {
        repositories.push({
          projectRepositoryId: link.id,
          connectionId: connection.id,
          integrationId: connection.integrationId,
          repositoryId: link.repositoryId,
          externalId: link.repository?.externalId ?? null,
          slug: link.repository?.slug ?? null,
          defaultBranch: link.repository?.defaultBranch ?? null,
          branch: link.branch,
        });
      }
      byProject.set(connection.factoryProjectId, repositories);
    }
    return byProject;
  }

  #repositoryPayload(handle: SourceControlStorageHandle, orgId: string, projectRepository: ProjectRepository) {
    return this.#handlers.repositoryPayload(handle, orgId, projectRepository);
  }

  #environmentPayload(orgId: string, project: FactoryProject) {
    return this.#handlers.environmentPayload(orgId, project);
  }

  /** The builds capability behind the routes, or the 404 to answer with. */
  #builds(context: Context) {
    const builds = this.deps.sandbox?.builds;
    const runner = this.deps.environmentBuilds;
    if (!builds || !runner) return { response: context.json({ error: 'no_builds' }, 404) };
    return { builds, runner };
  }

  #buildRoutes(): ApiRoute[] {
    return [
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
          const capability = this.#builds(context);
          if ('response' in capability) return capability.response;
          const { heads: _heads, ...outcome } = await capability.runner.start(project.id, 'manual');
          return context.json(outcome);
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectEnvironmentBuilds.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectEnvironmentBuilds.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          if (!projectId || !UUID_RE.test(projectId)) return context.json({ error: 'Project not found' }, 404);
          const project = await this.#project(tenant.orgId, projectId);
          if (!project) return context.json({ error: 'Project not found' }, 404);
          const capability = this.#builds(context);
          if ('response' in capability) return capability.response;
          if (!capability.builds.list) return context.json({ error: 'no_history' }, 404);
          const read = await capability.runner.readContext(project.id);
          if (!read) return context.json({ error: 'no_environment' }, 404);
          const builds = await capability.builds.list(read.ctx, read.settings);
          return context.json({ builds: builds.map(build => redactBuild(build, read.ctx.buildEnv)) });
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectEnvironmentBuildGet.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectEnvironmentBuildGet.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const projectId = context.req.param('id');
          if (!projectId || !UUID_RE.test(projectId)) return context.json({ error: 'Project not found' }, 404);
          const project = await this.#project(tenant.orgId, projectId);
          if (!project) return context.json({ error: 'Project not found' }, 404);
          const capability = this.#builds(context);
          if ('response' in capability) return capability.response;
          // A composite provider id (E2B's `<templateId>:<buildId>`) travels
          // encoded; Hono hands the param back decoded.
          const buildId = context.req.param('buildId') ?? '';
          if (!buildId) return context.json({ error: 'Build not found' }, 404);
          const read = await capability.runner.readContext(project.id);
          if (!read) return context.json({ error: 'no_environment' }, 404);
          // Providers answer for any id on the host's account, so the route
          // only forwards ids that belong to this project: its last build, or
          // one the provider lists under the project's template.
          if (buildId !== project.lastBuildId) {
            const listed = capability.builds.list ? await capability.builds.list(read.ctx, read.settings) : [];
            if (!listed.some(build => build.buildId === buildId)) {
              return context.json({ error: 'Build not found' }, 404);
            }
          }
          const build = await capability.builds.get(read.ctx, read.settings, buildId);
          return context.json({ build: redactBuild(build, read.ctx.buildEnv) });
        },
      }),
    ];
  }

  /** Best effort: a deleted project's cron schedule must not keep firing. */
  async #dropSchedule(projectId: string): Promise<void> {
    const runner = this.deps.environmentBuilds;
    if (!runner?.scheduleAvailable) return;
    try {
      await runner.schedules()!.delete(scheduleIdFor(projectId));
    } catch (error) {
      if (error instanceof MastraError && error.id === 'SCHEDULES_NOT_FOUND') return;
      console.warn('[factory] could not delete the environment build schedule of a deleted project:', error);
    }
  }

  #retireProjectRepositorySessions(handle: SourceControlStorageHandle, orgId: string, projectRepositoryId: string) {
    return this.#handlers.retireProjectRepositorySessions(handle, orgId, projectRepositoryId);
  }

  async #environmentScope(context: Context): Promise<EnvironmentScope | { response: Response }> {
    const tenant = await this.#resolveTenant(context);
    if ('response' in tenant) return tenant;
    const projectId = context.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) return { response: context.json({ error: 'Project not found' }, 404) };
    return { ...tenant, projectId };
  }

  async #repositoryScope(context: Context): Promise<(EnvironmentScope & { id: string }) | { response: Response }> {
    const tenant = await this.#resolveTenant(context);
    if ('response' in tenant) return tenant;
    const projectId = context.req.param('id');
    const id = context.req.param('projectRepositoryId');
    if (!projectId || !UUID_RE.test(projectId) || !id || !UUID_RE.test(id))
      return { response: context.json({ error: 'Project repository not found' }, 404) };
    return { ...tenant, projectId, id };
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
          const projects = await (await this.#projects()).list({ orgId: tenant.orgId });
          const repositories = await this.#linkedRepositoriesByProject(
            tenant.orgId,
            projects.map(project => project.id),
          );
          return context.json({
            projects: projects.map(project => ({ ...project, repositories: repositories.get(project.id) ?? [] })),
          });
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
          const projects = await this.#projects();
          if ((await projects.list({ orgId: tenant.orgId })).length > 0) warnAdditionalProject();
          const project = await projects.create({ orgId: tenant.orgId, userId: tenant.userId, input: parsed.data });
          // A new project gets today's Work, without Triage; a project that existed before keeps the
          // Work it had. The project's first board load retries anything this misses, with Work as
          // it was for older projects, as this one can't be told apart from them by then.
          await this.deps.boards?.seedNewProject({ orgId: tenant.orgId, factoryProjectId: project.id }).catch(error => {
            console.warn('[factory] could not store the boards of a new project:', error);
          });
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
          // Scope decides whose credentials every session bills against, so only
          // admins may switch a shared Factory onto owners' personal keys.
          const adminField =
            parsedBody.data.modelScope !== undefined
              ? 'model scope'
              : parsedBody.data.modelPackSet !== undefined
                ? 'model packs'
                : parsedBody.data.defaultModelId !== undefined
                  ? 'default model'
                  : undefined;
          if (
            adminField &&
            this.deps.auth.enabled() &&
            !(await this.deps.auth.isOrganizationAdmin(context, tenant.orgId))
          ) {
            return context.json(
              {
                error: 'forbidden',
                message: `Organization administrator access is required to change the ${adminField}.`,
              },
              403,
            );
          }
          // Retired project switches an old client may still send: the board owns automation now
          // (`autoStart`, `exitTool.autoApprove`, a self-review phase), and the review skill decides
          // whether to publish its test check.
          const {
            autoApprovePlans: _plans,
            autoRunEnabled: _autoRun,
            reviewTestChecksEnabled: _testChecks,
            selfReviewEnabled: _selfReview,
            ...input
          } = parsedBody.data;
          const project = await (await this.#projects()).update({ orgId: tenant.orgId, id: parsedPath.data.id, input });
          return project ? context.json({ project }) : context.json({ error: 'Project not found' }, 404);
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
          await (
            await this.#projects()
          ).delete({ orgId: tenant.orgId, id }, await this.#intakeRelease(tenant.orgId, id));
          await this.#dropSchedule(id);
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
          return context.json({ connections: await this.#connectionsWithRepositories(tenant.orgId, [projectId]) });
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
          // Its repositories left the environment with it.
          this.deps.environmentBuilds?.onEnvironmentSaved(projectId);
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
          const { repositoryId: _repositoryId, repository: _repository, selectIntake, ...linkInput } = input;
          const projectRepository = await found.handle.projectRepositories.link({
            orgId: tenant.orgId,
            connectionId,
            repositoryId: repository.id,
            ...linkInput,
          });
          if (selectIntake && found.connection.integrationId === 'github' && this.deps.intake) {
            try {
              await this.deps.intake.addSources({
                orgId: tenant.orgId,
                integrationId: 'github',
                sourceIds: [repository.slug],
              });
            } catch (error) {
              console.warn('[factory] Failed to add a linked repository to issue intake:', error);
            }
          }
          try {
            this.deps.onProjectRepositoryLinked?.({ orgId: tenant.orgId, projectRepository });
          } catch (error) {
            console.warn('[factory] onProjectRepositoryLinked failed after a successful repository link:', error);
          }
          this.deps.environmentBuilds?.onEnvironmentSaved(projectId);
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
          const scope = await this.#environmentScope(context);
          return 'response' in scope ? scope.response : this.#handlers.get(context, scope);
        },
      }),
      registerApiRoute(FACTORY_ROUTE_CONTRACTS.projectEnvironmentUpdate.path, {
        method: FACTORY_ROUTE_CONTRACTS.projectEnvironmentUpdate.method,
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const scope = await this.#environmentScope(context);
          return 'response' in scope ? scope.response : this.#handlers.update(context, scope);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/repositories/:projectRepositoryId', {
        method: 'PATCH',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const scope = await this.#repositoryScope(context);
          return 'response' in scope ? scope.response : this.#handlers.updateRepository(context, scope, scope.id);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/repositories/:projectRepositoryId', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const scope = await this.#repositoryScope(context);
          return 'response' in scope ? scope.response : this.#handlers.deleteRepository(context, scope, scope.id);
        },
      }),
      ...this.#buildRoutes(),
    ];
  }
}
