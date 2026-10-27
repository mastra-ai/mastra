import { bindingLabelSlice, bindingTakesIssue } from '../../storage/domains/intake/base.js';
import type { IntakeSourceBinding, IntakeStorage } from '../../storage/domains/intake/base.js';
import type { JiraIntakeScope } from './intake-jql.js';

/** The selected Jira projects that feed one Factory project, and the slice of each it takes. */
export interface JiraProjectScope {
  /** Bound board per source id, for the rules that land new cards. */
  intakeBoards: Record<string, string>;
  /** One JQL scope per bound source, narrowed to this Factory's label slice. */
  scopes: JiraIntakeScope[];
  /** Whether an issue from `sourceId` carrying `labels` belongs to this Factory. */
  takes(sourceId: string, labels: readonly string[]): boolean;
}

/**
 * Narrow the caller's selected Jira projects to the ones that feed this
 * Factory project, with the label slice its binding takes from each.
 *
 * A Jira issue carries no Factory project of its own, so without a binding
 * every board view would ingest every selected project's issues into whichever
 * Factory happened to be on screen. Routing is explicit: a project feeds this
 * Factory only when its binding names both the Factory project and a board.
 * Several Factories may share a project; their slices are disjoint, so each
 * issue feeds exactly one of them.
 */
export async function scopeJiraSourcesToProject({
  intake,
  orgId,
  factoryProjectId,
  selectedIds,
}: {
  intake: Pick<IntakeStorage, 'listBindings'>;
  orgId: string;
  factoryProjectId: string;
  selectedIds: readonly string[];
}): Promise<JiraProjectScope> {
  const selected = new Set(selectedIds);
  const bySource = new Map<string, IntakeSourceBinding[]>();
  for (const binding of await intake.listBindings({ orgId, integrationId: 'jira' })) {
    bySource.set(binding.sourceId, [...(bySource.get(binding.sourceId) ?? []), binding]);
  }
  const intakeBoards: Record<string, string> = {};
  const scopes: JiraIntakeScope[] = [];
  const owned = new Map<string, { binding: IntakeSourceBinding; siblings: IntakeSourceBinding[] }>();
  for (const [sourceId, siblings] of bySource) {
    const binding = siblings.find(candidate => candidate.factoryProjectId === factoryProjectId);
    if (!binding?.board || !selected.has(sourceId)) continue;
    intakeBoards[sourceId] = binding.board;
    scopes.push({ projectId: sourceId, ...bindingLabelSlice(binding, siblings) });
    owned.set(sourceId, { binding, siblings });
  }
  return {
    intakeBoards,
    scopes,
    takes(sourceId, labels) {
      const entry = owned.get(sourceId);
      return entry !== undefined && bindingTakesIssue(entry.binding, entry.siblings, labels);
    },
  };
}
