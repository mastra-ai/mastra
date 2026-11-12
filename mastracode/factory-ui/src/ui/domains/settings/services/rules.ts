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
type Group = { operator?: unknown; conditions?: unknown };

/** A condition another one is tested alongside: a provider limit, say. */
export type Limit = { field: string; operator: string; value?: unknown };

/**
 * The conditions every card a group tests also meets: those of the AND groups around it, plus, in
 * an AND group, its own conditions. An OR group adds none, since a card meets only one of them.
 */
export function andLimits<Row>(logic: unknown, limits: readonly Row[], rows: readonly Row[]): Row[] {
  return logic === 'AND' ? [...limits, ...rows] : [...limits];
}

const PROVIDER_FIELDS = new Set(['source.provider', 'source.integration']);

/** The providers a card meeting these conditions can come from, or `undefined` when none limits them. */
export function limitedProviders(limits: readonly Limit[]): Set<string> | undefined {
  let allowed: Set<string> | undefined;
  for (const limit of limits) {
    if (!PROVIDER_FIELDS.has(limit.field)) continue;
    const values =
      limit.operator === 'equals' && typeof limit.value === 'string'
        ? [limit.value]
        : limit.operator === 'in' && Array.isArray(limit.value)
          ? limit.value.filter((value): value is string => typeof value === 'string')
          : undefined;
    if (!values) continue;
    const these = new Set(values.map(value => value.trim().toLowerCase()));
    allowed = allowed ? new Set([...allowed].filter(provider => these.has(provider))) : these;
  }
  return allowed;
}

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

const isGroup = (entry: object): entry is Group => Array.isArray((entry as Group).conditions);

const asLimit = (condition: Condition): Limit[] =>
  typeof condition.field === 'string' && typeof condition.operator === 'string'
    ? [{ field: condition.field, operator: condition.operator, value: condition.value }]
    : [];

/** The format a bare repository name breaks, when every provider the limits allow has an owner in its paths. */
function formatFor(limits: readonly Limit[]): string | undefined {
  const providers = [...(limitedProviders(limits) ?? [])];
  if (providers.length === 0 || !providers.every(provider => REPOSITORY_FORMATS.has(provider))) return undefined;
  return REPOSITORY_FORMATS.get(providers[0]);
}

function hintIn(group: Group, limits: readonly Condition[]): string | undefined {
  const entries: unknown[] = Array.isArray(group.conditions) ? group.conditions : [];
  const items = entries.filter((entry): entry is object => !!entry && typeof entry === 'object');
  const rows = items.filter((item): item is Condition => !isGroup(item));
  const here = andLimits(group.operator, limits, rows);
  for (const item of items) {
    const hint = isGroup(item)
      ? hintIn(item, here)
      : requiredRepositories(item).some(value => value.trim() !== '' && !value.includes('/'))
        ? formatFor(here.filter(limit => limit !== item).flatMap(asLimit))
        : undefined;
    if (hint) return hint;
  }
  return undefined;
}

/**
 * A hint when a condition requires `source.repository` to be a bare name while every card it tests
 * also comes from GitHub or GitLab, whose repositories always have an owner: that name never matches.
 */
export function repositoryHint(rule: unknown): string | undefined {
  if (!rule || typeof rule !== 'object' || !isGroup(rule)) return undefined;
  return hintIn(rule, []);
}
