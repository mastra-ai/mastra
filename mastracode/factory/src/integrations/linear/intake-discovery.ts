import type { IntakeIssue } from '../../capabilities/intake.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { LinearIntegration } from './integration.js';
import type { LinearIssueIngress, LinearRules } from './rules.js';

/**
 * Listing calls made per project each run. A call answers up to 30 of the most
 * recently updated active issues per stream: one stream for the bound Linear
 * projects and one for the bound teams, or one per bound source on Platform.
 */
export const LINEAR_INTAKE_DISCOVERY_MAX_PAGES = 5;

export interface LinearIntakeDiscoverySummary {
  /** Issues handed to the Linear rules (new and already carded). */
  observed: number;
  failed: number;
  errors: Array<{ projectId: string; error: string }>;
}

export interface LinearIntakeDiscoveryOptions {
  linear: Pick<LinearIntegration, 'intake' | 'loadConnection' | 'getFreshAccessToken'>;
  intake: Pick<IntakeStorage, 'ensureReady' | 'getConfig' | 'listBindings'>;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  rules: Pick<LinearRules, 'ingest'>;
}

export function issueToIngress(issue: IntakeIssue): LinearIssueIngress {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state ?? '',
    stateType: issue.stateType ?? '',
    priorityLabel: issue.priority ?? '',
    assignee: issue.assignee ?? null,
    creator: issue.author ?? null,
    team: issue.source ?? null,
    labels: [...(issue.labels ?? [])],
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    sourceId: issue.sourceId ?? null,
    projectId: issue.projectId ?? null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Feeds every project's bound Linear sources through the Linear rules, so a new
 * issue gets its card (and custom `issueObserved` rules see updates) without a
 * board open. Lists exactly what the board's issue list shows for the project.
 */
export function createLinearIntakeDiscovery(options: LinearIntakeDiscoveryOptions) {
  const { linear, intake, rules } = options;

  return async function discover(): Promise<LinearIntakeDiscoverySummary> {
    const summary: LinearIntakeDiscoverySummary = { observed: 0, failed: 0, errors: [] };
    const projectsByOrg = new Map<string, string[]>();
    for (const project of await options.projects.listAll()) {
      projectsByOrg.set(project.orgId, [...(projectsByOrg.get(project.orgId) ?? []), project.id]);
    }

    for (const [orgId, projectIds] of projectsByOrg) {
      let bound: Array<[string, string[]]>;
      let selectedIds: string[];
      let accessToken: string;
      try {
        await intake.ensureReady();
        const selection = (await intake.getConfig({ orgId, integrationIds: ['linear'] })).linear;
        selectedIds = selection?.enabled ? (selection.sourceIds ?? []) : [];
        if (selectedIds.length === 0) continue;
        const bindings = await intake.listBindings({ orgId, integrationId: 'linear' });
        bound = projectIds
          .map((id): [string, string[]] => [
            id,
            bindings
              .filter(binding => binding.factoryProjectId === id && selectedIds.includes(binding.sourceId))
              .map(binding => binding.sourceId),
          ])
          .filter(([, sourceIds]) => sourceIds.length > 0);
        if (bound.length === 0) continue;
        const connection = await linear.loadConnection(orgId);
        if (!connection) continue;
        accessToken = await linear.getFreshAccessToken(connection);
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({ projectId: `org:${orgId}`, error: errorMessage(error) });
        continue;
      }

      for (const [factoryProjectId, sourceIds] of bound) {
        try {
          const issues: LinearIssueIngress[] = [];
          let cursor: string | undefined;
          for (let page = 0; page < LINEAR_INTAKE_DISCOVERY_MAX_PAGES; page += 1) {
            const result = await linear.intake.listIssues({
              connection: { type: 'oauth', accessToken },
              sourceIds,
              // Precedence (project beats team) is resolved against the whole selection.
              attributionSourceIds: selectedIds,
              cursor,
            });
            for (const issue of result.issues) {
              if (issue.sourceId != null && sourceIds.includes(issue.sourceId)) issues.push(issueToIngress(issue));
            }
            if (!result.nextCursor) break;
            cursor = result.nextCursor;
          }
          if (issues.length === 0) continue;
          await rules.ingest({ orgId, userId: 'factory-rule-dispatcher', factoryProjectId, issues });
          summary.observed += issues.length;
        } catch (error) {
          summary.failed += 1;
          summary.errors.push({ projectId: factoryProjectId, error: errorMessage(error) });
        }
      }
    }

    return summary;
  };
}
