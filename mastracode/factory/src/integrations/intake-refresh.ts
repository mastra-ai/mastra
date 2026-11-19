import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { IntegrationContext } from './base.js';
import type { IssueReconcileSummary } from './issue-reconciler.js';

/** The Factory project whose intake sources a refresh reconciles. */
export interface IntakeRefreshScope {
  orgId: string;
  factoryProjectId: string;
}

/** What one integration's refresh did. */
export interface IntakeRefreshSummary {
  /** Cards whose item was read again from the provider. */
  checked: number;
  /** Cards whose stored details changed. */
  updated: number;
  /** Cards whose item had closed, replayed through the integration's rules. */
  closed: number;
  /** Items listed from the project's sources and replayed through the rules; any without a card gets one. */
  observed: number;
  failed: number;
  /** Failure messages, at most {@link INTAKE_REFRESH_ERROR_LIMIT}. */
  errors: string[];
}

export const INTAKE_REFRESH_ERROR_LIMIT = 10;

export function emptyIntakeRefreshSummary(): IntakeRefreshSummary {
  return { checked: 0, updated: 0, closed: 0, observed: 0, failed: 0, errors: [] };
}

/** Folds a reconcile sweep's summary into a refresh summary. */
export function addReconcileSummary(
  into: IntakeRefreshSummary,
  summary: Partial<Pick<IssueReconcileSummary, 'checked' | 'updated' | 'closed' | 'failed'>> & {
    observed?: number;
    errors?: ReadonlyArray<{ error: string }>;
  },
): IntakeRefreshSummary {
  into.checked += summary.checked ?? 0;
  into.updated += summary.updated ?? 0;
  into.closed += summary.closed ?? 0;
  into.observed += summary.observed ?? 0;
  into.failed += summary.failed ?? 0;
  for (const { error } of summary.errors ?? []) {
    if (into.errors.length >= INTAKE_REFRESH_ERROR_LIMIT) break;
    into.errors.push(error);
  }
  return into;
}

/**
 * The integration's context narrowed to one Factory project, so a reconcile
 * built from it walks only that project, and writes to no other org: a
 * repository's linked projects are listed for the project's org alone, so a
 * repository another org also links is never filed or refreshed there. A
 * repository other projects of the same org link has their cards refreshed
 * too, as the webhook a refresh stands in for would have. Cards are read from
 * storage, not from the kept cards: a refresh is asked for because something
 * was missed, and a board change announcement lost between replicas is one of
 * those things. Returns null without the Factory runtime or when the project
 * is not the org's.
 */
export async function scopeIntegrationContextToProject(
  ctx: IntegrationContext,
  scope: IntakeRefreshScope,
): Promise<{ context: IntegrationContext; project: FactoryProject } | null> {
  const runtime = ctx.runtime;
  if (!runtime) return null;
  const project = await ctx.storage.projects.get({ orgId: scope.orgId, id: scope.factoryProjectId });
  if (!project) return null;
  const workItems = runtime.workItems;
  return {
    project,
    context: {
      ...ctx,
      storage: {
        ...ctx.storage,
        projects: projectsScopedTo(ctx.storage.projects, project),
        // Integrations without source control (Jira, Vanta, ...) may be handed a context with none.
        ...(ctx.storage.sourceControl
          ? { sourceControl: sourceControlScopedTo(ctx.storage.sourceControl, project.orgId) }
          : {}),
      },
      runtime: {
        ...runtime,
        keptCards: {
          projects: async () => [project],
          cards: cardScope => workItems.listShared(cardScope),
        },
      },
    },
  };
}

/** `target`, with `overrides` in place of its own members. Other methods stay bound, so private fields still work. */
function overriding<T extends object>(target: T, overrides: Partial<Record<keyof T, unknown>>): T {
  return new Proxy(target, {
    get(real, property) {
      if (Object.hasOwn(overrides, property)) return overrides[property as keyof T];
      const value: unknown = Reflect.get(real, property, real);
      return typeof value === 'function' ? value.bind(real) : value;
    },
  });
}

/** The projects storage, except `listAll` lists only `project`. */
function projectsScopedTo(projects: FactoryProjectsStorage, project: FactoryProject): FactoryProjectsStorage {
  return overriding(projects, { listAll: async () => [project] });
}

/** The source-control storage, except a repository's linked projects are only `orgId`'s. */
function sourceControlScopedTo(sourceControl: SourceControlStorageHandle, orgId: string): SourceControlStorageHandle {
  const { projectRepositories } = sourceControl;
  return overriding(sourceControl, {
    projectRepositories: overriding(projectRepositories, {
      listByExternalRepository: async (args: Parameters<typeof projectRepositories.listByExternalRepository>[0]) =>
        (await projectRepositories.listByExternalRepository(args)).filter(target => target.orgId === orgId),
    }),
  });
}
