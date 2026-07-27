import { appendFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  createWorkflowLiveEvalPlan,
  meetsWorkflowLiveEvalThresholds,
  redactWorkflowLiveEvalValue,
  summarizeWorkflowLiveEval,
  type WorkflowLiveEvalAttempt,
  type WorkflowLiveEvalScenario,
} from '../../src/domains/workflows/builder/workflow-live-eval.ts';

type PromptSuite = { version: number; scenarios: WorkflowLiveEvalScenario[] };

type Metadata = {
  version: 1;
  runId: string;
  startedAt: string;
  provider: string;
  model: string;
  temperature?: string;
  topP?: string;
  seed?: string;
  seedSupported: boolean;
  maxTokens?: string;
  retryPolicy?: string;
  timeoutMs?: string;
  evaluatorCommit: string;
  appCommit: string;
  fixtureOracleVersion: number;
};

const args = new Set(process.argv.slice(2));
const help = args.has('--help');
const dryRun = args.has('--dry-run');
const thresholdArg = process.argv.find(arg => arg.startsWith('--threshold='));
const threshold = Number(thresholdArg?.slice('--threshold='.length) ?? '0.95');
const command = process.env.WORKFLOW_BUILDER_LIVE_EVAL_COMMAND;

const usage = `Usage: pnpm workflow-builder:live-eval -- [--dry-run] [--threshold=0.95]

Environment for live runs:
  WORKFLOW_LIVE_EVAL_PROVIDER          Provider name recorded in artifacts
  WORKFLOW_LIVE_EVAL_MODEL             Literal model ID recorded in artifacts
  WORKFLOW_BUILDER_LIVE_EVAL_COMMAND   One-attempt adapter command; it receives scenario/run metadata through environment variables and must print one JSON WorkflowLiveEvalAttempt record

Optional metadata:
  WORKFLOW_LIVE_EVAL_TEMPERATURE, WORKFLOW_LIVE_EVAL_TOP_P, WORKFLOW_LIVE_EVAL_SEED,
  WORKFLOW_LIVE_EVAL_SEED_SUPPORTED, WORKFLOW_LIVE_EVAL_MAX_TOKENS,
  WORKFLOW_LIVE_EVAL_RETRY_POLICY, WORKFLOW_LIVE_EVAL_TIMEOUT_MS
`;

const gitCommit = () => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
};

const promptSuite = JSON.parse(
  readFileSync(new URL('../tests/workflow-builder/workflow-builder-prompt-suite.json', import.meta.url), 'utf8'),
) as PromptSuite;

if (help) {
  process.stdout.write(usage);
  process.exit(0);
}

if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
  throw new Error('--threshold must be greater than 0 and no more than 1.');
}

const runRoot =
  process.env.WORKFLOW_LIVE_EVAL_ARTIFACT_DIR ?? mkdtempSync(join(tmpdir(), 'mastra-workflow-live-eval-'));
mkdirSync(runRoot, { recursive: true });
const metadata: Metadata = {
  version: 1,
  runId: `workflow-live-eval-${Date.now()}`,
  startedAt: new Date().toISOString(),
  provider: process.env.WORKFLOW_LIVE_EVAL_PROVIDER ?? 'unconfigured',
  model: process.env.WORKFLOW_LIVE_EVAL_MODEL ?? 'unconfigured',
  temperature: process.env.WORKFLOW_LIVE_EVAL_TEMPERATURE,
  topP: process.env.WORKFLOW_LIVE_EVAL_TOP_P,
  seed: process.env.WORKFLOW_LIVE_EVAL_SEED,
  seedSupported: process.env.WORKFLOW_LIVE_EVAL_SEED_SUPPORTED === 'true',
  maxTokens: process.env.WORKFLOW_LIVE_EVAL_MAX_TOKENS,
  retryPolicy: process.env.WORKFLOW_LIVE_EVAL_RETRY_POLICY,
  timeoutMs: process.env.WORKFLOW_LIVE_EVAL_TIMEOUT_MS,
  evaluatorCommit: gitCommit(),
  appCommit: gitCommit(),
  fixtureOracleVersion: promptSuite.version,
};
const plan = createWorkflowLiveEvalPlan(promptSuite.scenarios);

writeFileSync(join(runRoot, 'metadata.json'), `${JSON.stringify(redactWorkflowLiveEvalValue(metadata), null, 2)}\n`);

if (dryRun) {
  process.stdout.write(
    `${JSON.stringify({ runRoot, metadata: redactWorkflowLiveEvalValue(metadata), attempts: plan.length, dryRun: true }, null, 2)}\n`,
  );
  process.exit(0);
}

if (!command || metadata.provider === 'unconfigured' || metadata.model === 'unconfigured') {
  throw new Error(
    'Live evaluation requires WORKFLOW_LIVE_EVAL_PROVIDER, WORKFLOW_LIVE_EVAL_MODEL, and WORKFLOW_BUILDER_LIVE_EVAL_COMMAND.',
  );
}

const attempts: WorkflowLiveEvalAttempt[] = [];
const resultsPath = join(runRoot, 'results.jsonl');
for (const { scenario, attempt } of plan) {
  const storagePath = join(runRoot, `${scenario.id}-${attempt}.db`);
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    env: {
      ...process.env,
      WORKFLOW_LIVE_EVAL_RUN_ID: metadata.runId,
      WORKFLOW_LIVE_EVAL_SCENARIO: JSON.stringify(scenario),
      WORKFLOW_LIVE_EVAL_ATTEMPT: String(attempt),
      WORKFLOW_EVAL_STORAGE_URL: `file:${storagePath}`,
    },
  });

  let record: WorkflowLiveEvalAttempt;
  try {
    record = JSON.parse(result.stdout.trim()) as WorkflowLiveEvalAttempt;
  } catch {
    record = {
      scenarioId: scenario.id,
      attempt,
      lifecycle: result.status === null ? 'timeout' : 'infrastructure',
      acceptedRevisionPreserved: false,
      persistedDefinitionValid: false,
    };
  }

  attempts.push(record);
  appendFileSync(resultsPath, `${JSON.stringify(redactWorkflowLiveEvalValue(record))}\n`);
}

const summary = summarizeWorkflowLiveEval(attempts);
writeFileSync(join(runRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ runRoot, summary }, null, 2)}\n`);
process.exit(
  meetsWorkflowLiveEvalThresholds(
    summary,
    threshold,
    promptSuite.scenarios.map(scenario => scenario.id),
  )
    ? 0
    : 1,
);
