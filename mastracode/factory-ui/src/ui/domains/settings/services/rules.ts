import type { z } from 'zod';

type RuleIssue = { path: PropertyKey[]; message: string; code: string; errors?: RuleIssue[][] };

/** Zod issues as `path: message`, following the closest branch of a condition-or-group union. */
function describeIssues(issues: RuleIssue[], prefix: PropertyKey[] = []): string[] {
  return issues.flatMap(issue => {
    const path = [...prefix, ...issue.path];
    if (issue.code === 'invalid_union' && issue.errors?.length) {
      const closest = issue.errors.reduce((best, branch) => (branch.length < best.length ? branch : best));
      return describeIssues(closest, path);
    }
    return [`${path.map(String).join('.') || 'rule'}: ${issue.message}`];
  });
}

/** Why the server would refuse this rule, if it would. */
function validateRule<Rule>(schema: z.ZodType<Rule>, value: unknown): { rule: Rule } | { problem: string } {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { rule: parsed.data };
  return { problem: describeIssues(parsed.error.issues).join('; ') };
}

export function ruleProblem<Rule>(schema: z.ZodType<Rule>, rule: Rule | null | undefined): string | undefined {
  if (rule == null) return undefined;
  const checked = validateRule(schema, rule);
  return 'problem' in checked ? checked.problem : undefined;
}

/** A rule typed as JSON, or why the server would refuse it. Empty text clears the rule. */
export function readRawRule<Rule>(schema: z.ZodType<Rule>, text: string): { rule: Rule | null } | { problem: string } {
  if (text.trim() === '') return { rule: null };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { problem: 'Not valid JSON.' };
  }
  return validateRule(schema, value);
}

/** Why the server would refuse a rule typed as JSON, if it would. */
export function rawRuleProblem<Rule>(schema: z.ZodType<Rule>, text: string): string | undefined {
  const read = readRawRule(schema, text);
  return 'problem' in read ? read.problem : undefined;
}

type Condition = { field?: unknown; operator?: unknown; value?: unknown };
type Group = { conditions?: unknown };

const REPOSITORY_FORMATS = new Map([
  ['github', 'GitHub repositories are owner/repo, such as mastra-ai/mastra.'],
  ['gitlab', 'GitLab projects are group/project, such as acme/platform/api.'],
]);

/** The repository names a condition requires one of: "is" and "is any of" only, since the others can still match. */
function requiredRepositories(condition: Condition): string[] {
  if (condition.field !== 'source.repository') return [];
  if (condition.operator === 'equals' && typeof condition.value === 'string') return [condition.value];
  if (condition.operator === 'in' && Array.isArray(condition.value)) {
    return condition.value.filter((value): value is string => typeof value === 'string');
  }
  return [];
}

/**
 * A hint when a group requires `source.repository` to be a bare name while it also limits cards
 * to GitHub or GitLab, whose repositories always have an owner: that name never matches.
 */
export function repositoryHint(rule: unknown): string | undefined {
  if (!rule || typeof rule !== 'object') return undefined;
  const entries: unknown = (rule as Group).conditions;
  if (!Array.isArray(entries)) return undefined;
  const conditions = entries.filter((entry): entry is Condition => !!entry && typeof entry === 'object');
  const format = conditions
    .filter(
      condition =>
        (condition.field === 'source.integration' || condition.field === 'source.provider') &&
        condition.operator === 'equals' &&
        typeof condition.value === 'string',
    )
    .map(condition => REPOSITORY_FORMATS.get(String(condition.value).trim().toLowerCase()))
    .find(found => found !== undefined);
  const bare = conditions.flatMap(requiredRepositories).some(value => value.trim() !== '' && !value.includes('/'));
  if (format && bare) return format;
  for (const entry of conditions) {
    const hint = repositoryHint(entry);
    if (hint) return hint;
  }
  return undefined;
}
