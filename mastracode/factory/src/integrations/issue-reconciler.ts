import type { Intake, IntakeIssue } from '../capabilities/intake.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';

export interface IssueReconcileSummary {
  projects: number;
  checked: number;
  updated: number;
  missing: number;
  failed: number;
  errors: Array<{ projectId: string; workItemId?: string; error: string }>;
}

/**
 * Scope passed in by the caller. Providers that reconcile per-repository (like
 * GitHub, sharing target discovery with the PR reconciler) pass a target set
 * and a `matches(item, scope)` predicate. Providers with no repository concept
 * (Linear) pass no scope and every issue item is considered.
 */
export interface IssueReconcileScope<TScope> {
  scopes: TScope[];
  matches(item: WorkItemRow, scope: TScope): boolean;
}

export interface IssueReconcilerOptions<TScope = void> {
  integrationId: string;
  intake: Intake;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  storage: WorkItemsStorage;
  externalSource?(item: WorkItemRow): { type: string; externalId: string };
  issueId(item: WorkItemRow): string | undefined;
  metadata(item: WorkItemRow, issue: IntakeIssue): Record<string, unknown>;
}

export type IssueReconciler<TScope = void> = TScope extends void
  ? () => Promise<IssueReconcileSummary>
  : (scope: IssueReconcileScope<TScope>) => Promise<IssueReconcileSummary>;

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(right)) {
    if (!Array.isArray(left)) return right.length === 0;
    const leftStrings = left.filter((value): value is string => typeof value === 'string').slice().sort();
    const rightStrings = right.filter((value): value is string => typeof value === 'string').slice().sort();
    return leftStrings.length === rightStrings.length && leftStrings.every((value, index) => value === rightStrings[index]);
  }
  return left === right;
}

function metadataMatches(current: Record<string, unknown> | null, desired: Record<string, unknown>): boolean {
  return Object.entries(desired).every(([key, value]) => sameValue(current?.[key], value));
}

function issueItems(project: FactoryProject, items: WorkItemRow[], integrationId: string): WorkItemRow[] {
  return items.filter(
    item =>
      item.factoryProjectId === project.id &&
      item.externalSource?.integrationId === integrationId &&
      item.externalSource.type === 'issue',
  );
}

export function createIssueReconciler<TScope = void>(
  options: IssueReconcilerOptions<TScope>,
): IssueReconciler<TScope> {
  const run = async (scope?: IssueReconcileScope<TScope>): Promise<IssueReconcileSummary> => {
    const summary: IssueReconcileSummary = {
      projects: 0,
      checked: 0,
      updated: 0,
      missing: 0,
      failed: 0,
      errors: [],
    };

    // A scoped sweep with zero targets is a no-op: the caller is telling us
    // there are no configured repositories to consider.
    if (scope && scope.scopes.length === 0) return summary;

    const projects = await options.projects.listAll();
    for (const project of projects) {
      const all = await options.storage.list({ orgId: project.orgId, factoryProjectId: project.id });
      const candidates = issueItems(project, all, options.integrationId);
      const items = scope
        ? candidates.filter(item => scope.scopes.some(target => scope.matches(item, target)))
        : candidates;
      if (items.length === 0) continue;
      summary.projects += 1;

      for (const item of items) {
        summary.checked += 1;
        try {
          const resolved = await options.intake.resolveIntakeDispatch?.({
            orgId: project.orgId,
            externalSource: options.externalSource?.(item) ?? item.externalSource!,
          });
          if (!resolved) {
            summary.missing += 1;
            continue;
          }
          const issueId = options.issueId(item) ?? resolved.issueId;
          const issue = await options.intake.getIssue({ ...resolved, issueId });
          if (!issue) {
            summary.missing += 1;
            continue;
          }
          const metadata = options.metadata(item, issue);
          if (metadataMatches(item.metadata, metadata)) continue;
          await options.storage.update({
            orgId: project.orgId,
            id: item.id,
            userId: 'factory-rule-dispatcher',
            patch: { metadata: { ...(item.metadata ?? {}), ...metadata } },
          });
          summary.updated += 1;
        } catch (error) {
          summary.failed += 1;
          summary.errors.push({
            projectId: project.id,
            workItemId: item.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return summary;
  };

  return run as IssueReconciler<TScope>;
}
