import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { MultimodalDocumentExtractionProvider } from '../src/contracts/providers/document-extraction.js';
import {
  ProviderRateLimitedError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from '../src/contracts/shared/provider.js';
import { demoDefaultPolicy } from '../src/config/policies/demo-default.js';
import { demoStrictPolicy } from '../src/config/policies/demo-strict.js';
import { createDependencies, type FoundationDependencies } from '../src/create-dependencies.js';
import { fixtureApplication } from '../src/fixtures/provider-scenarios.js';
import { kycOnboardingAgentPromptV1 } from '../src/config/prompts/kyc-onboarding-agent-v1.js';
import {
  createKycApplicationWorkflow,
  type KycWorkflowRequestContext,
} from '../src/mastra/workflows/kyc-application-intake.js';
import { createServer } from '../src/server/create-server.js';
import { DocumentExtractionService } from '../src/services/document-extraction.js';
import { createKycObservability } from '../src/observability/create-observability.js';
import { createTraceCorrelationReference } from '../src/observability/tracing.js';
import { createTestConfig } from './helpers/test-config.js';

type Profile = 'demo-default' | 'demo-strict';
type FailureMode = 'invalid-output' | 'timeout' | 'rate-limit' | 'unavailable';

const fixtureCanaries = [
  'Morgan Example',
  'SYNTHETIC-001',
  'morgan@example.invalid',
  '+1-202-555-0100',
  '100 Example Avenue',
  '1990-01-01',
  '2030-01-01',
] as const;
const providerOutputCanary = 'PII-CANARY-PROVIDER-OUTPUT-7D0C9A';
const apiInputCanary = 'PII-CANARY-API-INPUT-89B1E4';
const profiles = ['demo-default', 'demo-strict'] as const;
const scenarios = ['low-risk', 'missing-fields', 'unreadable'] as const;
const failureModes = ['invalid-output', 'timeout', 'rate-limit', 'unavailable'] as const;
const operationalPiiAllowlist = new Set([
  'applications',
  'document_extractions',
  'idempotency_keys',
  'information_responses',
]);
const idempotencyPiiOperations = new Set([
  'PUT_APPLICATION',
  'PUT_DOCUMENT_EXTRACTION',
  'RESPOND_TO_INFORMATION_REQUEST',
]);

const directories: string[] = [];
const activeDependencies: FoundationDependencies[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dependencies of activeDependencies.splice(0)) dependencies.storage.close();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

const createFixtureDependencies = async (profile: Profile) => {
  const directory = await mkdtemp(join(tmpdir(), `mastra-kyc-pii-${profile}-`));
  directories.push(directory);
  const dependencies = await createDependencies(createTestConfig(directory, profile));
  activeDependencies.push(dependencies);
  return dependencies;
};

const contextFor = (profile: Profile) => {
  const policy = profile === 'demo-strict' ? demoStrictPolicy : demoDefaultPolicy;
  return new RequestContext<KycWorkflowRequestContext>([
    ['tenantId', 'demo'],
    ['jurisdiction', 'US'],
    ['piiMode', profile],
    ['policy', { id: policy.id, version: policy.version, checksum: policy.checksum }],
    ['locale', 'en-US'],
    ['correlationId', `pii-matrix-${profile}`],
    ['actor', { type: 'system', id: 'pii-matrix', roles: [] }],
    ['policyProfile', profile],
  ]);
};

const assertNoCanaries = (surface: string, value: unknown, extra: readonly string[] = []) => {
  const serialized =
    typeof value === 'string'
      ? value
      : JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? item.toString() : item));
  for (const canary of [...fixtureCanaries, ...extra]) {
    expect(serialized, `${surface} leaked ${canary}`).not.toContain(canary);
  }
};

const captureProcessOutput = () => {
  const captured: string[] = [];
  for (const method of ['debug', 'error', 'info', 'log', 'warn'] as const) {
    vi.spyOn(console, method).mockImplementation((...values: unknown[]) => {
      captured.push(values.map(String).join(' '));
    });
  }
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    captured.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    captured.push(String(chunk));
    return true;
  });
  return captured;
};

const assertPersistedSurfacesAreSafe = async (
  dependencies: FoundationDependencies,
  runId: string,
  extraCanaries: readonly string[] = [],
  workflowName = 'kyc-application-intake-v1',
) => {
  const tables = await dependencies.storage.operational.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  for (const row of tables.rows) {
    const table = z.string().parse(row.name);
    if (operationalPiiAllowlist.has(table)) continue;
    const contents = await dependencies.storage.operational.execute(`SELECT * FROM "${table}"`);
    assertNoCanaries(`operational table ${table}`, contents.rows, extraCanaries);
  }
  const nonPiiIdempotencyRows = await dependencies.storage.operational.execute(
    `SELECT * FROM idempotency_keys
     WHERE operation NOT IN ('PUT_APPLICATION', 'PUT_DOCUMENT_EXTRACTION', 'RESPOND_TO_INFORMATION_REQUEST')`,
  );
  assertNoCanaries('non-PII idempotency records', nonPiiIdempotencyRows.rows, extraCanaries);
  const idempotencyOperations = await dependencies.storage.operational.execute(
    'SELECT DISTINCT operation FROM idempotency_keys ORDER BY operation',
  );
  for (const row of idempotencyOperations.rows) {
    const operation = z.string().parse(row.operation);
    if (!idempotencyPiiOperations.has(operation)) continue;
    expect(['PUT_APPLICATION', 'PUT_DOCUMENT_EXTRACTION', 'RESPOND_TO_INFORMATION_REQUEST']).toContain(operation);
  }

  const workflowStore = await dependencies.storage.mastra.getStore('workflows');
  expect(workflowStore).toBeDefined();
  const snapshot = await workflowStore?.loadWorkflowSnapshot({
    workflowName,
    runId,
  });
  expect(snapshot).not.toBeNull();
  assertNoCanaries('Mastra workflow snapshot', snapshot, extraCanaries);

  const observabilityStore = await dependencies.storage.mastra.getStore('observability');
  expect(observabilityStore).toBeDefined();
  await dependencies.mastra.observability.flush();
  const traces = await observabilityStore?.listTraces({});
  assertNoCanaries('Mastra traces', traces, extraCanaries);

  await dependencies.services.metrics.projectPending('demo');
  const analytics = await dependencies.storage.analytics.connect();
  const analyticsTables = await analytics.runAndReadAll(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='main' ORDER BY table_name",
  );
  for (const rawTable of analyticsTables.getRowsJS().flat()) {
    const table = z.string().parse(rawTable);
    const rows = await analytics.runAndReadAll(`SELECT * FROM "${table}"`);
    assertNoCanaries(`DuckDB table ${table}`, rows.getRowsJS(), extraCanaries);
  }
  analytics.closeSync();

  const datasets = await dependencies.mastra.datasets.list({ page: 0, perPage: 100 });
  assertNoCanaries('Mastra dataset summaries', datasets, extraCanaries);
};

const failureProvider = (
  dependencies: FoundationDependencies,
  mode: FailureMode,
): MultimodalDocumentExtractionProvider => ({
  id: dependencies.providers.documentExtraction.id,
  capabilities: dependencies.providers.documentExtraction.capabilities,
  extract: () => {
    const identity = {
      providerId: 'fixture',
      operation: 'DOCUMENT_EXTRACTION' as const,
      safeMessage: 'The synthetic provider failure was classified safely',
    };
    if (mode === 'timeout') return Promise.reject(new ProviderTimeoutError(identity));
    if (mode === 'rate-limit') return Promise.reject(new ProviderRateLimitedError(identity));
    if (mode === 'unavailable') return Promise.reject(new ProviderUnavailableError(identity));
    return Promise.resolve({ unexpected: providerOutputCanary } as never);
  },
});

const createFailureWorkflow = (
  dependencies: FoundationDependencies,
  provider: MultimodalDocumentExtractionProvider,
) => {
  const documentExtraction = new DocumentExtractionService(
    provider,
    dependencies.policies.pii,
    dependencies.repositories.documentExtractions,
    dependencies.repositories.evidence,
    dependencies.repositories.idempotency,
    dependencies.costRecorder,
    dependencies.clock,
    [],
    dependencies.services.metrics,
  );
  return createKycApplicationWorkflow({
    cases: dependencies.repositories.cases,
    applicationIntake: dependencies.services.applicationIntake,
    documentIntake: dependencies.services.documentIntake,
    documentExtraction,
    extractionRouting: dependencies.services.extractionRouting,
    completeness: dependencies.services.completeness,
    documents: dependencies.repositories.documents,
    documentExtractions: dependencies.repositories.documentExtractions,
    casePolicySnapshots: dependencies.repositories.casePolicySnapshots,
    studioCaseLinks: dependencies.repositories.studioCaseLinks,
    jurisdictionPolicy: dependencies.policies.jurisdiction,
    clock: dependencies.clock,
    modelId: 'fixture',
    schemaVersion: '1.0.0',
    timeoutMs: 10_000,
    identityVerification: dependencies.tools.identityVerification,
    addressVerification: dependencies.tools.addressVerification,
    sanctionsScreening: dependencies.tools.sanctionsScreening,
    pepScreening: dependencies.tools.pepScreening,
  });
};

describe('PII canary matrix', { concurrent: false }, () => {
  it('keeps application-correction values out of same-thread agent, snapshot, trace, and audit surfaces', async () => {
    for (const profile of profiles) {
      const captured = captureProcessOutput();
      const dependencies = await createFixtureDependencies(profile);
      const memory = { resource: 'demo', thread: `pii-correction-${profile}` };

      const started = await dependencies.agents.kycOnboarding.generate(
        'Start the bundled synthetic missing-information KYC scenario and complete every automatic step currently available.',
        {
          memory,
          maxSteps: 3,
          tracingOptions: { hideInput: true, hideOutput: true },
        },
      );
      const continued = await dependencies.agents.kycOnboarding.generate(
        'Provide the requested readable supporting document and continue this task.',
        {
          memory,
          maxSteps: 3,
          tracingOptions: { hideInput: true, hideOutput: true },
        },
      );

      assertNoCanaries('missing-information agent start text', started.text);
      assertNoCanaries('application-correction agent text', continued.text);
      assertNoCanaries(
        'application-correction redacted tool outcomes',
        continued.toolResults.map(result => result.payload.result),
      );
      const links = await dependencies.storage.operational.execute(
        'SELECT workflow_run_id FROM studio_case_links ORDER BY created_at DESC LIMIT 1',
      );
      await assertPersistedSurfacesAreSafe(
        dependencies,
        z.string().parse(links.rows[0]?.workflow_run_id),
        [],
        'durable-kyc-onboarding-v1',
      );
      assertNoCanaries('application-correction console, stdout, and stderr', captured);
      vi.restoreAllMocks();
      dependencies.storage.close();
      activeDependencies.splice(activeDependencies.indexOf(dependencies), 1);
    }
  });

  it('keeps PII canaries out of successful, missing, and unreadable surfaces in both profiles', async () => {
    for (const profile of profiles) {
      for (const scenario of scenarios) {
        const captured = captureProcessOutput();
        const dependencies = await createFixtureDependencies(profile);
        const runId = `pii-${profile}-${scenario}`;
        const run = await dependencies.workflows.kycApplication.createRun({ runId });
        const result = await run.start({
          inputData: { scenario, idempotencyKey: `pii-${profile}-${scenario}` },
          requestContext: contextFor(profile),
          tracingOptions: { hideInput: true, hideOutput: true },
        });

        assertNoCanaries('workflow response', result);
        await assertPersistedSurfacesAreSafe(dependencies, runId);

        if (scenario === 'low-risk') {
          const agentResponse = await dependencies.agents.kycOnboarding.generate(
            kycOnboardingAgentPromptV1.goldenPrompt,
            {
              memory: { resource: 'demo', thread: `pii-agent-${profile}` },
              maxSteps: 3,
              tracingOptions: { hideInput: true, hideOutput: true },
            },
          );
          assertNoCanaries('agent and tool response', agentResponse);
          const links = await dependencies.storage.operational.execute(
            'SELECT workflow_run_id FROM studio_case_links ORDER BY created_at DESC LIMIT 1',
          );
          const durableRunId = z.string().parse(links.rows[0]?.workflow_run_id);
          await assertPersistedSurfacesAreSafe(dependencies, durableRunId, [], 'durable-kyc-onboarding-v1');

          const server = await createServer(dependencies);
          const login = await server.request('/api/v1/demo/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
            body: JSON.stringify({ persona: 'applicant' }),
          });
          const loginBody = (await login.json()) as { csrfToken: string };
          const cookie = login.headers.get('Set-Cookie')?.split(';', 1)[0];
          if (cookie === undefined) throw new Error('PII test session cookie was not created');
          const apiCorrelation = `Morgan.Example-${profile}`;
          const apiHeaders = {
            Cookie: cookie,
            Origin: 'http://127.0.0.1:5173',
            'X-CSRF-Token': loginBody.csrfToken,
            'X-Correlation-Id': apiCorrelation,
          };
          const successfulApiResponse = await server.request('/api/v1/kyc/cases', {
            method: 'POST',
            headers: {
              ...apiHeaders,
              'Content-Type': 'application/json',
              'Idempotency-Key': `pii-api-success-${profile}`,
            },
            body: JSON.stringify({ application: fixtureApplication }),
          });
          expect(successfulApiResponse.status).toBe(201);
          expect(successfulApiResponse.headers.get('X-Correlation-Id')).toBe(apiCorrelation);
          assertNoCanaries('API success response', await successfulApiResponse.text());
          const apiResponse = await server.request('/api/v1/kyc/cases', {
            method: 'POST',
            headers: {
              ...apiHeaders,
              'Content-Type': 'application/json',
              'Idempotency-Key': 'pii-api-invalid',
            },
            body: JSON.stringify({ application: fixtureApplication, unexpected: apiInputCanary }),
          });
          expect(apiResponse.status).toBe(400);
          assertNoCanaries('API error response', await apiResponse.text(), [apiInputCanary]);
          await dependencies.mastra.observability.flush();
          const observabilityStore = await dependencies.storage.mastra.getStore('observability');
          const apiTraces = await observabilityStore?.listTraces({});
          expect(JSON.stringify(apiTraces)).toContain(createTraceCorrelationReference(apiCorrelation));
          assertNoCanaries('API trace correlation', apiTraces, [apiCorrelation]);
        }

        assertNoCanaries('console, stdout, and stderr', captured);
        vi.restoreAllMocks();
        dependencies.storage.close();
        activeDependencies.splice(activeDependencies.indexOf(dependencies), 1);
      }
    }
  });

  it('keeps PII canaries out of invalid-output and provider-failure surfaces in both profiles', async () => {
    for (const profile of profiles) {
      for (const mode of failureModes) {
        const captured = captureProcessOutput();
        const dependencies = await createFixtureDependencies(profile);
        const workflow = createFailureWorkflow(dependencies, failureProvider(dependencies, mode));
        const mastra = new Mastra({
          storage: dependencies.storage.mastra,
          observability: createKycObservability(),
          workflows: { workflow },
        });
        const registered = mastra.getWorkflow('workflow');
        const runId = `pii-${profile}-${mode}`;
        const run = await registered.createRun({ runId });
        const result = await run.start({
          inputData: { scenario: 'low-risk', idempotencyKey: runId },
          requestContext: contextFor(profile),
          tracingOptions: { hideInput: true, hideOutput: true },
        });
        await mastra.observability.flush();

        expect(result.status).toBe('failed');
        assertNoCanaries('failed workflow response', result, [providerOutputCanary]);
        await assertPersistedSurfacesAreSafe(dependencies, runId, [providerOutputCanary]);
        assertNoCanaries('failed console, stdout, and stderr', captured, [providerOutputCanary]);
        vi.restoreAllMocks();
        dependencies.storage.close();
        activeDependencies.splice(activeDependencies.indexOf(dependencies), 1);
      }
    }
  });
});
