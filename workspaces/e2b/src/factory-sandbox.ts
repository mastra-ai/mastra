import type { PublicSchema } from '@mastra/core/schema';
import { BaseFactorySandbox } from '@mastra/core/workspace';
import type {
  FactorySandboxBuild,
  FactorySandboxBuildStart,
  FactorySandboxBuildStatus,
  FactorySandboxBuilds,
  FactorySandboxContext,
} from '@mastra/core/workspace';
import { ApiClient, ConnectionConfig, Template } from 'e2b';
import type { ConnectionOpts, TemplateBuildStatus, TemplateClass } from 'e2b';

import { E2BSandbox } from './sandbox';
import type { E2BSandboxOptions } from './sandbox';
import { createRepoTemplate, resolveSpecAtHead } from './utils/repo-template';
import type { RepoTemplateOptions } from './utils/repo-template';
import type { DeferredNamedTemplateSpec } from './utils/template';

/** User-tunable settings of an E2B factory sandbox. Every field is optional; absent means the provider default. */
export interface E2BFactorySandboxSettings extends Record<string, unknown> {
  /** vCPUs for the sandbox template. Part of the template identity. */
  cpuCount?: number;
  /** Memory in MB for the sandbox template. Part of the template identity. */
  memoryMb?: number;
}

const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    cpuCount: {
      type: 'integer',
      title: 'CPU',
      description: 'vCPUs for the sandbox template (E2B default 2)',
      minimum: 1,
      maximum: 8,
    },
    memoryMb: {
      type: 'integer',
      title: 'Memory (MB)',
      description: 'Memory in MB for the sandbox template (E2B default 1024)',
      minimum: 512,
      maximum: 8192,
    },
  },
  additionalProperties: false,
} as const satisfies PublicSchema;

export interface E2BFactorySandboxOptions extends Omit<E2BSandboxOptions, 'id' | 'sandboxId' | 'template'> {
  /** Provider-side defaults used when a setting is unset. Never stored by factory. */
  defaults?: Partial<E2BFactorySandboxSettings>;
}

/** The id of a build that needed no build: the sha-tagged template already existed. */
const EXISTING_BUILD = 'existing';

/**
 * The E2B host contract for factory: every session sandbox is an
 * {@link E2BSandbox} whose template is {@link createRepoTemplate} over the
 * session's repositories, sized by the factory's environment settings. The
 * `builds` capability starts the same sha-tagged template ahead of any
 * session and reads its status, logs and history back from E2B.
 */
export class E2BFactorySandbox extends BaseFactorySandbox<E2BFactorySandboxSettings> {
  readonly provider = 'e2b';
  readonly settings: PublicSchema<E2BFactorySandboxSettings> = SETTINGS_SCHEMA;
  readonly templateFields = ['cpuCount', 'memoryMb'] as const;
  readonly builds: FactorySandboxBuilds<E2BFactorySandboxSettings>;

  readonly #options: E2BFactorySandboxOptions;
  readonly #connection: ConnectionOpts;

  constructor(options: E2BFactorySandboxOptions = {}) {
    super();
    this.#options = options;
    this.#connection = {
      ...(options.domain && { domain: options.domain }),
      ...(options.apiUrl && { apiUrl: options.apiUrl }),
      ...(options.apiKey && { apiKey: options.apiKey }),
      ...(options.accessToken && { accessToken: options.accessToken }),
    };
    this.builds = {
      start: (ctx, settings) => this.#startBuild(ctx, settings),
      get: (_ctx, _settings, buildId) => this.#getBuild(buildId),
      list: (ctx, settings) => this.#listBuilds(ctx, settings),
    };
  }

  template(ctx: FactorySandboxContext, settings: E2BFactorySandboxSettings): DeferredNamedTemplateSpec | undefined {
    return createRepoTemplate(this.#templateOptions(ctx, settings));
  }

  create(ctx: FactorySandboxContext, settings: E2BFactorySandboxSettings): E2BSandbox {
    const { defaults: _defaults, ...options } = this.#options;
    return new E2BSandbox({
      ...options,
      id: ctx.sessionId,
      sandboxId: ctx.sandboxId,
      template: this.template(ctx, settings),
    });
  }

  #templateOptions(ctx: FactorySandboxContext, settings: E2BFactorySandboxSettings): RepoTemplateOptions {
    const { defaults } = this.#options;
    const cpuCount = settings.cpuCount ?? defaults?.cpuCount;
    const memoryMB = settings.memoryMb ?? defaults?.memoryMb;
    const { resolveHead: _resolveHead, ...rest } = ctx;
    return {
      ...rest,
      ...(cpuCount !== undefined ? { cpuCount } : {}),
      ...(memoryMB !== undefined ? { memoryMB } : {}),
    };
  }

  async #startBuild(
    ctx: FactorySandboxContext,
    settings: E2BFactorySandboxSettings,
  ): Promise<FactorySandboxBuildStart> {
    const { spec } = await resolveSpecAtHead(this.#templateOptions(ctx, settings));
    if (await Template.exists(spec.ref, this.#connection)) {
      return { buildId: `${spec.ref}:${EXISTING_BUILD}`, templateId: spec.ref, status: 'ready' };
    }
    const info = await Template.buildInBackground(spec.template as TemplateClass, spec.ref, {
      ...this.#connection,
      ...(spec.buildTags?.length ? { tags: spec.buildTags } : {}),
      ...spec.buildResources,
    });
    return { buildId: `${info.templateId}:${info.buildId}`, templateId: info.templateId, status: 'pending' };
  }

  async #getBuild(compositeId: string): Promise<FactorySandboxBuild> {
    const { templateId, buildId } = splitBuildId(compositeId);
    if (buildId === EXISTING_BUILD) {
      return { buildId: compositeId, templateId, status: 'ready' };
    }
    const response = await Template.getBuildStatus({ templateId, buildId }, this.#connection);
    const logs = response.logEntries?.length
      ? response.logEntries.map(entry => entry.toString())
      : response.logs?.length
        ? response.logs
        : undefined;
    return {
      buildId: compositeId,
      templateId: response.templateID,
      status: mapStatus(response.status),
      ...(logs ? { logs } : {}),
      ...(response.reason?.message ? { error: response.reason.message } : {}),
    };
  }

  async #listBuilds(ctx: FactorySandboxContext, settings: E2BFactorySandboxSettings): Promise<FactorySandboxBuild[]> {
    // One E2B template carries every sha-tagged build of the family, so the
    // history is that template's builds, not one row per template.
    const { spec } = await resolveSpecAtHead(this.#templateOptions(ctx, settings));
    const name = templateNameOf(spec.ref);
    const client = new ApiClient(new ConnectionConfig(this.#connection));
    const templates = await client.api.GET('/templates');
    if (templates.error || !templates.data) {
      throw new Error(`E2B template listing failed: ${describeApiError(templates.error)}`);
    }
    const template = templates.data.find(t => t.names.includes(name) || t.aliases.includes(name));
    if (!template) return [];
    const detail = await client.api.GET('/templates/{templateID}', {
      params: { path: { templateID: template.templateID } },
    });
    if (detail.error || !detail.data) {
      throw new Error(`E2B template build listing failed: ${describeApiError(detail.error)}`);
    }
    return detail.data.builds
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(build => ({
        buildId: `${template.templateID}:${build.buildID}`,
        templateId: template.templateID,
        status: mapStatus(build.status),
        startedAt: build.createdAt,
        ...(build.finishedAt ? { finishedAt: build.finishedAt } : {}),
      }));
  }
}

function describeApiError(error: unknown): string {
  return error ? JSON.stringify(error) : 'empty response';
}

/** `<templateId>:<buildId>`, split on the last colon because a template ref itself carries one (`name:sha-<head>`). */
function splitBuildId(compositeId: string): { templateId: string; buildId: string } {
  const at = compositeId.lastIndexOf(':');
  if (at <= 0 || at === compositeId.length - 1) {
    throw new Error(`Invalid E2B build id "${compositeId}": expected "<templateId>:<buildId>"`);
  }
  return { templateId: compositeId.slice(0, at), buildId: compositeId.slice(at + 1) };
}

/** The template name of a `name:tag` ref. */
function templateNameOf(ref: string): string {
  const at = ref.lastIndexOf(':');
  return at > 0 ? ref.slice(0, at) : ref;
}

function mapStatus(status: TemplateBuildStatus): FactorySandboxBuildStatus {
  switch (status) {
    case 'waiting':
      return 'pending';
    case 'building':
      return 'building';
    case 'ready':
      return 'ready';
    case 'error':
      return 'failed';
    default:
      return 'unknown';
  }
}
