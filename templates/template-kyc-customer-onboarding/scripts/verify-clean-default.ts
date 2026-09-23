import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { loadConfig } from '../src/config/load-config.js';
import { kycOnboardingAgentPromptV1 } from '../src/config/prompts/kyc-onboarding-agent-v1.js';
import { createDependencies, type FoundationDependencies } from '../src/create-dependencies.js';
import { drainMastraObservability } from '../src/lifecycle/graceful-shutdown.js';

const maximumFirstRunMs = 5 * 60 * 1000;
const directory = await mkdtemp(join(tmpdir(), 'mastra-kyc-clean-default-'));
let dependencies: FoundationDependencies | undefined;
const startedAt = performance.now();

try {
  const config = loadConfig({
    APP_ENV: 'demo-default',
    DOCUMENT_EXTRACTION_PROVIDER: 'fixture',
    DOCUMENT_EXTRACTION_MODEL: 'fixture',
    KYC_AGENT_MODEL: 'fixture',
    SANCTIONS_SCREENING_PROVIDER: 'fixture-sanctions',
    PEP_SCREENING_PROVIDER: 'fixture-pep',
    RISK_ASSESSMENT_PROVIDER: 'rule-based',
    RISK_ASSESSMENT_MODEL: 'fixture',
    LIBSQL_DOMAIN_URL: `file:${join(directory, 'kyc.db')}`,
    LIBSQL_MASTRA_URL: `file:${join(directory, 'mastra.db')}`,
    DUCKDB_URL: join(directory, 'analytics.duckdb'),
    DOCUMENT_STORAGE_PATH: join(directory, 'documents'),
  });
  dependencies = await createDependencies(config);
  const response = await dependencies.agents.kycOnboarding.generate(kycOnboardingAgentPromptV1.goldenPrompt, {
    memory: { resource: config.tenant.defaultTenantId, thread: 'clean-default-thread-v1' },
    maxSteps: 3,
    tracingOptions: { hideInput: true, hideOutput: true },
  });
  const caseRows = await dependencies.storage.operational.execute('SELECT status FROM kyc_cases');
  const caseRow = caseRows.rows[0];
  if (caseRow === undefined || typeof caseRow.status !== 'string') {
    throw new Error('The first-run case status was not persisted');
  }
  const linkRows = await dependencies.storage.operational.execute(
    'SELECT case_id,workflow_run_id FROM studio_case_links',
  );
  const workflowRunId = linkRows.rows[0]?.workflow_run_id;
  const caseId = linkRows.rows[0]?.case_id;
  if (typeof workflowRunId !== 'string' || typeof caseId !== 'string') {
    throw new Error('The first-run Studio thread was not linked to a workflow run');
  }
  const storedRun = await dependencies.workflows.durableKycOnboarding.getWorkflowRunById(workflowRunId, {
    fields: ['steps', 'suspendedPaths', 'resumeLabels'],
  });
  if (storedRun?.status !== 'suspended') {
    throw new Error('The first-run workflow suspension was not persisted successfully');
  }
  const risk = await dependencies.repositories.riskAssessments.getLatest({
    tenantId: 'demo',
    caseId,
  });
  const reviewRows = await dependencies.storage.operational.execute('SELECT COUNT(*) AS count FROM compliance_reviews');
  const evidenceRows = await dependencies.storage.operational.execute('SELECT COUNT(*) AS count FROM evidence_items');
  const durationMs = Math.ceil(performance.now() - startedAt);
  if (durationMs > maximumFirstRunMs) {
    throw new Error('The credential-free first run exceeded five minutes');
  }
  const summary = {
    checkId: 'clean-default-first-run-v1',
    durationMs,
    credentialsRequired: false,
    agentExercised: true,
    studioUiExercised: false,
    status: caseRow.status,
    riskLevel: risk.level,
    riskRoute: risk.route,
    pendingReviewCount: reviewRows.rows[0]?.count,
    evidenceCount: evidenceRows.rows[0]?.count,
    passed:
      response.text.includes('bounded synthetic workflow advanced') &&
      caseRows.rows.length === 1 &&
      linkRows.rows.length === 1 &&
      caseRow.status === 'COMPLIANCE_REVIEW' &&
      risk.level === 'LOW' &&
      risk.route === 'AUTO_REVIEW' &&
      reviewRows.rows[0]?.count === 1 &&
      evidenceRows.rows[0]?.count === 5,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.passed) throw new Error('The credential-free first-run contract failed');
} finally {
  try {
    if (dependencies !== undefined) await drainMastraObservability(dependencies.mastra.observability);
  } finally {
    dependencies?.storage.close();
    await rm(directory, { recursive: true, force: true });
  }
}
