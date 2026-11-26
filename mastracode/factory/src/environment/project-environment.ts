import type { StandardSchemaWithJSON } from '@mastra/core/schema';
import { describeFactorySandbox, normalizeFactorySandboxSettings } from '@mastra/core/workspace';
import type { FactorySandbox, FactorySandboxDescription } from '@mastra/core/workspace';

import type {
  FactoryProject,
  FactoryProjectsStorage,
  UpdateFactoryProjectInput,
} from '../storage/domains/projects/base.js';
import type {
  ProjectRepository,
  SourceControlStorage,
  SourceControlStorageHandle,
  UpdateProjectRepositoryInput,
} from '../storage/domains/source-control/base.js';

/** What the environment reports when there is no sandbox configured. */
const NO_SANDBOX: FactorySandboxDescription = {
  provider: 'none',
  settingsSchema: { type: 'object', properties: {}, additionalProperties: false },
  capabilities: { template: false, builds: { available: false, history: false } },
};

export interface ProjectEnvironmentDeps {
  projects: FactoryProjectsStorage;
  sourceControl: SourceControlStorage;
  /** Integration ids whose linked repositories make up the environment. */
  integrationIds: readonly string[];
  /** The sandbox that describes and validates the environment settings. */
  sandbox?: FactorySandbox;
}

export interface EnvironmentUpdate {
  input: UpdateFactoryProjectInput;
  /** Partial settings merged onto the stored document; null removes a key. */
  settings?: Record<string, unknown | null>;
  repositories?: Array<UpdateProjectRepositoryInput & { projectRepositoryId: string }>;
}

export type EnvironmentIssue = { message: string; path: unknown[] };

export type EnvironmentUpdateResult =
  | { project: FactoryProject }
  | { error: 'project_not_found' | 'repository_not_found' | 'incomplete_reorder' | 'no_sandbox' }
  | { error: 'invalid_settings'; issues: EnvironmentIssue[] };

/**
 * A project's environment: the sandbox settings, working directory, setup
 * command and linked repositories stored on the project and its source-control
 * links. Shared by Factory's project routes and any host that serves the same
 * environment under its own routes.
 */
export class ProjectEnvironment {
  #sandboxDescription: FactorySandboxDescription | undefined;
  #settingsSchema: StandardSchemaWithJSON | undefined;

  constructor(private readonly deps: ProjectEnvironmentDeps) {}

  describeSandbox(): FactorySandboxDescription {
    if (!this.deps.sandbox) return NO_SANDBOX;
    this.#sandboxDescription ??= describeFactorySandbox(this.deps.sandbox);
    return this.#sandboxDescription;
  }

  /**
   * Merge a settings patch onto the stored document (null removes a key) and
   * validate the result through the sandbox's schema. Returns the issues when
   * the merged document is rejected.
   *
   * A stored key the current schema does not declare, or whose stored value it
   * now rejects (a tightened range or choice list), is left over from another
   * provider or an older schema. When the merged document fails validation, the
   * merge retries without those keys so one stale value cannot lock every later
   * update; keys the patch itself sets are never pruned.
   */
  async mergeSettings(
    stored: Record<string, unknown>,
    patch: Record<string, unknown | null>,
  ): Promise<
    { merged: Record<string, unknown> | null } | { issues: ReadonlyArray<{ message: string; path?: unknown }> }
  > {
    const merged: Record<string, unknown> = { ...stored };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete merged[key];
      else merged[key] = value;
    }
    this.#settingsSchema ??= normalizeFactorySandboxSettings(this.deps.sandbox!);
    const result = await this.#settingsSchema['~standard'].validate(merged);
    if (!result.issues) return { merged: Object.keys(merged).length > 0 ? merged : null };

    const declared = this.describeSandbox().settingsSchema.properties ?? {};
    const rejected = new Set(
      result.issues.map(issue => {
        const segment = issue.path?.[0];
        return typeof segment === 'object' && segment !== null ? segment.key : segment;
      }),
    );
    const pruned = Object.fromEntries(
      Object.entries(merged).filter(([key]) => key in patch || (Object.hasOwn(declared, key) && !rejected.has(key))),
    );
    if (Object.keys(pruned).length === Object.keys(merged).length) return { issues: result.issues };
    const retried = await this.#settingsSchema['~standard'].validate(pruned);
    if (retried.issues) return { issues: result.issues };
    return { merged: Object.keys(pruned).length > 0 ? pruned : null };
  }

  /**
   * The stored settings without the keys the sandbox's schema now rejects (a
   * tightened range or choice list), so the sandbox falls back to its default
   * for them. Undefined when nothing is rejected.
   */
  async #withoutRejected(stored: Record<string, unknown>): Promise<Record<string, unknown> | null | undefined> {
    this.#settingsSchema ??= normalizeFactorySandboxSettings(this.deps.sandbox!);
    const result = await this.#settingsSchema['~standard'].validate(stored);
    if (!result.issues) return undefined;
    const rejected = new Set(
      result.issues.map(issue => {
        const segment = issue.path?.[0];
        return typeof segment === 'object' && segment !== null ? segment.key : segment;
      }),
    );
    const kept = Object.fromEntries(Object.entries(stored).filter(([key]) => !rejected.has(key)));
    if (Object.keys(kept).length === Object.keys(stored).length) return undefined;
    return Object.keys(kept).length > 0 ? kept : null;
  }

  /** The project with any stored setting its sandbox now rejects removed, saved when one was. */
  async #withValidSettings(orgId: string, project: FactoryProject): Promise<FactoryProject> {
    if (!this.deps.sandbox || !project.sandboxSettings) return project;
    if ((await this.#withoutRejected(project.sandboxSettings)) === undefined) return project;
    const projects = await this.projects();
    const saved = await projects.update({
      orgId,
      id: project.id,
      input: async current => {
        if (!current.sandboxSettings) return null;
        const sandboxSettings = await this.#withoutRejected(current.sandboxSettings);
        return sandboxSettings === undefined ? null : { sandboxSettings };
      },
    });
    return saved ?? (await projects.get({ orgId, id: project.id })) ?? project;
  }

  async projects(): Promise<FactoryProjectsStorage> {
    await this.deps.projects.ensureReady();
    return this.deps.projects;
  }

  async sourceControl(): Promise<SourceControlStorage> {
    await this.deps.sourceControl.ensureReady();
    return this.deps.sourceControl;
  }

  async handles(): Promise<SourceControlStorageHandle[]> {
    const storage = await this.sourceControl();
    return this.deps.integrationIds.map(integrationId => storage.forIntegration(integrationId));
  }

  async findProjectRepository({ orgId, projectId, id }: { orgId: string; projectId: string; id: string }) {
    for (const handle of await this.handles()) {
      const projectRepository = await handle.projectRepositories.get({ orgId, id });
      if (!projectRepository) continue;
      const connection = await handle.connections.get({ orgId, id: projectRepository.connectionId });
      if (connection?.factoryProjectId === projectId) return { handle, connection, projectRepository };
    }
    return null;
  }

  /** Every link of the project across every handle, with the handle that owns it, in position order. */
  async links(orgId: string, projectId: string) {
    const links: Array<{ handle: SourceControlStorageHandle; projectRepository: ProjectRepository }> = [];
    for (const handle of await this.handles()) {
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

  /** The environment as `projectEnvironmentResponseSchema` describes it, minus the build keys. */
  async payload(orgId: string, storedProject: FactoryProject) {
    const project = await this.#withValidSettings(orgId, storedProject);
    const repositories = [];
    for (const { handle, projectRepository } of await this.links(orgId, project.id)) {
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
      });
    }
    return {
      sandbox: this.describeSandbox(),
      settings: project.sandboxSettings ?? {},
      sandboxWorkingDirectory: project.sandboxWorkingDirectory,
      workspaceSetupCommand: project.workspaceSetupCommand,
      activeTemplateId: project.activeTemplateId,
      activeTemplateHeads: project.activeTemplateHeads,
      repositories,
    };
  }

  /**
   * Apply an environment update. One transaction holds the project row, so the
   * settings merge and the link writes either all land or none do, and
   * concurrent updates apply in turn.
   */
  async update(orgId: string, projectId: string, update: EnvironmentUpdate): Promise<EnvironmentUpdateResult> {
    const { input, settings: settingsPatch, repositories: repositoryPatches } = update;
    if (settingsPatch !== undefined && !this.deps.sandbox) return { error: 'no_sandbox' };
    const projects = await this.projects();
    if (Object.keys(input).length === 0 && settingsPatch === undefined && repositoryPatches === undefined) {
      const project = await projects.get({ orgId, id: projectId });
      return project ? { project } : { error: 'project_not_found' };
    }

    let issues: ReadonlyArray<{ message: string; path?: unknown }> | undefined;
    let repositoryOutcome: 'updated' | 'not_found' | 'incomplete_reorder' | undefined;
    const sourceControl = await this.sourceControl();
    const result = await projects.update({
      orgId,
      id: projectId,
      input: async (current, ops) => {
        let sandboxSettings: Record<string, unknown> | null | undefined;
        if (settingsPatch !== undefined) {
          const settings = await this.mergeSettings(current.sandboxSettings ?? {}, settingsPatch);
          if ('issues' in settings) {
            issues = settings.issues;
            return null;
          }
          sandboxSettings = settings.merged;
        }
        if (repositoryPatches !== undefined) {
          repositoryOutcome = await sourceControl.updateEnvironmentRepositories(ops, {
            factoryProjectId: current.id,
            integrationIds: [...this.deps.integrationIds],
            patches: repositoryPatches,
          });
          if (repositoryOutcome !== 'updated') return null;
        }
        return { ...input, ...(sandboxSettings !== undefined ? { sandboxSettings } : {}) };
      },
    });
    if (repositoryOutcome === 'not_found') return { error: 'repository_not_found' };
    if (repositoryOutcome === 'incomplete_reorder') return { error: 'incomplete_reorder' };
    if (issues) {
      return {
        error: 'invalid_settings',
        issues: issues.map(issue => ({
          message: issue.message,
          path: Array.isArray(issue.path)
            ? issue.path.map(segment =>
                typeof segment === 'object' && segment !== null && 'key' in segment ? segment.key : segment,
              )
            : [],
        })),
      };
    }
    return result ? { project: result } : { error: 'project_not_found' };
  }
}
