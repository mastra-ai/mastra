import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDependencies } from '../src/create-dependencies.js';
import {
  kycEvalManifestDigest,
  kycEvalScorePassed,
  kycEvalSourceDigest,
  kycEvalSourceRevision,
  runDeterministicKycEval,
  runMastraKycExperiments,
} from '../src/evals/kyc-quality.js';
import { loadConfig } from '../src/config/load-config.js';

const directory = await mkdtemp(join(tmpdir(), 'mastra-kyc-experiments-'));
const config = loadConfig({
  APP_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '4111',
  PORTAL_ORIGIN: 'http://127.0.0.1:5173',
  DEMO_DATA_ROOT: directory,
  LIBSQL_DOMAIN_URL: `file:${join(directory, 'kyc.db')}`,
  LIBSQL_MASTRA_URL: `file:${join(directory, 'mastra.db')}`,
  DUCKDB_URL: join(directory, 'analytics.duckdb'),
  DOCUMENT_STORAGE_PATH: join(directory, 'documents'),
  KYC_DEFAULT_TENANT_ID: 'eval',
  KYC_DEFAULT_JURISDICTION: 'US',
  KYC_DEFAULT_POLICY_PROFILE: 'demo-default',
  KYC_PII_MODE: 'demo-default',
  KYC_LOCALE: 'en-US',
  KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST: '',
  DOCUMENT_EXTRACTION_PROVIDER: 'fixture',
  DOCUMENT_EXTRACTION_MODEL: 'fixture',
  IDENTITY_VERIFICATION_PROVIDER: 'local-identity',
  ADDRESS_VERIFICATION_PROVIDER: 'local-address',
  SANCTIONS_SCREENING_PROVIDER: 'fixture-sanctions',
  PEP_SCREENING_PROVIDER: 'fixture-pep',
  DOCUMENT_STORAGE_PROVIDER: 'local-filesystem',
  NOTIFICATION_PROVIDER: 'local-inbox',
  WEBHOOK_PUBLISHER: 'capture',
  PROVISIONING_PROVIDER: 'simulated',
  RISK_POLICY_PROVIDER: 'demo-default@1.1.0',
  RISK_ASSESSMENT_PROVIDER: 'rule-based',
  RISK_ASSESSMENT_MODEL: 'fixture',
  PROVIDER_TIMEOUT_MS: '10000',
  PROVIDER_MAX_ATTEMPTS: '3',
  PROVIDER_RETRY_BASE_DELAY_MS: '100',
});

const dependencies = await createDependencies(config);
try {
  const summaries = await runMastraKycExperiments(dependencies.mastra);
  const baseline = await runDeterministicKycEval();
  const occurredAt = dependencies.clock.now().toISOString();
  for (const [evalId, score] of Object.entries(baseline.scores)) {
    await dependencies.services.metrics.recordEval({
      tenantId: config.tenant.defaultTenantId,
      eventId: `eval:${evalId}:${kycEvalSourceRevision.slice(0, 12)}:${kycEvalManifestDigest.slice(0, 12)}`,
      evalId,
      candidateId: `baseline@${kycEvalSourceRevision.slice(0, 12)}`,
      datasetVersion: baseline.schemaVersion,
      manifestDigest: kycEvalManifestDigest,
      sourceRevision: kycEvalSourceRevision,
      sourceDigest: kycEvalSourceDigest,
      score,
      passed: kycEvalScorePassed(evalId as keyof typeof baseline.scores, score),
      occurredAt,
    });
  }
  const projectedEvalFacts = await dependencies.services.metrics.projectPending(config.tenant.defaultTenantId);
  const result = {
    schemaVersion: '4.0.0',
    experiments: summaries.length,
    completed: summaries.filter(({ status }) => status === 'completed').length,
    failedItems: summaries.reduce((sum, { failedCount }) => sum + failedCount, 0),
    projectedEvalFacts,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.completed !== 7 || result.failedItems !== 0) process.exitCode = 1;
} finally {
  dependencies.storage.close();
  await rm(directory, { recursive: true, force: true });
}
