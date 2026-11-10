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
