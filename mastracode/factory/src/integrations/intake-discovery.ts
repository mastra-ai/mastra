import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { IssueReconcileSummary } from './issue-reconciler.js';

export const INTAKE_DISCOVERY_MAX_PAGES = 5;

export type IntakeDiscoverySummary = IssueReconcileSummary & {
  /** Listed issues replayed through the provider rules (first sight creates the card). */
  observed: number;
};

interface IntakePage<TIssue> {
  issues: TIssue[];
  nextCursor: string | null;
}

export interface IntakeDiscoveryOptions<TIssue> {
  integrationId: string;
  intake: Pick<IntakeStorage, 'ensureReady' | 'getConfig'>;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  /** The pager over what the project's board lists, or null when no selected source feeds the project. */
  open(
    project: FactoryProject,
    selectedIds: string[],
  ): Promise<((cursor: string | undefined) => Promise<IntakePage<TIssue>>) | null>;
  ingest(input: { orgId: string; userId: string; factoryProjectId: string; issues: TIssue[] }): Promise<unknown>;
}

/**
 * Extend a provider's reconcile sweep so it also files issues nobody has
 * carded yet: after refreshing existing cards, list what each project's board
 * shows and replay it through the provider rules. Providers that send Factory
 * no events have no other first-sight path. A failing project is recorded and
 * the sweep moves on.
 */
export function withIntakeDiscovery<TIssue>(
  reconcile: () => Promise<IssueReconcileSummary>,
  options: IntakeDiscoveryOptions<TIssue>,
): () => Promise<IntakeDiscoverySummary> {
  return async () => {
    const summary: IntakeDiscoverySummary = { ...(await reconcile()), observed: 0 };
    for (const project of await options.projects.listAll()) {
      try {
        await options.intake.ensureReady();
        const config = await options.intake.getConfig({
          orgId: project.orgId,
          integrationIds: [options.integrationId],
        });
        const selection = config[options.integrationId];
        if (!selection?.enabled) continue;
        const listPage = await options.open(project, selection.sourceIds ?? []);
        if (!listPage) continue;

        let cursor: string | undefined;
        for (let page = 0; page < INTAKE_DISCOVERY_MAX_PAGES; page += 1) {
          const { issues, nextCursor } = await listPage(cursor);
          if (issues.length > 0) {
            await options.ingest({
              orgId: project.orgId,
              userId: 'factory-rule-dispatcher',
              factoryProjectId: project.id,
              issues,
            });
            summary.observed += issues.length;
          }
          if (!nextCursor) break;
          cursor = nextCursor;
        }
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({ projectId: project.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return summary;
  };
}
