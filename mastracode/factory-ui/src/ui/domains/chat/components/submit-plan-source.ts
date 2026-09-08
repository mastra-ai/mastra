/**
 * Plan-source resolution for the `submit_plan` card.
 *
 * The tool call only ever carries the plan file `path` — the plan body lives in
 * a Markdown file inside the session workspace. A card can therefore source its
 * content from three places, in precedence order:
 *
 * 1. The persisted `result.submittedPlan` of a resolved call (offline replay).
 * 2. An enriched payload (`title`/`plan` present on the args/suspend payload).
 * 3. The plan file fetched from the session workspace, parsed like the TUI's
 *    `readPlanFile`.
 */

export interface InlinePlanSource {
  title?: string;
  path?: string;
  plan?: string;
  feedback?: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** The persisted `submittedPlan` from a resolved tool result, when the resume was enriched. */
function persistedPlan(output: unknown): InlinePlanSource | undefined {
  const submitted = record(record(output)?.submittedPlan);
  if (!submitted) return undefined;
  const source: InlinePlanSource = {
    title: stringValue(submitted.title),
    path: stringValue(submitted.path),
    plan: stringValue(submitted.plan),
    feedback: stringValue(submitted.feedback),
  };
  return source.title || source.path || source.plan || source.feedback ? source : undefined;
}

/** Suspend payload / tool args: flat `{ path, title?, plan? }`, or the legacy nested `{ plan: { title, content } }`. */
function payloadPlan(input: unknown): InlinePlanSource {
  const payload = record(input);
  const nested = record(payload?.plan);
  return {
    title: stringValue(payload?.title) ?? stringValue(nested?.title),
    path: stringValue(payload?.path) ?? stringValue(nested?.path),
    plan: stringValue(payload?.plan) ?? stringValue(nested?.content) ?? stringValue(nested?.summary),
  };
}

/**
 * Resolve the inline plan content carried by the tool call itself.
 * Persisted results take precedence over live payload data; a missing `plan`
 * means the card must fetch the plan file from the workspace.
 */
export function resolveInlinePlan(input: unknown, output: unknown): InlinePlanSource {
  const persisted = persistedPlan(output);
  const payload = payloadPlan(input);
  return {
    title: persisted?.title ?? payload.title,
    path: persisted?.path ?? payload.path,
    plan: persisted?.plan ?? payload.plan,
    ...(persisted?.feedback ? { feedback: persisted.feedback } : {}),
  };
}

/** Split a plan file into title and body — the leading `# Title` heading is the title (mirrors the TUI's `readPlanFile`). */
export function parsePlanMarkdown(raw: string): { title?: string; plan: string } {
  const lines = raw.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim().length > 0);
  const heading = headingIndex >= 0 ? lines[headingIndex] : undefined;
  if (heading?.startsWith('# ')) {
    return {
      title: heading.slice(2).trim(),
      plan: lines
        .slice(headingIndex + 1)
        .join('\n')
        .replace(/^\n+/, '')
        .trimEnd(),
    };
  }
  return { plan: raw.trimEnd() };
}
