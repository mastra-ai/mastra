import { randomBytes } from 'node:crypto';

import { tools as createToolsResolver } from '../../src/tools.js';
import { TOOLS as REGISTERED_PROVIDERS } from '../../src/registry.js';
import type { Scenario, ScenarioStep, ResolvedToolset } from './scenario.js';
import { toolsForProvider } from './scenario.js';
import { scenarios as REGISTERED_SCENARIOS } from './scenarios/index.js';

export interface RunnerOptions {
  /** Only run scenarios for these integration ids. Omit to run every registered scenario. */
  providers?: string[];
  /** Project id to resolve. Defaults to MASTRA_PROJECT_ID. */
  projectId?: string;
  /** Platform access token. Defaults to MASTRA_PLATFORM_SECRET_KEY (or MASTRA_PLATFORM_ACCESS_TOKEN). */
  accessToken?: string;
}

export interface ProviderOutcome {
  integrationId: string;
  summary: string;
  /** 'skipped' when no scenario, no tools, or scenario self-skipped every step. */
  status: 'pass' | 'fail' | 'skipped' | 'error';
  reason?: string;
  steps: ScenarioStep[];
  elapsedMs: number;
}

export interface RunResult {
  runId: string;
  outcomes: ProviderOutcome[];
  startedAt: string;
  endedAt: string;
}

/**
 * Short, time-ordered run id used to tag every record a scenario creates.
 * `mastra-smoke-k7fx3` is short enough for provider title limits but still
 * unique enough that two concurrent runs don't collide.
 */
function generateRunId(): string {
  return `mastra-smoke-${randomBytes(3).toString('hex')}`;
}

export async function runSmokeTests(options: RunnerOptions = {}): Promise<RunResult> {
  const runId = generateRunId();
  const startedAt = new Date().toISOString();

  const projectId = options.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error('Missing project id: set MASTRA_PROJECT_ID or pass --project-id.');
  }

  // Resolve the project toolset once via the public resolver so the suite goes
  // through the same discovery/filtering path a real agent would.
  const resolver = createToolsResolver({
    projectId,
    client: {
      accessToken: options.accessToken,
    },
  });
  const toolset = (await resolver()) as unknown as ResolvedToolset;

  if (process.env.MASTRA_SMOKE_DEBUG === '1') {
    const keys = Object.keys(toolset).sort();
    console.log(`[smoke-test] resolver returned ${keys.length} tools:`);
    for (const key of keys) console.log(`  - ${key}`);
    console.log('');
  }

  const requested = options.providers?.length ? new Set(options.providers) : null;
  const scenarioByProvider = new Map(REGISTERED_SCENARIOS.map(s => [s.integrationId, s] as const));
  const providerIds = (
    requested
      ? [...requested]
      : // Default run order: every provider the registry knows about, plus any
        // scenario registered for a provider not in the registry (e.g. an MCP-only
        // provider). Keeps the report alphabetical and deterministic.
        [
          ...new Set([
            ...REGISTERED_PROVIDERS.map(p => p.integrationId),
            ...REGISTERED_SCENARIOS.map(s => s.integrationId),
          ]),
        ].sort()
  ).sort();

  const outcomes: ProviderOutcome[] = [];

  for (const integrationId of providerIds) {
    const scenario = scenarioByProvider.get(integrationId);
    if (!scenario) {
      outcomes.push({
        integrationId,
        summary: 'no scenario registered',
        status: 'skipped',
        reason: `No smoke scenario defined for ${integrationId}. Add one under scripts/smoke-test/scenarios/.`,
        steps: [],
        elapsedMs: 0,
      });
      continue;
    }

    const providerTools = toolsForProvider(toolset, integrationId);
    if (Object.keys(providerTools).length === 0) {
      outcomes.push({
        integrationId,
        summary: scenario.summary,
        status: 'skipped',
        reason: 'Provider has no tools in the resolved project toolset (connection not attached, or filtered out).',
        steps: [],
        elapsedMs: 0,
      });
      continue;
    }

    outcomes.push(await executeScenario(scenario, providerTools, toolset, runId));
  }

  return {
    runId,
    outcomes,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

async function executeScenario(
  scenario: Scenario,
  tools: ResolvedToolset,
  allTools: ResolvedToolset,
  runId: string,
): Promise<ProviderOutcome> {
  const started = Date.now();
  const log = createLogger(scenario.integrationId);

  const call = async <T = unknown>(toolId: string, input: unknown): Promise<T> => {
    const tool = tools[toolId];
    if (!tool || typeof tool.execute !== 'function') {
      throw new Error(`Tool ${toolId} not available for ${scenario.integrationId}`);
    }
    // The runner invokes tools exactly as @mastra/core does for an agent run,
    // minus the per-call auth/approval context. Scenarios should pass plain
    // input values; the tool's internal `execute` validates against its own
    // Zod schema. `Tool.execute` accepts `(inputData, context?)` so an empty
    // context is fine for a smoke run.
    try {
      const result = await (tool.execute as (input: unknown, context?: unknown) => Promise<unknown>)(input);
      return result as T;
    } catch (error) {
      // Re-throw with provider detail and HTTP status appended so scenario
      // steps don't just say "Provider request failed (400)." when the real
      // error body carries the diagnostic (GraphQL errors, validation details).
      throw enrichToolError(toolId, error);
    }
  };

  try {
    const steps = await scenario.run({
      integrationId: scenario.integrationId,
      tools,
      allTools,
      runId,
      call,
      log,
    });
    const status: ProviderOutcome['status'] = steps.some(s => s.status === 'fail')
      ? 'fail'
      : steps.every(s => s.status === 'skip')
        ? 'skipped'
        : 'pass';
    return {
      integrationId: scenario.integrationId,
      summary: scenario.summary,
      status,
      steps,
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      integrationId: scenario.integrationId,
      summary: scenario.summary,
      status: 'error',
      reason: message,
      steps: [],
      elapsedMs: Date.now() - started,
    };
  }
}

function createLogger(integrationId: string) {
  const prefix = `[smoke-test:${integrationId}]`;
  return {
    info(message: string, data?: unknown) {
      console.log(`${prefix} ${message}${data === undefined ? '' : ` ${format(data)}`}`);
    },
    warn(message: string, data?: unknown) {
      console.warn(`${prefix} ${message}${data === undefined ? '' : ` ${format(data)}`}`);
    },
    error(message: string, data?: unknown) {
      console.error(`${prefix} ${message}${data === undefined ? '' : ` ${format(data)}`}`);
    },
  };
}

function format(data: unknown): string {
  try {
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    return String(data);
  }
}

interface MaybeConnectError {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  detail?: unknown;
}

/**
 * Normalizes thrown values into a single Error whose message carries the
 * platform/provider detail, HTTP status, and error code the client stashed on
 * `MastraConnectError`. Without this, scenarios surface opaque strings like
 * "Provider request failed (400)." and operators can't tell what the upstream
 * actually rejected.
 */
function enrichToolError(toolId: string, error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(`${toolId}: ${String(error)}`);
  }
  const extras: string[] = [];
  const data = error as MaybeConnectError;
  if (typeof data.status === 'number') extras.push(`status=${data.status}`);
  if (typeof data.code === 'string' && data.code) extras.push(`code=${data.code}`);
  if (typeof data.detail === 'string' && data.detail) extras.push(`detail=${data.detail}`);
  if (extras.length === 0) return error;
  const enriched = new Error(`${error.message} [${extras.join(', ')}]`);
  enriched.stack = error.stack;
  return enriched;
}
