import type { Tool } from '@mastra/core/tools';

/**
 * Runtime shape of a resolved tool returned from `tools()`. We don't bind to
 * the exact @mastra/core Tool type instance here so scenarios can keep working
 * when the public resolver type shifts.
 */
export type ResolvedTool = Tool<any, any, any>;

export type ResolvedToolset = Record<string, ResolvedTool>;

/**
 * What a scenario sees. The runner hands back only the tools the scenario's
 * provider owns (`<integrationId>_*`), already filtered down to the project's
 * available surface, so a scenario can detect missing tools and skip gracefully
 * rather than throw.
 */
export interface ScenarioContext {
  /** Platform integration id this scenario is for, e.g. 'linear'. */
  integrationId: string;
  /**
   * Tools in the project toolset that belong to this provider. Keys are the
   * flat tool ids (`linear_create_issue`, etc.) exactly as the agent sees them.
   */
  tools: ResolvedToolset;
  /**
   * The full project toolset. Useful when a scenario needs a tool owned by
   * another provider — for example, Google Sheets has no delete endpoint of
   * its own, so cleanup goes through `google_drive_delete_file` when that
   * provider is attached. Prefer `tools` for the common path.
   */
  allTools: ResolvedToolset;
  /**
   * Short random suffix the runner provides for the whole run. Append it to
   * every record a scenario creates so concurrent runs don't collide and
   * leaked artifacts are visibly tagged `mastra-smoke-<runId>-<...>`.
   */
  runId: string;
  /**
   * Invoke a tool by key and return the parsed output. Throws if the tool is
   * missing from `tools` — scenarios should guard with
   * `requireTools(['linear_create_issue', ...])` first.
   */
  call: <T = unknown>(toolId: string, input: unknown) => Promise<T>;
  /** Mastra-wide logger passed from the runner. */
  log: ScenarioLogger;
}

export interface ScenarioLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/**
 * Outcome of running a scenario. The runner aggregates these into the report.
 */
export interface ScenarioStep {
  /** Short label, e.g. 'create issue', 'read back', 'update title', 'delete'. */
  name: string;
  /** Tool id the step invoked, or `undefined` for pure assertions. */
  toolId?: string;
  status: 'pass' | 'fail' | 'skip';
  /** Human-readable reason when `status` is `fail` or `skip`. */
  detail?: string;
}

export interface Scenario {
  integrationId: string;
  /**
   * Human-readable label describing what the scenario exercises, e.g.
   * `create → read → update → delete issue`. Printed in the report.
   */
  summary: string;
  /**
   * Returns the ordered list of steps the scenario executed. Cleanup is each
   * scenario's responsibility — it must only use the available tools and must
   * not leak records on either success or failure.
   */
  run(context: ScenarioContext): Promise<ScenarioStep[]>;
}

/** Returns the subset of `tools` whose key starts with `<integrationId>_`. */
export function toolsForProvider(tools: ResolvedToolset, integrationId: string): ResolvedToolset {
  // The flat tool id is `<integrationId with punctuation replaced by _>_<action>`.
  // E.g. `google-sheet` → `google_sheet_...`. We normalize both sides so scoped
  // ids match regardless of hyphens vs underscores.
  const prefix = `${integrationId.replace(/[^a-z0-9]/gi, '_')}_`;
  const out: ResolvedToolset = {};
  for (const [key, value] of Object.entries(tools)) {
    if (key.startsWith(prefix)) out[key] = value;
  }
  return out;
}

/**
 * Verifies every required tool id is present in the scoped toolset. Returns
 * null when every tool is available, otherwise a human-readable message
 * naming the first missing tool. Scenarios use this to short-circuit into a
 * skip step rather than throwing.
 */
export function requireTools(tools: ResolvedToolset, required: readonly string[]): string | null {
  for (const id of required) {
    if (!tools[id]) return `missing tool ${id}`;
  }
  return null;
}

/** Compact builder for ScenarioStep so scenarios stay dense but readable. */
export function makeStep(
  name: string,
  toolId: string | undefined,
  status: ScenarioStep['status'],
  detail?: string,
): ScenarioStep {
  return toolId === undefined
    ? detail === undefined
      ? { name, status }
      : { name, status, detail }
    : detail === undefined
      ? { name, toolId, status }
      : { name, toolId, status, detail };
}

/** Pulls the user-facing message off a thrown value in a Node-safe way. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Smoke-test a batch of read-only tools against the live proxy. Each tool is
 * called with the given input and must simply return without throwing; a
 * failure becomes one `fail` step and does not short-circuit the batch.
 */
export async function runReadBatch(
  call: <T>(toolId: string, input: unknown) => Promise<T>,
  reads: ReadonlyArray<readonly [toolId: string, input: unknown]>,
  availableTools: ResolvedToolset,
): Promise<ScenarioStep[]> {
  const steps: ScenarioStep[] = [];
  for (const [toolId, input] of reads) {
    if (!availableTools[toolId]) {
      steps.push(makeStep(stripPrefix(toolId), toolId, 'skip', 'tool not in project toolset'));
      continue;
    }
    try {
      await call(toolId, input);
      steps.push(makeStep(stripPrefix(toolId), toolId, 'pass'));
    } catch (error) {
      steps.push(makeStep(stripPrefix(toolId), toolId, 'fail', errorMessage(error)));
    }
  }
  return steps;
}

function stripPrefix(toolId: string): string {
  // Human-readable step name: drop the provider prefix so the report doesn't
  // repeat it on every line.
  const underscore = toolId.indexOf('_');
  return underscore >= 0 ? toolId.slice(underscore + 1) : toolId;
}
