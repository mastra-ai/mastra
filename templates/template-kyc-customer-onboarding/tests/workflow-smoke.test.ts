import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { RequestContext } from '@mastra/core/request-context';
import { noopObserve } from '@mastra/core/tools';
import { afterEach, describe, expect, it } from 'vitest';

import { createDependencies, type FoundationDependencies } from '../src/create-dependencies.js';
import { ProviderUnavailableError } from '../src/contracts/shared/provider.js';
import { StudioContextError, WorkflowExecutionError } from '../src/domain/errors.js';
import { startKycApplicationToolOutputSchema } from '../src/mastra/tools/start-kyc-application.js';
import { createTestConfig } from './helpers/test-config.js';

const directories: string[] = [];
const activeDependencies: FoundationDependencies[] = [];

afterEach(async () => {
  for (const dependencies of activeDependencies.splice(0)) dependencies.storage.close();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

const createFixtureDependencies = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-kyc-tool-'));
  directories.push(directory);
  const dependencies = await createDependencies(createTestConfig(directory));
  activeDependencies.push(dependencies);
  return dependencies;
};

const executeTool = async (
  dependencies: FoundationDependencies,
  threadId: string | undefined,
  requestContext = new RequestContext<unknown>(),
) => {
  const execute = dependencies.tools.startKycApplication.execute;
  if (execute === undefined) throw new Error('Expected executable KYC tool');
  const result = await execute(
    { scenarioId: 'low-risk-v1' },
    {
      requestContext,
      observe: noopObserve,
      agent: {
        agentId: 'kyc-onboarding-agent',
        toolCallId: 'tool-call-1',
        messages: [],
        suspend: () => Promise.resolve(),
        ...(threadId === undefined ? {} : { threadId }),
      },
    },
  );
  return startKycApplicationToolOutputSchema.parse(result);
};

describe('start KYC application tool', () => {
  it('associates the trusted Studio thread, tenant, case, and deterministic workflow run', async () => {
    const dependencies = await createFixtureDependencies();

    const [first, second] = await Promise.all([
      executeTool(dependencies, 'studio-thread-1'),
      executeTool(dependencies, 'studio-thread-1'),
    ]);
    const replayed = await executeTool(dependencies, 'studio-thread-1');

    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    const canonical = first.replayed ? second : first;
    expect(canonical).toMatchObject({
      status: 'SUSPENDED',
      replayed: false,
      pendingAction: { action: 'COMPLIANCE_REVIEW' },
    });
    expect(replayed).toEqual({ ...canonical, replayed: true });
    const rows = await dependencies.storage.operational.execute(
      'SELECT tenant_id, case_id, workflow_run_id, status FROM studio_case_links',
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      tenant_id: 'demo',
      case_id: canonical.caseId,
      workflow_run_id: canonical.workflowRunId,
      status: 'ACTIVE',
    });
    expect(JSON.stringify(canonical)).not.toMatch(/Morgan Example|SYNTHETIC-001/u);
  });

  it('replays the same thread result after dependency reconstruction', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-kyc-tool-restart-'));
    directories.push(directory);
    const config = createTestConfig(directory);
    const firstDependencies = await createDependencies(config);
    const first = await executeTool(firstDependencies, 'studio-thread-restart');
    firstDependencies.storage.close();

    const restartedDependencies = await createDependencies(config);
    activeDependencies.push(restartedDependencies);
    const replayed = await executeTool(restartedDependencies, 'studio-thread-restart');

    expect(first.replayed).toBe(false);
    expect(replayed).toEqual({ ...first, replayed: true });
  });

  it('retries a persisted failed run and converges after a transient provider failure', async () => {
    const dependencies = await createFixtureDependencies();
    const provider = dependencies.providers.documentExtraction;
    const originalExtract = provider.extract.bind(provider);
    let calls = 0;
    Object.defineProperty(provider, 'extract', {
      configurable: true,
      value: async (...args: Parameters<typeof provider.extract>) => {
        calls += 1;
        if (calls === 1) {
          throw new ProviderUnavailableError({
            providerId: provider.id,
            operation: 'DOCUMENT_EXTRACTION',
            safeMessage: 'The synthetic transient dependency is unavailable',
          });
        }
        return originalExtract(...args);
      },
    });

    await expect(executeTool(dependencies, 'studio-thread-retry')).rejects.toBeInstanceOf(WorkflowExecutionError);
    const recovered = await executeTool(dependencies, 'studio-thread-retry');

    expect(recovered).toMatchObject({
      status: 'SUSPENDED',
      replayed: true,
      pendingAction: { action: 'COMPLIANCE_REVIEW' },
    });
    expect(calls).toBe(2);
    const counts = await dependencies.storage.operational.execute(
      `SELECT
        (SELECT COUNT(*) FROM kyc_cases) AS cases,
        (SELECT COUNT(*) FROM studio_case_links) AS links,
        (SELECT COUNT(*) FROM document_extractions) AS extractions,
        (SELECT COUNT(*) FROM evidence_items) AS evidence,
        (SELECT COUNT(*) FROM provider_cost_records) AS cost`,
    );
    expect(counts.rows[0]).toMatchObject({
      cases: 1,
      links: 1,
      extractions: 1,
      evidence: 5,
      cost: 1,
    });
  });

  it('fails closed when the trusted agent thread is unavailable', async () => {
    const dependencies = await createFixtureDependencies();

    await expect(executeTool(dependencies, undefined)).rejects.toBeInstanceOf(StudioContextError);
    const rows = await dependencies.storage.operational.execute('SELECT case_id FROM studio_case_links');
    expect(rows.rows).toHaveLength(0);
  });

  it('ignores tenant and policy values injected through untrusted request context', async () => {
    const dependencies = await createFixtureDependencies();
    const untrusted = new RequestContext<unknown>();
    untrusted.setRaw('tenantId', 'attacker-controlled');
    untrusted.setRaw('policyProfile', 'attacker-controlled');

    await executeTool(dependencies, 'studio-thread-trusted-defaults', untrusted);

    const rows = await dependencies.storage.operational.execute('SELECT tenant_id FROM studio_case_links');
    expect(rows.rows).toEqual([expect.objectContaining({ tenant_id: 'demo' })]);
  });
});
