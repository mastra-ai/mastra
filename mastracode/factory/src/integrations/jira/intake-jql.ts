/**
 * The JQL intake reads issues with, shared by the direct and Platform Jira
 * integrations.
 *
 * Several Factory projects may bind the same Jira project, each to a disjoint
 * slice of its issues chosen by label (see `IntakeStorage.setSharedBinding`).
 * The slicing happens here, in the query Jira runs, so a Factory only ever
 * fetches the issues its binding owns and no two Factories race to file the
 * same issue.
 */

/** One Jira project a Factory reads, narrowed to the slice its binding owns. */
export interface JiraIntakeScope {
  projectId: string;
  /** Labels the binding owns; `null` takes every issue no label binding claims. */
  include: string[] | null;
  /**
   * Labels the issue must not carry: for a label binding, those owned by older
   * label bindings on the project (oldest binding wins an issue both match);
   * for an all-issues binding, those owned by every label binding.
   */
  exclude: string[];
}

/** Unfiltered scopes for plain project ids, the shape every caller used before label filters. */
export function unfilteredJiraScopes(projectIds: readonly string[]): JiraIntakeScope[] {
  return projectIds.map(projectId => ({ projectId, include: null, exclude: [] }));
}

/** Numeric ids pass bare, keys are quoted, and anything outside a safe charset is dropped. */
function safeProject(projectId: string): string | null {
  const id = projectId.trim();
  if (!/^[A-Za-z0-9_]+$/.test(id)) return null;
  return /^\d+$/.test(id) ? id : `"${id}"`;
}

/** Quote labels for JQL, stripping the characters that could break out of the string. */
function safeLabels(labels: readonly string[]): string[] {
  return [...new Set(labels.map(label => label.trim().replace(/["\\]/g, '')).filter(Boolean))].map(
    label => `"${label}"`,
  );
}

/**
 * Build the intake JQL for `scopes`, optionally narrowed to issues carrying one
 * of `labels`. Returns `null` when `scopes` names no usable project, so callers
 * skip the request instead of reading the whole site. `scopes` omitted reads
 * every project.
 */
export function buildIntakeJql(scopes?: readonly JiraIntakeScope[], labels?: readonly string[]): string | null {
  const clauses: string[] = [];
  if (scopes) {
    const plain: string[] = [];
    const filtered: string[] = [];
    for (const scope of scopes) {
      const project = safeProject(scope.projectId);
      if (!project) continue;
      const exclude = safeLabels(scope.exclude);
      if (scope.include === null) {
        if (exclude.length === 0) plain.push(project);
        // `labels NOT IN` drops unlabelled issues, which an all-issues binding must keep.
        else filtered.push(`(project = ${project} AND (labels IS EMPTY OR labels NOT IN (${exclude.join(', ')})))`);
        continue;
      }
      const include = safeLabels(scope.include);
      if (include.length === 0) continue;
      // The issue carries an owned label, so plain `NOT IN` cannot drop an unlabelled one here.
      const older = exclude.length > 0 ? ` AND labels NOT IN (${exclude.join(', ')})` : '';
      filtered.push(`(project = ${project} AND labels IN (${include.join(', ')})${older})`);
    }
    const uniquePlain = [...new Set(plain)];
    const projectClauses = [...(uniquePlain.length > 0 ? [`project IN (${uniquePlain.join(', ')})`] : []), ...filtered];
    if (projectClauses.length === 0) return null;
    clauses.push(projectClauses.length === 1 ? projectClauses[0]! : `(${projectClauses.join(' OR ')})`);
  }
  clauses.push('statusCategory != Done');
  const narrowed = safeLabels(labels ?? []);
  if (narrowed.length > 0) clauses.push(`labels IN (${narrowed.join(', ')})`);
  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
}
