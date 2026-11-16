/**
 * A fake Jira issue search for tests: evaluates the JQL subset intake builds
 * (`project`, `labels`, `statusCategory`, `AND`/`OR`, parentheses) against
 * fixture issues, so tests assert which issues Jira would return rather than
 * the exact query text.
 */

export interface FakeJiraIssue {
  key: string;
  projectId: string;
  projectKey: string;
  labels: string[];
  done?: boolean;
}

type Token = { kind: 'word' | 'string' | 'symbol'; value: string };

function tokenize(jql: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s*(?:"([^"]*)"|(!=|[(),=])|([A-Za-z0-9_]+))/y;
  let match: RegExpExecArray | null;
  while (pattern.lastIndex < jql.length && (match = pattern.exec(jql))) {
    if (match[1] !== undefined) tokens.push({ kind: 'string', value: match[1] });
    else if (match[2] !== undefined) tokens.push({ kind: 'symbol', value: match[2] });
    else if (match[3] !== undefined) tokens.push({ kind: 'word', value: match[3] });
  }
  if (pattern.lastIndex < jql.trimEnd().length)
    throw new Error(`Unsupported JQL near: ${jql.slice(pattern.lastIndex)}`);
  return tokens;
}

/** Whether `issue` matches `jql` (its `ORDER BY` is ignored). Throws on JQL outside the supported subset. */
export function matchesJql(jql: string, issue: FakeJiraIssue): boolean {
  const tokens = tokenize(jql.replace(/\s+ORDER BY .*$/i, ''));
  let at = 0;
  const peek = () => tokens[at];
  const take = (value?: string) => {
    const token = tokens[at++];
    if (!token || (value !== undefined && token.value.toUpperCase() !== value)) {
      throw new Error(`Expected ${value ?? 'a token'} at ${at - 1} in: ${jql}`);
    }
    return token;
  };
  const list = (): string[] => {
    take('(');
    const values = [take().value];
    while (peek()?.value === ',') {
      take(',');
      values.push(take().value);
    }
    take(')');
    return values;
  };
  const labels = issue.labels.map(label => label.toLowerCase());
  const project = (value: string) => value === issue.projectId || value.toUpperCase() === issue.projectKey;

  const atom = (): boolean => {
    if (peek()?.value === '(') {
      take('(');
      const result = or();
      take(')');
      return result;
    }
    const field = take().value.toLowerCase();
    const op = take().value.toUpperCase();
    if (field === 'project' && op === '=') return project(take().value);
    if (field === 'project' && op === 'IN') return list().some(project);
    if (field === 'statuscategory' && op === '!=') return take().value.toLowerCase() === 'done' ? !issue.done : true;
    if (field === 'labels' && op === 'IN') return list().some(label => labels.includes(label.toLowerCase()));
    if (field === 'labels' && op === 'IS') return take('EMPTY') && labels.length === 0;
    if (field === 'labels' && op === 'NOT') {
      take('IN');
      // Jira drops issues with no labels from `labels NOT IN (...)`.
      const excluded = list().map(label => label.toLowerCase());
      return labels.length > 0 && !labels.some(label => excluded.includes(label));
    }
    throw new Error(`Unsupported clause ${field} ${op} in: ${jql}`);
  };
  const and = (): boolean => {
    let result = atom();
    while (peek()?.value.toUpperCase() === 'AND') {
      take('AND');
      result = atom() && result;
    }
    return result;
  };
  const or = (): boolean => {
    let result = and();
    while (peek()?.value.toUpperCase() === 'OR') {
      take('OR');
      result = and() || result;
    }
    return result;
  };

  const result = or();
  if (at !== tokens.length) throw new Error(`Trailing JQL at ${at} in: ${jql}`);
  return result;
}

/** A Jira REST issue payload for a fixture, in the shape `/search/jql` returns. */
export function jiraIssuePayload(issue: FakeJiraIssue, id: string): Record<string, unknown> {
  return {
    id,
    key: issue.key,
    fields: {
      summary: `${issue.key} summary`,
      status: issue.done
        ? { name: 'Done', statusCategory: { key: 'done' } }
        : { name: 'To Do', statusCategory: { key: 'new' } },
      assignee: null,
      reporter: { displayName: 'Grace' },
      labels: issue.labels,
      priority: { name: 'Medium' },
      issuetype: { name: 'Task' },
      project: { id: issue.projectId, key: issue.projectKey },
      created: '2026-07-01T00:00:00Z',
      updated: '2026-07-02T00:00:00Z',
    },
  };
}
