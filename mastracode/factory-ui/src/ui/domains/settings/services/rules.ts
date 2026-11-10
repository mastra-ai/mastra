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

const REPOSITORY_FORMATS: Record<string, string> = {
  github: 'GitHub repositories are owner/repo, such as mastra-ai/mastra.',
  gitlab: 'GitLab projects are group/project, such as acme/platform/api.',
};

/**
 * A hint when a group tests `source.repository` against a bare name while it also limits cards
 * to GitHub or GitLab, whose repositories always have an owner: that condition never matches.
 */
export function repositoryHint(rule: unknown): string | undefined {
  if (!rule || typeof rule !== 'object') return undefined;
  const entries: unknown = (rule as Group).conditions;
  if (!Array.isArray(entries)) return undefined;
  const conditions = entries.filter((entry): entry is Condition => !!entry && typeof entry === 'object');
  const integration = conditions.find(
    condition =>
      (condition.field === 'source.integration' || condition.field === 'source.provider') &&
      condition.operator === 'equals' &&
      typeof condition.value === 'string' &&
      condition.value.trim().toLowerCase() in REPOSITORY_FORMATS,
  );
  const bare = conditions.some(
    condition =>
      condition.field === 'source.repository' &&
      typeof condition.value === 'string' &&
      condition.value.trim() !== '' &&
      !condition.value.includes('/'),
  );
  if (integration && bare) return REPOSITORY_FORMATS[String(integration.value).trim().toLowerCase()];
  for (const entry of conditions) {
    const hint = repositoryHint(entry);
    if (hint) return hint;
  }
  return undefined;
}
