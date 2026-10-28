import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { loadConfig } from '../src/config/load-config.js';
import { kycOnboardingAgentPromptV1 } from '../src/config/prompts/kyc-onboarding-agent-v1.js';
import { createDependencies, type FoundationDependencies } from '../src/create-dependencies.js';
import { kycApplicationWorkflowOutputSchema } from '../src/mastra/workflows/kyc-application-intake.js';

const maximumApprovedBudgetUsd = 1;
const maximumEstimatedRunCostUsd = 0.1;
const maximumOutputTokens = 1_200;
const conservativeInputTokens = 20_000;
const estimatedWorstCaseRunUsd = (conservativeInputTokens * 0.2 + maximumOutputTokens * 1.2) / 1_000_000;

if (process.env.LIVE_SMOKE_RUN !== '1') {
  throw new Error('Set LIVE_SMOKE_RUN=1 to authorize the external synthetic smoke');
}
if (process.env.OPENAI_API_KEY === undefined || process.env.OPENAI_API_KEY.length === 0) {
  throw new Error('OPENAI_API_KEY is required for the external synthetic smoke');
}
const budgetUsd = Number(process.env.LIVE_SMOKE_BUDGET_USD);
if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > maximumApprovedBudgetUsd) {
  throw new Error('LIVE_SMOKE_BUDGET_USD must be positive and no greater than 1.00');
}
if (estimatedWorstCaseRunUsd > maximumEstimatedRunCostUsd || estimatedWorstCaseRunUsd > budgetUsd) {
  throw new Error('The estimated worst-case run cost exceeds the approved stop line');
}

const directory = await mkdtemp(join(tmpdir(), 'mastra-kyc-live-smoke-'));
let dependencies: FoundationDependencies | undefined;
const startedAt = performance.now();

try {
  const config = loadConfig({
    APP_ENV: 'demo-default',
    LIBSQL_DOMAIN_URL: `file:${join(directory, 'kyc.db')}`,
    LIBSQL_MASTRA_URL: `file:${join(directory, 'mastra.db')}`,
    DUCKDB_URL: join(directory, 'analytics.duckdb'),
    DOCUMENT_STORAGE_PATH: join(directory, 'documents'),
    KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST: 'openai-multimodal',
    DOCUMENT_EXTRACTION_PROVIDER: 'openai-multimodal',
    DOCUMENT_EXTRACTION_MODEL: 'openai-gpt-5.6-luna',
    KYC_AGENT_MODEL: 'fixture',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    PROVIDER_TIMEOUT_MS: '60000',
    PROVIDER_MAX_ATTEMPTS: '1',
  });
  dependencies = await createDependencies(config);
  await dependencies.agents.kycOnboarding.generate(kycOnboardingAgentPromptV1.goldenPrompt, {
    memory: { resource: config.tenant.defaultTenantId, thread: 'live-smoke-thread-v1' },
    maxSteps: 3,
    tracingOptions: { hideInput: true, hideOutput: true },
  });

  const linkRows = await dependencies.storage.operational.execute('SELECT workflow_run_id FROM studio_case_links');
  const workflowRunId = linkRows.rows[0]?.workflow_run_id;
  if (typeof workflowRunId !== 'string') throw new Error('The smoke workflow run was not linked');
  const storedRun = await dependencies.workflows.kycApplication.getWorkflowRunById(workflowRunId, {
    fields: ['result'],
  });
  if (storedRun?.status !== 'success') throw new Error('The smoke workflow did not succeed');
  const result = kycApplicationWorkflowOutputSchema.parse(storedRun.result);
  const costRows = await dependencies.storage.operational.execute('SELECT payload_json FROM provider_cost_records');
  const costPayload = costRows.rows[0]?.payload_json;
  if (typeof costPayload !== 'string') throw new Error('The smoke usage record is missing');
  const usage = JSON.parse(costPayload) as Record<string, unknown>;
  const estimatedCostUsd = Number(usage.estimatedCostUsd);
  if (!Number.isFinite(estimatedCostUsd)) throw new Error('The smoke usage cost is invalid');

  const summary = {
    checkId: 'openai-multimodal-live-smoke-v1',
    providerId: 'openai-multimodal',
    modelId: 'openai/gpt-5.6-luna',
    syntheticDocumentOnly: true,
    structuredOutputValidated: true,
    status: result.status,
    route: result.route,
    inputUnits: Number(usage.inputUnits),
    outputUnits: Number(usage.outputUnits),
    estimatedCostUsd,
    latencyMs: Number(usage.latencyMs),
    elapsedMs: Math.ceil(performance.now() - startedAt),
    approvedBudgetUsd: budgetUsd,
    perRunStopUsd: maximumEstimatedRunCostUsd,
    passed:
      result.status === 'CHECKING' &&
      result.route === 'READY_FOR_CHECKS' &&
      estimatedCostUsd <= budgetUsd &&
      estimatedCostUsd <= maximumEstimatedRunCostUsd,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.passed) throw new Error('The redacted external synthetic smoke did not pass');
} finally {
  dependencies?.storage.close();
  await rm(directory, { recursive: true, force: true });
}
