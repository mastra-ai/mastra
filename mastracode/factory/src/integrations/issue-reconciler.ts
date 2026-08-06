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

export interface IssueReconcilerOptions {
  integrationId: string;
  intake: Intake;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  storage: WorkItemsStorage;
  externalSource?(item: WorkItemRow): { type: string; externalId: string };
  issueId(item: WorkItemRow): string | undefined;
  metadata(item: WorkItemRow, issue: IntakeIssue): Record<string, unknown>;
}

export type IssueReconciler = () => Promise<IssueReconcileSummary>;

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

export function createIssueReconciler(options: IssueReconcilerOptions): IssueReconciler {
  return async () => {
    const summary: IssueReconcileSummary = {
      projects: 0,
      checked: 0,
      updated: 0,
      missing: 0,
      failed: 0,
      errors: [],
    };

    const projects = await options.projects.listAll();
    for (const project of projects) {
      const items = issueItems(
        project,
        await options.storage.list({ orgId: project.orgId, factoryProjectId: project.id }),
        options.integrationId,
      );
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
}
