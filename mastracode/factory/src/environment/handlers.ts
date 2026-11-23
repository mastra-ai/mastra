import type { Context } from 'hono';

import {
  sandboxEnvPathSchema,
  sandboxEnvSetBodySchema,
  sandboxEnvUpdateBodySchema,
  updateProjectEnvironmentBodySchema,
} from '../routes/environment-contracts.js';
import type { SessionRetirementCoordinator } from '../sandbox/session-retirement.js';
import type { AuditEmitter, EmitAuditInput } from '../storage/domains/audit/domain.js';
import type { FactoryProject, UpdateFactoryProjectInput } from '../storage/domains/projects/base.js';
import type { SandboxEnvMetadata, SandboxEnvStore } from '../storage/domains/sandbox-envs/base.js';
import type {
  ProjectRepository,
  SourceControlStorageHandle,
  UpdateProjectRepositoryInput,
} from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { EnvironmentBuildRunner } from './build-runner.js';
import { ensureSchedule, invalidCronMessage, readSchedule } from './build-schedule.js';
import type { ProjectEnvironment } from './project-environment.js';

/** Who is asking and which project row the request works on, as resolved by the host's route. */
export interface EnvironmentScope {
  orgId: string;
  userId: string;
  projectId: string;
}

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

export function parseRepositoryUpdateInput(value: unknown): UpdateProjectRepositoryInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const patch: UpdateProjectRepositoryInput = {};
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
  if (branch !== undefined) patch.branch = branch;
  if (setupCommand !== undefined) patch.setupCommand = setupCommand;
  if (teardownCommand !== undefined) patch.teardownCommand = teardownCommand;
  return Object.keys(patch).length > 0 ? patch : null;
}

export interface EnvironmentHandlersDeps {
  environment: ProjectEnvironment;
  /** Environment builds, present only when the sandbox has a `builds` capability. */
  environmentBuilds?: Pick<EnvironmentBuildRunner, 'onEnvironmentSaved' | 'scheduleAvailable' | 'schedules'>;
  /** Shared lifecycle for retiring sessions before a linked repository is removed. */
  sessionRetirement?: SessionRetirementCoordinator;
  workItems?: Pick<WorkItemsStorage, 'clearSessionReferences' | 'listRunBindings' | 'get'>;
}

/**
 * The environment endpoints of one project, independent of how a host finds
 * the project: Factory serves them under `/web/factory/projects/:id`, and any
 * other host can serve the same handlers under its own paths.
 */
export class EnvironmentHandlers {
  constructor(private readonly deps: EnvironmentHandlersDeps) {}

  async #project(scope: EnvironmentScope): Promise<FactoryProject | null> {
    return (await this.deps.environment.projects()).get({ orgId: scope.orgId, id: scope.projectId });
  }

  async repositoryPayload(handle: SourceControlStorageHandle, orgId: string, projectRepository: ProjectRepository) {
    const repository = await handle.repositories.get({ orgId, id: projectRepository.repositoryId });
    return { ...projectRepository, repository };
  }

  async environmentPayload(orgId: string, project: FactoryProject) {
    return {
      environment: {
        ...(await this.deps.environment.payload(orgId, project)),
        ...(await this.#buildPayload(project)),
      },
    };
  }

  /**
   * The build keys of the environment payload, present only when the
   * sandbox can build. Reads the project row and the schedule row; never
   * the provider (live status is the builds routes' job).
   */
  async #buildPayload(project: FactoryProject) {
    const builds = this.deps.environmentBuilds;
    if (!builds) return {};
    const schedules = builds.scheduleAvailable ? builds.schedules() : undefined;
    const schedule = schedules
      ? await readSchedule(schedules, project.id)
      : { enabled: false, cron: null, timezone: null };
    return {
      buildTriggers: {
        schedule: { ...schedule, scheduleAvailable: builds.scheduleAvailable },
        push: { enabled: project.buildOnPushEnabled, debounceMinutes: project.buildPushDebounceMinutes },
      },
      build: project.lastBuildId
        ? { buildId: project.lastBuildId, attemptedAt: project.lastBuildAttemptedAt?.toISOString() ?? null }
        : null,
    };
  }

  /** False when sessions still use the link and nothing can retire them. */
  async retireProjectRepositorySessions(
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

  async get(context: Context, scope: EnvironmentScope): Promise<Response> {
    const project = await this.#project(scope);
    if (!project) return context.json({ error: 'Project not found' }, 404);
    return context.json(await this.environmentPayload(scope.orgId, project));
  }

  async update(context: Context, scope: EnvironmentScope): Promise<Response> {
    const project = await this.#project(scope);
    if (!project) return context.json({ error: 'Project not found' }, 404);
    const parsed = updateProjectEnvironmentBodySchema.safeParse(await readJson(context));
    if (!parsed.success) return context.json({ error: 'invalid_environment' }, 400);
    const { repositories: repositoryPatches, settings: settingsPatch, buildTriggers, ...projectInput } = parsed.data;
    const input: UpdateFactoryProjectInput = projectInput;
    const runner = this.deps.environmentBuilds;
    if (buildTriggers !== undefined) {
      if (!runner) return context.json({ error: 'no_builds' }, 400);
      if (buildTriggers.push?.enabled !== undefined) input.buildOnPushEnabled = buildTriggers.push.enabled;
      if (buildTriggers.push?.debounceMinutes !== undefined) {
        input.buildPushDebounceMinutes = buildTriggers.push.debounceMinutes;
      }
      if (buildTriggers.schedule) {
        if (!runner.scheduleAvailable) {
          if (buildTriggers.schedule.enabled) return context.json({ error: 'schedules_unavailable' }, 400);
        } else {
          const { cron, timezone } = buildTriggers.schedule;
          const stored = await readSchedule(runner.schedules()!, project.id);
          const nextCron = cron ?? stored.cron;
          // Disabling a schedule that never existed needs no cron: it is a no-op.
          if (!nextCron && buildTriggers.schedule.enabled)
            return context.json(
              {
                error: 'invalid_environment',
                issues: [{ message: 'cron is required', path: ['buildTriggers', 'schedule', 'cron'] }],
              },
              400,
            );
          const nextTimezone = timezone ?? stored.timezone ?? undefined;
          const message = nextCron ? invalidCronMessage(nextCron, nextTimezone) : undefined;
          if (message) {
            return context.json(
              { error: 'invalid_environment', issues: [{ message, path: ['buildTriggers', 'schedule', 'cron'] }] },
              400,
            );
          }
        }
      }
    }
    let updated = project;
    if (Object.keys(input).length > 0 || settingsPatch !== undefined || repositoryPatches !== undefined) {
      const result = await this.deps.environment.update(scope.orgId, scope.projectId, {
        input,
        ...(settingsPatch !== undefined ? { settings: settingsPatch } : {}),
        ...(repositoryPatches !== undefined ? { repositories: repositoryPatches } : {}),
      });
      if ('error' in result) {
        switch (result.error) {
          case 'no_sandbox':
            return context.json({ error: 'no_sandbox' }, 400);
          case 'repository_not_found':
            return context.json({ error: 'Project repository not found' }, 404);
          case 'incomplete_reorder':
            return context.json({ error: 'invalid_environment' }, 400);
          case 'invalid_settings':
            return context.json({ error: 'invalid_environment', issues: result.issues }, 400);
          case 'project_not_found':
            return context.json({ error: 'Project not found' }, 404);
        }
      }
      updated = result.project;
      runner?.onEnvironmentSaved(updated.id);
    }
    if (buildTriggers?.schedule && runner?.scheduleAvailable) {
      const stored = await readSchedule(runner.schedules()!, project.id);
      const cron = buildTriggers.schedule.cron ?? stored.cron;
      const timezone = buildTriggers.schedule.timezone ?? stored.timezone;
      // Without a cron the request disables a schedule that never existed: nothing to write.
      if (cron)
        await ensureSchedule(runner.schedules()!, project.id, {
          enabled: buildTriggers.schedule.enabled,
          cron,
          ...(timezone ? { timezone } : {}),
        });
    }
    return context.json(await this.environmentPayload(scope.orgId, updated));
  }

  async updateRepository(context: Context, scope: EnvironmentScope, projectRepositoryId: string): Promise<Response> {
    const found = await this.deps.environment.findProjectRepository({
      orgId: scope.orgId,
      projectId: scope.projectId,
      id: projectRepositoryId,
    });
    if (!found) return context.json({ error: 'Project repository not found' }, 404);
    const input = parseRepositoryUpdateInput(await readJson(context));
    if (!input) return context.json({ error: 'invalid_project_repository' }, 400);
    const projectRepository = await found.handle.projectRepositories.update({
      orgId: scope.orgId,
      id: projectRepositoryId,
      input,
    });
    this.deps.environmentBuilds?.onEnvironmentSaved(scope.projectId);
    return context.json({
      projectRepository: await this.repositoryPayload(found.handle, scope.orgId, projectRepository!),
    });
  }

  async deleteRepository(context: Context, scope: EnvironmentScope, projectRepositoryId: string): Promise<Response> {
    const found = await this.deps.environment.findProjectRepository({
      orgId: scope.orgId,
      projectId: scope.projectId,
      id: projectRepositoryId,
    });
    if (!found) return context.json({ error: 'Project repository not found' }, 404);
    if (!(await this.retireProjectRepositorySessions(found.handle, scope.orgId, projectRepositoryId))) {
      return context.json({ error: 'session_retirement_unavailable' }, 409);
    }
    await found.handle.projectRepositories.unlink({ orgId: scope.orgId, id: projectRepositoryId });
    this.deps.environmentBuilds?.onEnvironmentSaved(scope.projectId);
    return context.body(null, 204);
  }
}

export interface SandboxEnvHandlersDeps {
  sandboxEnvs: SandboxEnvStore;
  /**
   * False when auth is on but no secret encryption is configured: values would
   * be stored as plaintext, so writes are refused and the UI says why.
   */
  writable: boolean;
  audit?: AuditEmitter;
  /** Called after a variable changed; Build variables are part of the environment template. */
  onEnvironmentSaved?: (projectId: string) => void;
}

function sandboxEnvPayload(env: SandboxEnvMetadata) {
  return { name: env.name, appliesTo: env.appliesTo, updatedAt: env.updatedAt.toISOString(), updatedBy: env.updatedBy };
}

/**
 * A project's sandbox environment variables. Values go in through set and
 * never come back out: every response carries names and settings only.
 */
export class SandboxEnvHandlers {
  constructor(private readonly deps: SandboxEnvHandlersDeps) {}

  /** Validates the `:name` param; the schema names why a name is refused. */
  #name(context: Context): { name: string } | { response: Response } {
    const parsed = sandboxEnvPathSchema.shape.name.safeParse(context.req.param('name'));
    if (parsed.success) return { name: parsed.data };
    const name = context.req.param('name') ?? '';
    return {
      response: context.json(
        { error: 'invalid_name', message: `${name}: ${parsed.error.issues[0]?.message ?? 'Invalid name.'}` },
        400,
      ),
    };
  }

  async #body(context: Context): Promise<{ body: unknown } | { response: Response }> {
    const type = context.req.header('content-type') ?? '';
    if (!/^application\/json\b/i.test(type)) {
      return { response: context.json({ error: 'unsupported_media_type' }, 415) };
    }
    try {
      return { body: await context.req.json() };
    } catch {
      return { response: context.json({ error: 'invalid_body' }, 400) };
    }
  }

  /** Audit is best-effort: an event the mirror rejects must never fail the write. */
  async #audit(context: Context, scope: EnvironmentScope, input: Omit<EmitAuditInput, 'factoryProjectId'>) {
    try {
      await this.deps.audit?.emit({ context, input: { ...input, factoryProjectId: scope.projectId } });
    } catch (error) {
      console.warn('[factory] Failed to record sandbox env audit event', {
        action: input.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  #refused(context: Context) {
    return context.json(
      {
        error: 'encryption_not_configured',
        message: 'Configure a credential encryption key before saving sandbox environment variables.',
      },
      409,
    );
  }

  async list(context: Context, scope: EnvironmentScope): Promise<Response> {
    const envs = await this.deps.sandboxEnvs.list(scope.orgId, scope.projectId);
    return context.json({ envs: envs.map(sandboxEnvPayload), writable: this.deps.writable });
  }

  async set(context: Context, scope: EnvironmentScope): Promise<Response> {
    const name = this.#name(context);
    if ('response' in name) return name.response;
    if (!this.deps.writable) return this.#refused(context);
    const body = await this.#body(context);
    if ('response' in body) return body.response;
    const parsed = sandboxEnvSetBodySchema.safeParse(body.body);
    if (!parsed.success) {
      return context.json({ error: 'invalid_sandbox_env', message: parsed.error.issues[0]?.message }, 400);
    }
    const env = await this.deps.sandboxEnvs.set(
      scope.orgId,
      scope.projectId,
      { name: name.name, value: parsed.data.value, appliesTo: parsed.data.appliesTo },
      scope.userId,
    );
    await this.#audit(context, scope, {
      action: 'factory.sandbox_env.set',
      targets: [{ type: 'sandbox_env', id: env.name, name: env.name }],
      metadata: { appliesTo: env.appliesTo },
    });
    this.deps.onEnvironmentSaved?.(scope.projectId);
    return context.json({ env: sandboxEnvPayload(env) });
  }

  async update(context: Context, scope: EnvironmentScope): Promise<Response> {
    const name = this.#name(context);
    if ('response' in name) return name.response;
    if (!this.deps.writable) return this.#refused(context);
    const body = await this.#body(context);
    if ('response' in body) return body.response;
    const parsed = sandboxEnvUpdateBodySchema.safeParse(body.body);
    if (!parsed.success) {
      return context.json({ error: 'invalid_sandbox_env', message: parsed.error.issues[0]?.message }, 400);
    }
    const env = await this.deps.sandboxEnvs.updateAppliesTo(
      scope.orgId,
      scope.projectId,
      name.name,
      parsed.data.appliesTo,
      scope.userId,
    );
    if (!env) return context.json({ error: 'Variable not found', message: 'Variable not found.' }, 404);
    await this.#audit(context, scope, {
      action: 'factory.sandbox_env.updated',
      targets: [{ type: 'sandbox_env', id: env.name, name: env.name }],
      metadata: { appliesTo: env.appliesTo },
    });
    this.deps.onEnvironmentSaved?.(scope.projectId);
    return context.json({ env: sandboxEnvPayload(env) });
  }

  async delete(context: Context, scope: EnvironmentScope): Promise<Response> {
    const name = this.#name(context);
    if ('response' in name) return name.response;
    // Deleting stays allowed without encryption, so a plaintext value can always be removed.
    if (!(await this.deps.sandboxEnvs.delete(scope.orgId, scope.projectId, name.name))) {
      return context.json({ error: 'Variable not found', message: 'Variable not found.' }, 404);
    }
    await this.#audit(context, scope, {
      action: 'factory.sandbox_env.deleted',
      targets: [{ type: 'sandbox_env', id: name.name, name: name.name }],
    });
    this.deps.onEnvironmentSaved?.(scope.projectId);
    return context.body(null, 204);
  }
}
