import { BillingDatabase } from '../../src/billing/storage/database.js';
import { MeasurementCollector } from '../../src/billing/runtime/measurement.js';
import { createTool } from '@mastra/core/tools';
import { getEventListeners, once } from 'node:events';
import { Memory } from '@mastra/memory';
import { StudioAgentRuntime } from '../../src/studio-billing/studio-agent-decorator.js';
import { createStudioOperationTools } from '../../src/studio-billing/studio-operation-tools.js';
import { studioChatProxy } from '../../src/studio-billing/studio-chat-proxy.js';
import { createBilling } from '../../src/billing/integration.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { LocalBillingStorage } from '../../src/billing/providers/local/storage.js';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { Hono } from 'hono';
import { RequestContext } from '@mastra/core/request-context';
import { EXECUTE_TOOL_ROUTE } from '@mastra/server/handlers/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createBillingApplication } from '../../src/billing/application.js';
import { configuredOrganizations } from '../../src/billing/configuration/environment.js';
import { resourceAction } from '../../src/billing/resource-catalog.js';
import type { ResourceCatalog, ResourceDefinition, ResourceDependencies } from '../../src/billing/resource-catalog.js';
import { billingSocket } from '../support/http.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fork } from 'node:child_process';
import { readFile, stat, chmod, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { modelBoundary, runtimeFixture, mastraConfiguration, operationBarrier } from '../support/mastra.js';
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { agentResource, workflowResource } from '../../src/billing/mastra-resources.js';
import { initializeMastraBilling } from '../../src/billing/mastra-setup.js';
import { billingConfigurationSchema } from '../../src/billing/configuration/policy.js';
import { MastraBilling } from '../../src/billing/mastra.js';
import { BillingRecovery } from '../../src/billing/runtime/recovery.js';
import { RecoveryStorage } from '../../src/billing/storage/recovery.js';
import { boundedJson, fingerprint } from '../../src/billing/runtime/accounting.js';
import { independentClient, temporaryDatabase } from '../support/billing.js';
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture(
  options: Pick<
    Parameters<typeof runtimeFixture>[0],
    | 'configure'
    | 'workflowPrompt'
    | 'workflowAfterPrompt'
    | 'workflowAfterBoundary'
    | 'workflowExpectedCalls'
    | 'workflowAgentDependencies'
    | 'workflowTransforms'
    | 'processorRetry'
    | 'agentMaxSteps'
    | 'structured'
  > = {},
) {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const model = await modelBoundary();
  cleanups.push(model.close);
  const runtime = await runtimeFixture({
    databaseUrl: database.url,
    directory: database.directory,
    modelUrl: model.url,
    ...options,
  });
  cleanups.push(runtime.close);
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  return { database, model, runtime, observer };
}
function worker(
  phase: 'start' | 'resume' | 'write' | 'read',
  options: object,
  executionId = '',
  script = 'mastra-worker.mjs',
) {
  return new Promise<any>((resolve, reject) => {
    const child = fork(
      fileURLToPath(new URL(`../support/${script}`, import.meta.url)),
      [phase, JSON.stringify(options), executionId],
      { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
    );
    let stderr = '';
    let result: any;
    child.stderr?.on('data', chunk => (stderr += chunk));
    child.on('message', message => (result = message));
    child.on('exit', code =>
      code === 0 && !result?.error ? resolve(result) : reject(new Error(`${result?.error ?? stderr} (exit ${code})`)),
    );
    child.on('error', reject);
  });
}
describe('billed Mastra runtime', () => {
  it('agent generation returns content and settles measured usage once', async () => {
    const { runtime, observer, model } = await fixture();
    let callbacks = 0;
    const response = await runtime.billing.agent('assistant').generate('[multi] use echo then answer', {
      billing: runtime.billingContext,
      idempotencyKey: 'generate-once',
      onStepFinish: async () => {
        expect((await observer.execute('SELECT id FROM billing_measurements')).rows.length).toBeGreaterThan(0);
        callbacks++;
      },
    });
    expect(response.kind).toBe('immediate');
    if (response.kind !== 'immediate') throw new Error('Expected actual immediate SDK result');
    expect(response.result.text).toBe('ok');
    expect(response.result.steps).toHaveLength(2);
    expect(response.billing).toMatchObject({
      executionStatus: 'completed',
      observedUnits: 10,
      billedUnits: 10,
      settlementStatus: 'settled',
    });
    expect(callbacks).toBe(2);
    const replay = await runtime.billing
      .agent('assistant')
      .generate('[multi] use echo then answer', { billing: runtime.billingContext, idempotencyKey: 'generate-once' });
    expect(replay).toMatchObject({
      kind: 'replay',
      result: { text: 'ok', finishReason: 'stop' },
      billing: { replayed: true, billedUnits: 10 },
    });
    expect(replay.result).not.toHaveProperty('steps');
    expect(model.requests).toHaveLength(2);
    expect(model.requests.every(request => request.body.max_tokens === 20)).toBe(true);
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 10n }]);
    expect((await observer.execute('SELECT id FROM billing_outbox')).rows).toHaveLength(1);
    expect(
      (await observer.execute("SELECT SUM(units) AS units FROM billing_measurements WHERE measure = 'input-tokens'"))
        .rows,
    ).toEqual([{ units: 6n }]);
  });
  it('suspended workflow resumes after restart and settles one task', async () => {
    const { runtime, observer, model, database } = await fixture();
    const options = {
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: runtime.billingContext.workspaceId,
    };
    await runtime.close();
    const suspended = await worker('start', options);
    expect(suspended.projection).toMatchObject({ status: 'suspended', suspendedSteps: ['approval'] });
    expect(suspended.billing).toMatchObject({ settlementStatus: 'reserved', billedUnits: null });
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
    const resumed = await worker('resume', options, suspended.executionId);
    expect(resumed.projection).toMatchObject({ status: 'completed', output: { count: 2 } });
    expect(resumed.billing).toMatchObject({ billedUnits: 2, settlementStatus: 'settled' });
    expect(resumed.duplicate).toMatchObject({ kind: 'replay', billing: { billedUnits: 2, replayed: true } });
    const events = (await readFile(join(database.directory, 'workflow-events.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(events).toEqual([{ step: 'before' }, { step: 'after' }]);
    expect(model.requests).toHaveLength(2);
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 2n }]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
    expect((await observer.execute('SELECT id FROM billing_outbox')).rows).toHaveLength(0);
    expect(
      (await observer.execute("SELECT SUM(units) AS units FROM billing_measurements WHERE measure = 'tokens'")).rows,
    ).toEqual([{ units: 10n }]);
  });
  it('unrelated agent registrations preserve workflow reads, resume and expiry', async () => {
    const { runtime, observer, model } = await fixture();
    const reopen = (extra: boolean, version = 'unrelated-v1') => {
      const configuration = {
        ...runtime.configuration,
        resourcePolicies: [
          ...runtime.configuration.resourcePolicies,
          ...(extra ? [{ ...runtime.configuration.resourcePolicies[0], id: 'unrelated' }] : []),
        ],
      };
      return new MastraBilling({
        organizations: runtime.organizations,
        accounting: runtime.accounting,
        workflowStorage: runtime.workflowStorage,
        provider: runtime.provider,
        configuration,
        agents: {
          ...runtime.agents,
          ...(extra ? { unrelated: agentResource(runtime.agents.assistant.native, { version }) } : {}),
        },
        workflows: runtime.workflows,
      });
    };
    for (const [scenario, initial, changed] of [
      ['added', runtime.billing, reopen(true)],
      ['changed', reopen(true), reopen(true, 'unrelated-v2')],
      ['removed', reopen(true), runtime.billing],
    ] as const) {
      const pending = [];
      for (const operation of ['resume', 'expire']) {
        const run = await initial.workflow('report').createRun({
          billing: runtime.billingContext,
          idempotencyKey: `${scenario}-${operation}`,
        });
        await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
        pending.push(
          await changed.workflow('report').getRun({ billing: runtime.billingContext, executionId: run.executionId }),
        );
      }
      const [resumed, expired] = pending;
      expect(await resumed.status(runtime.billingContext)).toMatchObject({ result: { status: 'suspended' } });
      expect(
        await resumed.resume({
          billing: runtime.billingContext,
          idempotencyKey: 'resume',
          step: 'approval',
          resumeData: { approved: true },
        }),
      ).toMatchObject({ billing: { billedUnits: 2 }, projection: { output: { count: 2 } } });
      expect(await changed.expireSuspensions(Date.now() + 172800000)).toContain(expired.executionId);
      expect(await expired.status(runtime.billingContext)).toMatchObject({
        result: { status: 'canceled' },
        billing: { billedUnits: 0 },
      });
      expect(
        (
          await observer.execute({
            sql: 'SELECT active FROM billing_reservations WHERE execution_id IN (?, ?)',
            args: [resumed.executionId, expired.executionId],
          })
        ).rows,
      ).toEqual([{ active: 0n }, { active: 0n }]);
    }
    expect(model.requests).toHaveLength(9);
    expect((await observer.execute('SELECT units FROM billing_ledger ORDER BY units')).rows).toEqual([
      { units: 0n },
      { units: 0n },
      { units: 0n },
      { units: 2n },
      { units: 2n },
      { units: 2n },
    ]);
  });

  it('legacy workflow signatures require proof of unchanged dependencies before resume or expiry', async () => {
    const { runtime, observer, model } = await fixture();
    const resource = runtime.workflows.report;
    const current = { assistant: runtime.agents.assistant.definition };
    const reopen = (
      options: { manifest?: Record<string, string>; assistantVersion?: string; workflowVersion?: string } = {},
    ) => {
      const configuration = {
        ...runtime.configuration,
        resourcePolicies: [
          ...runtime.configuration.resourcePolicies,
          { ...runtime.configuration.resourcePolicies[0], id: 'unrelated' },
        ],
      };
      return new MastraBilling({
        organizations: runtime.organizations,
        accounting: runtime.accounting,
        workflowStorage: runtime.workflowStorage,
        provider: runtime.provider,
        configuration,
        agents: {
          assistant: options.assistantVersion
            ? agentResource(runtime.agents.assistant.native, { version: options.assistantVersion })
            : runtime.agents.assistant,
          unrelated: agentResource(runtime.agents.assistant.native, { version: 'unrelated-current' }),
        },
        workflows: {
          report: workflowResource(resource.native, {
            version: options.workflowVersion ?? resource.version,
            measurement: resource.measurement,
            expectedCalls: resource.expectedCalls,
            agentDependencies: ['assistant'],
            legacyAgentDefinitions: options.manifest ? [options.manifest] : [],
          }),
        },
      });
    };
    for (const retired of [false, true]) {
      const definitions = { ...current, ...(retired ? { retired: 'agent:retired-definition' } : {}) };
      // Seed historical creation terms through real SQL storage, then exercise
      // the public lifecycle against real Mastra snapshots and reservations.
      const legacy = `definition:${fingerprint(
        boundedJson({
          version: resource.version,
          measurement: resource.measurement,
          expectedCalls: resource.expectedCalls,
          agents: Object.entries(definitions)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
            .map(([key, definition]) => ({ key, definition })),
        }),
      )}`;
      const runs = [];
      for (const operation of ['resume', 'expire']) {
        const identity = await runtime.organizations.accountingIdentity(runtime.billingContext);
        const historical = await runtime.workflowStorage.create(
          identity,
          runtime.billing.gateway.resource('report'),
          legacy,
          `legacy-${retired}-${operation}`,
        );
        const initial = reopen(retired ? { manifest: definitions } : {});
        const run = await initial
          .workflow('report')
          .getRun({ billing: runtime.billingContext, executionId: historical.id });
        await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
        runs.push(run);
      }
      for (const options of [
        ...(retired ? [{}, { manifest: { retired: 'agent:retired-definition' } }] : []),
        { manifest: definitions, assistantVersion: 'assistant-changed' },
        { manifest: definitions, workflowVersion: 'workflow-changed' },
      ]) {
        const changed = reopen(options);
        const handle = await changed
          .workflow('report')
          .getRun({ billing: runtime.billingContext, executionId: runs[0].executionId });
        await expect(handle.status(runtime.billingContext)).rejects.toMatchObject({ code: 'state_unavailable' });
        await expect(
          handle.resume({
            billing: runtime.billingContext,
            idempotencyKey: 'rejected-resume',
            step: 'approval',
            resumeData: { approved: true },
          }),
        ).rejects.toMatchObject({ code: 'state_unavailable' });
        expect(await changed.expireSuspensions(Date.now() + 172800000)).toEqual([]);
      }
      const compatible = reopen(retired ? { manifest: definitions } : {});
      const resumed = await compatible
        .workflow('report')
        .getRun({ billing: runtime.billingContext, executionId: runs[0].executionId });
      expect(await resumed.status(runtime.billingContext)).toMatchObject({ result: { status: 'suspended' } });
      expect(
        await resumed.resume({
          billing: runtime.billingContext,
          idempotencyKey: 'approved-resume',
          step: 'approval',
          resumeData: { approved: true },
        }),
      ).toMatchObject({ projection: { status: 'completed', output: { count: 2 } }, billing: { billedUnits: 2 } });
      expect(await compatible.expireSuspensions(Date.now() + 172800000)).toContain(runs[1].executionId);
      expect(
        (
          await observer.execute({
            sql: 'SELECT adapter_version FROM billing_workflow_runs WHERE id IN (?, ?)',
            args: runs.map(run => run.executionId),
          })
        ).rows,
      ).toEqual([{ adapter_version: legacy }, { adapter_version: legacy }]);
    }
    expect(model.requests).toHaveLength(6);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([
      { active: 0n },
      { active: 0n },
      { active: 0n },
      { active: 0n },
    ]);
    expect(
      (await observer.execute("SELECT COUNT(*) AS count FROM billing_workflow_operations WHERE operation = 'resume'"))
        .rows,
    ).toEqual([{ count: 2n }]);
  });

  it('legacy manifests retain holds for removed agents without an explicit dependency declaration', async () => {
    const { runtime, observer, model } = await fixture();
    const resource = runtime.workflows.report;
    const definitions = { assistant: runtime.agents.assistant.definition, retired: 'agent:retired-definition' };
    const legacy = `definition:${fingerprint(
      boundedJson({
        version: resource.version,
        measurement: resource.measurement,
        expectedCalls: resource.expectedCalls,
        agents: Object.entries(definitions).map(([key, definition]) => ({ key, definition })),
      }),
    )}`;
    const reopen = (explicit: boolean) =>
      new MastraBilling({
        organizations: runtime.organizations,
        accounting: runtime.accounting,
        workflowStorage: runtime.workflowStorage,
        provider: runtime.provider,
        configuration: runtime.configuration,
        agents: runtime.agents,
        workflows: {
          report: workflowResource(resource.native, {
            version: resource.version,
            measurement: resource.measurement,
            expectedCalls: resource.expectedCalls,
            legacyAgentDefinitions: [definitions],
            ...(explicit ? { agentDependencies: ['assistant'] } : {}),
          }),
        },
      });
    const identity = await runtime.organizations.accountingIdentity(runtime.billingContext);
    const historical = await runtime.workflowStorage.create(
      identity,
      runtime.billing.gateway.resource('report'),
      legacy,
      'legacy-removed-agent',
    );
    const explicit = reopen(true);
    const run = await explicit
      .workflow('report')
      .getRun({ billing: runtime.billingContext, executionId: historical.id });
    await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
    const conservative = reopen(false);
    const blocked = await conservative
      .workflow('report')
      .getRun({ billing: runtime.billingContext, executionId: historical.id });
    await expect(blocked.status(runtime.billingContext)).rejects.toMatchObject({ code: 'state_unavailable' });
    await expect(
      blocked.resume({
        billing: runtime.billingContext,
        idempotencyKey: 'resume',
        step: 'approval',
        resumeData: { approved: true },
      }),
    ).rejects.toMatchObject({ code: 'state_unavailable' });
    expect(await conservative.expireSuspensions(Date.now() + 172800000)).toEqual([]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
    expect((await observer.execute('SELECT status FROM billing_workflow_runs')).rows).toEqual([
      { status: 'suspended' },
    ]);
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
    expect(model.requests).toHaveLength(1);
    expect(
      await run.resume({
        billing: runtime.billingContext,
        idempotencyKey: 'explicit-resume',
        step: 'approval',
        resumeData: { approved: true },
      }),
    ).toMatchObject({ projection: { status: 'completed' }, billing: { billedUnits: 2 } });
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
    expect(model.requests).toHaveLength(2);
  });

  it('changed declared dependencies remain incompatible and undeclared workflows retain registry safeguards', async () => {
    const { runtime, observer, model } = await fixture();
    const construct = (agents: typeof runtime.agents, dependencies?: readonly string[]) =>
      new MastraBilling({
        organizations: runtime.organizations,
        accounting: runtime.accounting,
        workflowStorage: runtime.workflowStorage,
        provider: runtime.provider,
        configuration: runtime.configuration,
        agents,
        workflows: {
          report: workflowResource(runtime.workflows.report.native, {
            version: runtime.workflows.report.version,
            measurement: 'facade-calls',
            expectedCalls: [1, 1],
            ...(dependencies === undefined ? {} : { agentDependencies: dependencies }),
          }),
        },
      });
    for (const dependencies of [undefined, ['assistant']]) {
      const initial = construct(runtime.agents, dependencies);
      const run = await initial
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: `dependency-${dependencies === undefined}` });
      await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
      const changed = construct(
        { assistant: agentResource(runtime.agents.assistant.native, { version: 'changed' }) },
        dependencies,
      );
      const handle = await changed
        .workflow('report')
        .getRun({ billing: runtime.billingContext, executionId: run.executionId });
      await expect(handle.status(runtime.billingContext)).rejects.toMatchObject({ code: 'state_unavailable' });
      await expect(
        handle.resume({
          billing: runtime.billingContext,
          idempotencyKey: 'resume',
          step: 'approval',
          resumeData: { approved: true },
        }),
      ).rejects.toMatchObject({ code: 'state_unavailable' });
      expect(await changed.expireSuspensions(Date.now() + 172800000)).toEqual([]);
    }
    expect(() => construct(runtime.agents, ['missing'])).toThrowError(
      expect.objectContaining({ code: 'invalid_configuration' }),
    );
    expect(model.requests).toHaveLength(2);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([
      { active: 1n },
      { active: 1n },
    ]);
  });

  it('a workflow cannot execute an agent omitted from its declared dependencies', async () => {
    const { runtime, observer, model } = await fixture({ workflowAgentDependencies: [] });
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'undeclared-agent' });
    const result = await run.start({
      billing: runtime.billingContext,
      idempotencyKey: 'start',
      inputData: { count: 0 },
    });
    expect(result).toMatchObject({
      projection: { status: 'failed' },
      billing: { billedUnits: 0, settlementStatus: 'released' },
    });
    expect(model.requests).toEqual([]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
  });

  it('workflow resume revalidates actor and membership', async () => {
    const { runtime, model, observer } = await fixture();
    await runtime.organizations.convert(runtime.billingContext, 'shared');
    const member = await runtime.organizations.provisionLocal({ profileId: 'member', displayName: 'Member' });
    const invitation = await runtime.organizations.invite(runtime.billingContext, 'invite', {
      recipientId: member.identity.id,
      role: 'member',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    await runtime.organizations.acceptInvitation({
      credential: member.credential!,
      key: 'accept',
      token: invitation.token!,
    });
    const memberContext = await runtime.organizations.context({
      credential: member.credential!,
      workspaceId: runtime.billingContext.workspaceId,
    });
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'private-run' });
    await run.start({ billing: runtime.billingContext, idempotencyKey: 'start-private', inputData: { count: 0 } });
    await expect(
      runtime.billing.workflow('report').getRun({ executionId: run.executionId, billing: memberContext }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await runtime.organizations.changeMember(runtime.billingContext, 'promote', {
      memberId: member.identity.id,
      role: 'owner',
    });
    await runtime.organizations.changeMember(memberContext, 'remove', {
      memberId: runtime.billingContext.actorId,
      role: null,
    });
    await expect(
      run.resume({
        billing: runtime.billingContext,
        idempotencyKey: 'revoked',
        step: 'approval',
        resumeData: { approved: true },
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(model.requests).toHaveLength(1);
    expect(
      (await observer.execute("SELECT run_id FROM billing_workflow_operations WHERE operation = 'resume'")).rows,
    ).toEqual([]);
    expect((await observer.execute('SELECT status FROM billing_workflow_runs')).rows).toEqual([
      { status: 'suspended' },
    ]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
    await runtime.directory.setIdentityActive(runtime.billingContext.actorId, false);
    await expect(run.status(runtime.billingContext)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it.each(['suspended', 'completed'] as const)(
    'late start failures preserve a committed %s workflow and its saved result',
    async status => {
      const { runtime, observer } = await fixture();
      const run = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: 'late-start-failure' });
      await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
      if (status === 'completed')
        await run.resume({
          billing: runtime.billingContext,
          idempotencyKey: 'resume',
          step: 'approval',
          resumeData: { approved: true },
        });
      const committed = await runtime.workflowStorage.current(run.executionId);
      expect(committed.status).toBe(status);
      expect(committed.result).not.toBeNull();
      if (status === 'suspended') expect(committed.expiresAt).toBeGreaterThan(Date.now());
      await runtime.workflowStorage.transition(run.executionId, committed.version, 'uncertain');
      expect(await runtime.workflowStorage.current(run.executionId)).toEqual(committed);
      const persisted = (
        await observer.execute({
          sql: 'SELECT status, result, expires_at FROM billing_workflow_runs WHERE id = ?',
          args: [run.executionId],
        })
      ).rows[0];
      expect(persisted.status).toBe(status);
      expect(persisted.result).not.toBeNull();
      expect((await run.status(runtime.billingContext)).result).toMatchObject({ status });
    },
  );

  it('suspension expiry and resume race cannot double release or charge', async () => {
    const { runtime, model, observer, database } = await fixture({
      configure: configuration => {
        configuration.resourcePolicies[1].policy.suspendedReservationTtlMs = 15;
        return configuration;
      },
    });
    const contender = await runtimeFixture({
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: runtime.billingContext.workspaceId,
      configuration: runtime.configuration,
    });
    cleanups.push(contender.close);
    for (let round = 0; round < 20; round++) {
      const handle = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: `race-${round}` });
      const suspended = await handle.start({
        billing: runtime.billingContext,
        idempotencyKey: `start-${round}`,
        inputData: { count: 0 },
      });
      const projection = suspended.kind === 'immediate' ? suspended.projection : suspended.result;
      if (round % 2 === 1)
        await new Promise(resolve => setTimeout(resolve, Math.max(0, projection.expiresAt! - Date.now() + 1)));
      const other = await contender.billing
        .workflow('report')
        .getRun({ executionId: handle.executionId, billing: contender.billingContext });
      await Promise.allSettled([
        other.resume({
          billing: contender.billingContext,
          idempotencyKey: `resume-${round}`,
          step: 'approval',
          resumeData: { approved: true },
        }),
        runtime.billing.expireSuspensions(),
        handle.cancel({ billing: runtime.billingContext, idempotencyKey: `cancel-${round}` }),
      ]);
      await runtime.billing.expireSuspensions();
      const ledger = (
        await observer.execute({
          sql: 'SELECT units FROM billing_ledger WHERE execution_id = ?',
          args: [handle.executionId],
        })
      ).rows;
      const reservations = (
        await observer.execute({
          sql: 'SELECT active FROM billing_reservations WHERE execution_id = ?',
          args: [handle.executionId],
        })
      ).rows;
      const record = (
        await observer.execute({
          sql: 'SELECT status FROM billing_workflow_runs WHERE id = ?',
          args: [handle.executionId],
        })
      ).rows[0];
      expect(ledger.length, `round ${round}`).toBeLessThanOrEqual(1);
      if (record.status === 'uncertain') {
        expect(ledger).toEqual([]);
        expect(reservations).toEqual([{ active: 1n }]);
      } else {
        expect(['completed', 'canceled']).toContain(record.status);
        expect(ledger).toHaveLength(1);
        expect(ledger[0].units).toBe(record.status === 'completed' ? 2n : 0n);
        expect(reservations).toEqual([{ active: 0n }]);
      }
      const events = (
        await observer.execute({
          sql: 'SELECT id FROM billing_outbox WHERE execution_id = ?',
          args: [handle.executionId],
        })
      ).rows;
      expect(events).toEqual([]);
    }
  }, 60000);

  it('partial failed usage is nonbillable and missing usage stays unresolved', async () => {
    const { runtime, observer } = await fixture();
    const failed = await runtime.billing.agent('assistant').generate('[partial-error] fail after tool', {
      billing: runtime.billingContext,
      idempotencyKey: 'partial-error',
    });
    expect(failed.kind).toBe('replay');
    if (failed.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(failed.billing).toMatchObject({
      executionStatus: 'failed',
      observedUnits: 5,
      billedUnits: 0,
      settlementStatus: 'released',
    });
    const mixed = await runtime.billing
      .agent('assistant')
      .generate('[mixed] omit second usage', { billing: runtime.billingContext, idempotencyKey: 'mixed' });
    if (mixed.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(mixed.billing).toMatchObject({
      executionStatus: 'uncertain',
      observedUnits: 5,
      billedUnits: null,
      settlementStatus: 'pending',
    });
    const missing = await runtime.billing
      .agent('assistant')
      .generate('[missing] answer', { billing: runtime.billingContext, idempotencyKey: 'missing' });
    if (missing.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(missing.billing).toMatchObject({ observedUnits: null, billedUnits: null, settlementStatus: 'pending' });
    const zero = await runtime.billing
      .agent('assistant')
      .generate('[zero] answer', { billing: runtime.billingContext, idempotencyKey: 'zero' });
    if (zero.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(zero.billing).toMatchObject({ observedUnits: 0, billedUnits: 0, settlementStatus: 'settled' });
    expect((await observer.execute('SELECT units FROM billing_ledger ORDER BY execution_id')).rows).toHaveLength(2);
    expect((await observer.execute('SELECT id FROM billing_outbox')).rows).toEqual([]);
    const aborted = await runtime.billing.agent('assistant').generate('[abort] wait', {
      billing: runtime.billingContext,
      idempotencyKey: 'abort',
      abortSignal: AbortSignal.timeout(100),
    });
    if (aborted.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(aborted.billing).toMatchObject({
      executionStatus: 'canceled',
      billedUnits: 0,
      observedUnits: null,
      settlementStatus: 'released',
    });
  });

  it('instrumented workflow segments accumulate usage and retain their original policy', async () => {
    const { runtime, database, model, observer } = await fixture({
      configure: configuration => {
        configuration.resourcePolicies[1].policy.charge = {
          type: 'usage',
          meter: 'tokens',
          measure: 'tokens',
          maxUnits: 40,
          funding: 'metered',
        };
        return configuration;
      },
    });
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'metered-workflow' });
    const suspended = await run.start({
      billing: runtime.billingContext,
      idempotencyKey: 'start',
      inputData: { count: 0 },
    });
    expect(suspended.billing).toMatchObject({ observedUnits: 5, billedUnits: null });
    const changed = mastraConfiguration(runtime.billingContext.workspaceId, { workflowUsage: true });
    changed.resourcePolicies[1].policy.version = 'new-policy';
    changed.resourcePolicies[1].policy.charge = { type: 'per-task', meter: 'tasks', units: 7, funding: 'prepaid' };
    const restarted = await runtimeFixture({
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: runtime.billingContext.workspaceId,
      configuration: changed,
    });
    cleanups.push(restarted.close);
    const reloaded = await restarted.billing
      .workflow('report')
      .getRun({ executionId: run.executionId, billing: restarted.billingContext });
    const result = await reloaded.resume({
      billing: restarted.billingContext,
      idempotencyKey: 'resume-original',
      step: 'approval',
      resumeData: { approved: true },
    });
    expect(result.billing).toMatchObject({ policyVersion: 'workflow-v1', observedUnits: 10, billedUnits: 10 });
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 10n }]);
    const current = await restarted.billing
      .workflow('report')
      .createRun({ billing: restarted.billingContext, idempotencyKey: 'new-policy-run' });
    await current.start({ billing: restarted.billingContext, idempotencyKey: 'new-start', inputData: { count: 0 } });
    const next = await current.resume({
      billing: restarted.billingContext,
      idempotencyKey: 'new-resume',
      step: 'approval',
      resumeData: { approved: true },
    });
    expect(next.billing).toMatchObject({ policyVersion: 'new-policy', billedUnits: 7 });
  });

  it('canceled and failed metered workflows retain observed usage without a bill or export', async () => {
    for (const status of ['cancel', 'failure'] as const) {
      const { runtime, observer } = await fixture({
        workflowAfterPrompt: status === 'failure' ? '[model-error] stop after approval' : undefined,
        configure: configuration => {
          configuration.resourcePolicies[1].policy.charge = {
            type: 'usage',
            meter: 'tokens',
            measure: 'tokens',
            maxUnits: 40,
            funding: 'metered',
          };
          return configuration;
        },
      });
      const run = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: status });
      await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
      const result =
        status === 'cancel'
          ? await run.cancel({ billing: runtime.billingContext, idempotencyKey: 'cancel' })
          : await run.resume({
              billing: runtime.billingContext,
              idempotencyKey: 'resume',
              step: 'approval',
              resumeData: { approved: true },
            });
      expect(result.billing).toMatchObject({ observedUnits: 5, billedUnits: 0, settlementStatus: 'released' });
      expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
      expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
      expect((await observer.execute('SELECT id FROM billing_outbox')).rows).toEqual([]);
      expect(
        (await observer.execute("SELECT SUM(units) AS units FROM billing_measurements WHERE measure = 'tokens'")).rows,
      ).toEqual([{ units: 5n }]);
    }
  });

  it('real structured output preserves SDK typing and replay uses only its projection', async () => {
    const { runtime, model } = await fixture({ structured: true });
    const result = await runtime.billing
      .agent('assistant')
      .generate('[structured] return object', { billing: runtime.billingContext, idempotencyKey: 'structured' });
    expect(result.kind).toBe('immediate');
    if (result.kind !== 'immediate') throw new Error('Expected SDK output');
    expect(result.result.object).toEqual({ answer: 'ok' });
    expect(result.result.steps).toHaveLength(1);
    const replay = await runtime.billing
      .agent('assistant')
      .generate('[structured] return object', { billing: runtime.billingContext, idempotencyKey: 'structured' });
    expect(replay).toMatchObject({ kind: 'replay', result: { object: { answer: 'ok' } } });
    expect(replay.result).not.toHaveProperty('steps');
    expect(model.requests).toHaveLength(1);
  });

  it.each([1, 2, 3])(
    'resumed workflows enforce a total %s-call budget without counting completed calls twice',
    async maxUnits => {
      const { runtime, model } = await fixture({
        agentMaxSteps: 1,
        workflowExpectedCalls: maxUnits === 3 ? [1, 2] : [1, 1],
        ...(maxUnits === 3
          ? {
              workflowAfterBoundary: async (invoke: () => Promise<unknown>) => {
                await invoke();
                await invoke();
              },
            }
          : {}),
        configure: configuration => {
          configuration.billingKeys.meters.find(meter => meter.key === 'calls')!.funding = ['metered'];
          Object.assign(
            configuration.localAccounts[0].meters.find(meter => meter.key === 'calls')!,
            { funding: 'metered', balance: null },
          );
          configuration.resourcePolicies[1].policy.charge = {
            type: 'usage',
            meter: 'calls',
            measure: 'model-calls',
            maxUnits,
            funding: 'metered',
          };
          return configuration;
        },
      });
      const run = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: 'carried-budget' });
      await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
      expect(model.requests).toHaveLength(1);
      const result = await run.resume({
        billing: runtime.billingContext,
        idempotencyKey: 'resume',
        step: 'approval',
        resumeData: { approved: true },
      });
      expect(model.requests).toHaveLength(maxUnits);
      expect(result.billing).toMatchObject(
        maxUnits === 1
          ? { executionStatus: 'failed', billedUnits: 0 }
          : { executionStatus: 'completed', observedUnits: maxUnits, billedUnits: maxUnits },
      );
    },
  );

  it('supported call budgets reject unbounded prepaid tokens and overflow bills zero', async () => {
    const { runtime, model, observer } = await fixture();
    const build = (configuration: typeof runtime.configuration) =>
      new MastraBilling({
        organizations: runtime.organizations,
        accounting: runtime.accounting,
        workflowStorage: runtime.workflowStorage,
        provider: runtime.provider,
        configuration,
        agents: runtime.agents,
        workflows: runtime.workflows,
      });
    const unbounded = billingConfigurationSchema.parse(runtime.configuration);
    unbounded.resourcePolicies[0].measurements.find(measure => measure.key === 'tokens')!.enforceableBound = true;
    unbounded.resourcePolicies[0].policy.charge = {
      type: 'usage',
      meter: 'tokens',
      measure: 'tokens',
      maxUnits: 20,
      funding: 'prepaid',
    };
    expect(() => build(unbounded)).toThrowError(expect.objectContaining({ code: 'invalid_configuration' }));
    expect(model.requests).toHaveLength(0);
    const bounded = billingConfigurationSchema.parse(runtime.configuration);
    bounded.resourcePolicies[0].policy.charge = {
      type: 'usage',
      meter: 'calls',
      measure: 'model-calls',
      maxUnits: 2,
      funding: 'prepaid',
    };
    const calls = build(bounded);
    const counted = await calls
      .agent('assistant')
      .generate('[multi] count model calls', { billing: runtime.billingContext, idempotencyKey: 'count-calls' });
    if (counted.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(counted.billing).toMatchObject({ observedUnits: 2, billedUnits: 2, settlementStatus: 'settled' });
    const overflow = await runtime.billing
      .agent('assistant')
      .generate('[overflow] enforce ceiling', { billing: runtime.billingContext, idempotencyKey: 'overflow' });
    if (overflow.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(overflow.billing).toMatchObject({
      executionStatus: 'failed',
      observedUnits: 102,
      billedUnits: 0,
      settlementStatus: 'released',
    });
    expect(
      (
        await observer.execute({
          sql: "SELECT units FROM billing_measurements WHERE execution_id = ? AND measure = 'input-tokens'",
          args: [overflow.billing.executionId],
        })
      ).rows,
    ).toEqual([{ units: 100n }]);
    expect(model.requests.filter(request => request.scenario === 'overflow')).toHaveLength(1);
  });

  it('local cancel releases a hold acknowledged after the initial workflow was canceled', async () => {
    const { runtime, model, observer } = await fixture();
    const context = runtime.billingContext;
    const protocol = runtime.provider.reservations!;
    const reserve = protocol.reserve.bind(protocol);
    const barrier = operationBarrier();
    const delayAck = vi.spyOn(protocol, 'reserve').mockImplementation(async payload => {
      const acknowledgement = await reserve(payload);
      await barrier.pause();
      return acknowledgement;
    });
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: context, idempotencyKey: 'pending-local' });
    const pending = run.start({ billing: context, idempotencyKey: 'start', inputData: { count: 0 } });
    try {
      await barrier.entered;
      expect((await observer.execute('SELECT state FROM local_provider_reservations')).rows).toEqual([
        { state: 'reserved' },
      ]);
      expect((await run.cancel({ billing: context, idempotencyKey: 'cancel' })).billing).toMatchObject({
        executionStatus: 'canceled',
        settlementStatus: 'uncertain',
        billedUnits: null,
      });
      barrier.release();
      expect((await pending).billing).toMatchObject({
        executionStatus: 'canceled',
        settlementStatus: 'released',
        billedUnits: 0,
      });
      await runtime.accounting.recoverFinancial();
      expect(model.requests).toHaveLength(0);
      expect((await observer.execute('SELECT state FROM local_provider_reservations')).rows).toEqual([
        { state: 'released' },
      ]);
      expect((await observer.execute('SELECT units, outcome FROM billing_ledger')).rows).toEqual([
        { units: 0n, outcome: 'canceled' },
      ]);
    } finally {
      barrier.release();
      await pending.catch(() => {});
      delayAck.mockRestore();
    }
  });

  it.each(['same runtime', 'other runtime'] as const)(
    'cancel from the %s wins after the preparation claim and before native start',
    async location => {
      const { runtime, model, observer, database } = await fixture();
      const other =
        location === 'same runtime'
          ? runtime
          : await runtimeFixture({
              databaseUrl: database.url,
              directory: database.directory,
              modelUrl: model.url,
              credential: runtime.credential,
              workspaceId: runtime.billingContext.workspaceId,
              configuration: runtime.configuration,
            });
      if (other !== runtime) cleanups.push(other.close);
      const barrier = operationBarrier();
      const segmentDeadline = runtime.accounting.segmentDeadline.bind(runtime.accounting);
      const pause = vi.spyOn(runtime.accounting, 'segmentDeadline').mockImplementation(async (...args) => {
        const deadline = await segmentDeadline(...args);
        if (args[3] === 'dispatch') await barrier.pause();
        return deadline;
      });
      const run = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: 'prepared-start' });
      const start = { billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } };
      const pending = run.start(start);
      try {
        await barrier.entered;
        expect((await observer.execute('SELECT execution_id FROM billing_workflow_dispatch_claims')).rows).toEqual([
          { execution_id: run.executionId },
        ]);
        const canceler = await other.billing
          .workflow('report')
          .getRun({ billing: other.billingContext, executionId: run.executionId });
        const canceled = await canceler.cancel({ billing: other.billingContext, idempotencyKey: 'cancel' });
        expect.soft(canceled.billing).toMatchObject({
          executionStatus: 'canceled',
          settlementStatus: 'released',
          billedUnits: 0,
        });
        barrier.release();
        expect.soft(await pending).toMatchObject({
          kind: 'replay',
          result: { status: 'canceled' },
          billing: { billedUnits: 0 },
        });
        await expect(readFile(join(database.directory, 'workflow-events.jsonl'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
        expect(model.requests).toHaveLength(0);
        expect((await observer.execute('SELECT state FROM local_provider_reservations')).rows).toEqual([
          { state: 'released' },
        ]);
        expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
      } finally {
        barrier.release();
        await pending.catch(() => {});
        pause.mockRestore();
      }
    },
  );

  it.each(['same runtime', 'other runtime'] as const)(
    'cancel during the committed native handoff returns pending until the %s owner acknowledges it',
    async location => {
      const { runtime, model, observer, database } = await fixture();
      const other =
        location === 'same runtime'
          ? runtime
          : await runtimeFixture({
              databaseUrl: database.url,
              directory: database.directory,
              modelUrl: model.url,
              credential: runtime.credential,
              workspaceId: runtime.billingContext.workspaceId,
              configuration: runtime.configuration,
            });
      if (other !== runtime) cleanups.push(other.close);
      const barrier = operationBarrier();
      const begin = runtime.workflowStorage.beginNativeHandoff.bind(runtime.workflowStorage);
      const current = runtime.workflowStorage.current.bind(runtime.workflowStorage);
      let handoffCommitted = false;
      const observeHandoff = vi
        .spyOn(runtime.workflowStorage, 'beginNativeHandoff')
        .mockImplementation(async (...args) => {
          await begin(...args);
          handoffCommitted = true;
          if (location === 'other runtime') await barrier.pause();
        });
      const observeRead = vi.spyOn(runtime.workflowStorage, 'current').mockImplementation(async id => {
        const record = await current(id);
        // A same-runtime cancel after the final read must still stop invocation.
        if (handoffCommitted && location === 'same runtime') await barrier.pause();
        return record;
      });
      const run = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: 'handoff-cancel' });
      const start = { billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } };
      const pending = run.start(start);
      try {
        await barrier.entered;
        expect((await observer.execute('SELECT state, version FROM billing_workflow_native_handoffs')).rows).toEqual([
          { state: 'handing_off', version: 1n },
        ]);
        const canceler = await other.billing
          .workflow('report')
          .getRun({ billing: other.billingContext, executionId: run.executionId });
        const request = { billing: other.billingContext, idempotencyKey: 'cancel' };
        expect(await canceler.cancel(request)).toMatchObject({
          kind: 'replay',
          result: { status: 'canceling' },
          billing: { executionStatus: 'uncertain', settlementStatus: 'uncertain', billedUnits: null },
        });
        expect((await observer.execute('SELECT version FROM billing_workflow_runs')).rows).toEqual([{ version: 1n }]);
        expect((await observer.execute('SELECT state FROM local_provider_reservations')).rows).toEqual([
          { state: 'reserved' },
        ]);
        barrier.release();
        expect(await pending).toMatchObject({
          kind: 'replay',
          result: { status: 'canceled' },
          billing: { executionStatus: 'canceled', settlementStatus: 'released', billedUnits: 0 },
        });
        expect((await canceler.cancel(request)).result).toMatchObject({ status: 'canceled' });
        await expect(readFile(join(database.directory, 'workflow-events.jsonl'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
        expect(model.requests).toHaveLength(0);
        expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
      } finally {
        barrier.release();
        await pending.catch(() => {});
        observeHandoff.mockRestore();
        observeRead.mockRestore();
      }
    },
  );

  it('the handoff owner aborts an invoked run whose activation has not yet committed', async () => {
    const { runtime, model, observer } = await fixture({ workflowPrompt: '[abort] handoff active' });
    const barrier = operationBarrier();
    const complete = runtime.workflowStorage.completeNativeHandoff.bind(runtime.workflowStorage);
    const observe = vi.spyOn(runtime.workflowStorage, 'completeNativeHandoff').mockImplementation(async (...args) => {
      await barrier.pause();
      return complete(...args);
    });
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'handoff-active' });
    const pending = run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
    try {
      await barrier.entered;
      await model.stallStarted;
      expect(await run.cancel({ billing: runtime.billingContext, idempotencyKey: 'cancel' })).toMatchObject({
        result: { status: 'canceling' },
        billing: { settlementStatus: 'uncertain', billedUnits: null },
      });
      barrier.release();
      const aborted = await Promise.race([
        model.stallAborted.then(() => true),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1500).unref()),
      ]);
      expect(aborted).toBe(true);
      expect(await pending).toMatchObject({
        kind: 'replay',
        result: { status: 'canceled' },
        billing: { settlementStatus: 'released', billedUnits: 0 },
      });
      expect(model.requests).toHaveLength(1);
      expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
    } finally {
      barrier.release();
      model.release();
      await pending.catch(() => {});
      observe.mockRestore();
    }
  });

  it('local cancel recovers after native cancellation commits and the billing write fails', async () => {
    const { runtime, model, observer, database } = await fixture();
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'recover-local-cancel' });
    await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
    await observer.execute(
      "CREATE TRIGGER interrupt_local_cancel BEFORE UPDATE OF status ON billing_executions WHEN NEW.status = 'canceled' BEGIN SELECT RAISE(ABORT, 'Interrupted local cancel billing'); END",
    );
    const request = { billing: runtime.billingContext, idempotencyKey: 'cancel' };
    await expect(run.cancel(request)).rejects.toMatchObject({ code: 'storage_unavailable' });
    expect((await runtime.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe('canceled');
    expect((await observer.execute('SELECT confirmed_suspended FROM billing_expiry_recovery')).rows).toEqual([
      { confirmed_suspended: 1n },
    ]);
    await observer.execute('DROP TRIGGER interrupt_local_cancel');
    await runtime.close();
    const reopened = await runtimeFixture({
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: runtime.billingContext.workspaceId,
      configuration: runtime.configuration,
    });
    cleanups.push(reopened.close);
    const records = await RecoveryStorage.open({ url: database.url });
    cleanups.push(() => records.close());
    const worker = new BillingRecovery(records, reopened.provider, async () => {
      await reopened.billing.expireSuspensions();
      await reopened.accounting.recoverFinancial();
    });
    cleanups.push(() => worker.stop());
    await worker.runOnce();
    const replay = await reopened.billing
      .workflow('report')
      .getRun({ billing: reopened.billingContext, executionId: run.executionId });
    for (const key of ['cancel', 'cancel-again']) {
      expect((await replay.cancel({ billing: reopened.billingContext, idempotencyKey: key })).billing).toMatchObject({
        executionStatus: 'canceled',
        settlementStatus: 'released',
        billedUnits: 0,
      });
    }
    await worker.runOnce();
    expect(model.requests).toHaveLength(1);
    expect((await observer.execute('SELECT state FROM local_provider_reservations')).rows).toEqual([
      { state: 'released' },
    ]);
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
  });

  it('foreign active cancellation retains its hold and fences the late owner', async () => {
    const { runtime, model, observer, database } = await fixture({ workflowPrompt: '[abort] wait for release' });
    const other = await runtimeFixture({
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: runtime.billingContext.workspaceId,
      configuration: runtime.configuration,
    });
    cleanups.push(other.close);
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'foreign-active' });
    const pending = run.start({
      billing: runtime.billingContext,
      idempotencyKey: 'active-start',
      inputData: { count: 0 },
    });
    for (let attempt = 0; attempt < 200 && model.requests.length === 0; attempt++)
      await new Promise(resolve => setTimeout(resolve, 5));
    expect(model.requests).toHaveLength(1);
    const foreign = await other.billing
      .workflow('report')
      .getRun({ executionId: run.executionId, billing: other.billingContext });
    const canceled = await foreign.cancel({ billing: other.billingContext, idempotencyKey: 'foreign-cancel' });
    expect(canceled.billing).toMatchObject({
      executionStatus: 'uncertain',
      settlementStatus: 'uncertain',
      billedUnits: null,
    });
    model.release();
    expect(await pending).toMatchObject({
      kind: 'replay',
      result: { status: 'uncertain' },
      billing: { executionStatus: 'uncertain', billedUnits: null },
    });
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
    expect((await observer.execute('SELECT status FROM billing_workflow_runs')).rows).toEqual([
      { status: 'uncertain' },
    ]);
    expect((await runtime.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe('canceled');
  });

  it('cancellation returns uncertain for noncooperative native steps without releasing from timeout or snapshots alone', async () => {
    let gate = operationBarrier();
    const { runtime, observer } = await fixture({
      workflowAfterBoundary: async invoke => {
        await gate.pause();
        await invoke();
      },
    });
    for (let round = 0; round < 20; round++) {
      gate = operationBarrier();
      const run = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: `noncooperative-${round}` });
      await run.start({ billing: runtime.billingContext, idempotencyKey: 'start', inputData: { count: 0 } });
      const pending = run.resume({
        billing: runtime.billingContext,
        idempotencyKey: 'resume',
        step: 'approval',
        resumeData: { approved: true },
      });
      await gate.entered;
      const cancel = run.cancel({ billing: runtime.billingContext, idempotencyKey: 'cancel' });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const outcome = await Promise.race([
          cancel.then(value => ({ finished: true as const, value })),
          new Promise<{ finished: false }>(resolve => {
            timer = setTimeout(() => resolve({ finished: false }), 3000);
          }),
        ]);
        expect(outcome.finished, `round ${round}`).toBe(true);
        if (!outcome.finished) throw new Error('Cancellation did not return within its bound');
        expect(outcome.value.billing).toMatchObject({ executionStatus: 'uncertain', billedUnits: null });
        expect(
          (
            await observer.execute({
              sql: 'SELECT active FROM billing_reservations WHERE execution_id = ?',
              args: [run.executionId],
            })
          ).rows,
        ).toEqual([{ active: 1n }]);
      } finally {
        clearTimeout(timer);
        gate.release();
        await Promise.allSettled([pending, cancel]);
      }
      const recovered = await run.cancel({ billing: runtime.billingContext, idempotencyKey: 'recheck' });
      expect((await runtime.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe('canceled');
      expect(recovered.billing).toMatchObject({ billedUnits: null, settlementStatus: 'uncertain' });
      expect(
        (
          await observer.execute({
            sql: 'SELECT active FROM billing_reservations WHERE execution_id = ?',
            args: [run.executionId],
          })
        ).rows,
      ).toEqual([{ active: 1n }]);
    }
  }, 60000);

  it('local active cancellation propagates abort and releases only after termination', async () => {
    const { runtime, model, observer } = await fixture({ workflowPrompt: '[abort] stop active request' });
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'local-active' });
    const pending = run.start({
      billing: runtime.billingContext,
      idempotencyKey: 'local-start',
      inputData: { count: 0 },
    });
    for (let attempt = 0; attempt < 200 && model.requests.length === 0; attempt++)
      await new Promise(resolve => setTimeout(resolve, 5));
    expect(model.requests).toHaveLength(1);
    const canceled = await run.cancel({ billing: runtime.billingContext, idempotencyKey: 'local-cancel' });
    await pending;
    expect(canceled.billing).toMatchObject({
      executionStatus: 'canceled',
      billedUnits: 0,
      settlementStatus: 'released',
    });
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
  });

  it('expiry preserves an uncertain hold when accounting and runtime snapshots disagree', async () => {
    const { runtime, observer } = await fixture();
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'snapshot-mismatch' });
    const suspended = await run.start({
      billing: runtime.billingContext,
      idempotencyKey: 'mismatch-start',
      inputData: { count: 0 },
    });
    const projection = suspended.kind === 'immediate' ? suspended.projection : suspended.result;
    await (await runtime.workflows.report.native.createRun({ runId: run.executionId })).cancel();
    expect((await runtime.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe('canceled');
    await runtime.billing.expireSuspensions(projection.expiresAt! + 1);
    expect((await observer.execute('SELECT status FROM billing_workflow_runs')).rows).toEqual([
      { status: 'uncertain' },
    ]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
  });

  it('resume checks current paid eligibility before claiming a new operation', async () => {
    const { runtime, model, observer } = await fixture();
    const handle = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'eligibility' });
    await handle.start({
      billing: runtime.billingContext,
      idempotencyKey: 'eligibility-start',
      inputData: { count: 0 },
    });
    await observer.execute("DELETE FROM commercial_meters WHERE key = 'tasks'");
    await observer.execute('UPDATE commercial_state SET version = version + 1');
    await expect(
      handle.resume({
        billing: runtime.billingContext,
        idempotencyKey: 'eligible-resume',
        step: 'approval',
        resumeData: { approved: true },
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(model.requests).toHaveLength(1);
    expect(
      (await observer.execute("SELECT key FROM billing_workflow_operations WHERE operation = 'resume'")).rows,
    ).toEqual([]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
    await observer.execute(
      "INSERT INTO commercial_meters (account_id, key, funding, balance, consumed, period_start, period_end) SELECT id, 'tasks', 'prepaid', 100, 0, NULL, NULL FROM billing_accounts",
    );
    await observer.execute('UPDATE commercial_state SET version = version + 1');
    const resumed = await handle.resume({
      billing: runtime.billingContext,
      idempotencyKey: 'eligible-resume',
      step: 'approval',
      resumeData: { approved: true },
    });
    expect(resumed.billing).toMatchObject({ billedUnits: 2, settlementStatus: 'settled' });
  });

  it('workflow usage stays pending when a segment omits usage or its call checkpoint', async () => {
    for (const incomplete of ['missing-usage', 'missing-checkpoint'] as const) {
      const { runtime, observer, model } = await fixture({
        configure: configuration => {
          configuration.resourcePolicies[1].policy.charge = {
            type: 'usage',
            meter: 'tokens',
            measure: 'tokens',
            maxUnits: 40,
            funding: 'metered',
          };
          return configuration;
        },
        workflowPrompt: incomplete === 'missing-usage' ? '[missing] no tokens' : '[success] one call',
        workflowExpectedCalls: incomplete === 'missing-checkpoint' ? [2, 1] : [1, 1],
      });
      const run = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: incomplete });
      await run.start({ billing: runtime.billingContext, idempotencyKey: 'incomplete-start', inputData: { count: 0 } });
      const completed = await run.resume({
        billing: runtime.billingContext,
        idempotencyKey: 'incomplete-resume',
        step: 'approval',
        resumeData: { approved: true },
      });
      expect(completed.billing).toMatchObject({
        executionStatus: 'uncertain',
        settlementStatus: 'pending',
        billedUnits: null,
      });
      expect((await observer.execute('SELECT status, terminal_at FROM billing_executions')).rows).toEqual([
        { status: 'uncertain', terminal_at: null },
      ]);
      expect((await observer.execute('SELECT status FROM billing_workflow_runs')).rows).toEqual([
        { status: 'uncertain' },
      ]);
      expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
      expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
      expect(model.requests).toHaveLength(2);
    }
  });

  it('workflow model failure releases the task while recovered tool errors can complete', async () => {
    const { runtime, observer, model } = await fixture({ workflowPrompt: '[partial-error] fail nested call' });
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'failed-workflow' });
    const failed = await run.start({
      billing: runtime.billingContext,
      idempotencyKey: 'failed-start',
      inputData: { count: 0 },
    });
    expect(failed.billing).toMatchObject({ executionStatus: 'failed', billedUnits: 0, settlementStatus: 'released' });
    expect(
      (await observer.execute("SELECT SUM(units) AS units FROM billing_measurements WHERE measure = 'tokens'")).rows,
    ).toEqual([{ units: 5n }]);
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
    const recovered = await runtime.billing.agent('assistant').generate('[tool-error] recover from echo', {
      billing: runtime.billingContext,
      idempotencyKey: 'recovered-tool',
    });
    if (recovered.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(recovered.billing).toMatchObject({ executionStatus: 'completed', billedUnits: 10 });
    expect(model.requests.filter(request => request.scenario === 'tool-error')).toHaveLength(2);
  });

  it('persistent setup recovers due suspensions at worker startup without replaying work', async () => {
    const { runtime, database, model, observer } = await fixture({
      configure: configuration => {
        configuration.resourcePolicies[1].policy.suspendedReservationTtlMs = 5;
        return configuration;
      },
    });
    const workflowDatabaseUrl = pathToFileURL(join(database.directory, 'private-workflow.db')).href;
    const options = {
      organizations: runtime.organizations,
      configuration: runtime.configuration,
      agents: runtime.agents,
      workflows: runtime.workflows,
      databaseUrl: database.url,
      workflowDatabaseUrl,
    };
    const components = await initializeMastraBilling(options);
    cleanups.push(components.close);
    new Mastra({
      agents: { assistant: runtime.agents.assistant.native },
      workflows: { report: runtime.workflows.report.native },
      storage: components.storage,
    });
    const handle = await components.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'expiry-startup' });
    await handle.start({ billing: runtime.billingContext, idempotencyKey: 'expiry-start', inputData: { count: 0 } });
    await components.close();
    await new Promise(resolve => setTimeout(resolve, 10));
    const fresh = await runtimeFixture({
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: runtime.billingContext.workspaceId,
      configuration: runtime.configuration,
    });
    cleanups.push(fresh.close);
    const reopened = await initializeMastraBilling({
      ...options,
      organizations: fresh.organizations,
      agents: fresh.agents,
      workflows: fresh.workflows,
    });
    cleanups.push(reopened.close);
    new Mastra({
      agents: { assistant: fresh.agents.assistant.native },
      workflows: { report: fresh.workflows.report.native },
      storage: reopened.storage,
    });
    const expiry = reopened.startRecovery();
    cleanups.push(expiry.stop);
    await expiry.ready;
    const recovered = await reopened.billing
      .workflow('report')
      .getRun({ executionId: handle.executionId, billing: fresh.billingContext });
    const status = await recovered.status(fresh.billingContext);
    expect(status.billing).toMatchObject({ executionStatus: 'canceled', billedUnits: 0, settlementStatus: 'released' });
    expect((await fresh.workflows.report.native.getWorkflowRunById(handle.executionId))?.status).toBe('canceled');
    expect(model.requests).toHaveLength(1);
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
    if (process.platform !== 'win32') expect((await stat(fileURLToPath(workflowDatabaseUrl))).mode & 0o777).toBe(0o600);
    await expect(initializeMastraBilling({ ...options, workflowDatabaseUrl: database.url })).rejects.toMatchObject({
      code: 'invalid_configuration',
    });
  });
  it('invalid resume data cannot consume the operation key or execute a step', async () => {
    const { runtime, observer, model } = await fixture();
    const handle = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'typed-resume' });
    await handle.start({ billing: runtime.billingContext, idempotencyKey: 'typed-start', inputData: { count: 0 } });
    const invalid: unknown = {
      billing: runtime.billingContext,
      idempotencyKey: 'typed-key',
      step: 'approval',
      resumeData: { approved: 'yes' },
    };
    await expect(handle.resume(invalid as Parameters<typeof handle.resume>[0])).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(
      (await observer.execute("SELECT key FROM billing_workflow_operations WHERE operation = 'resume'")).rows,
    ).toEqual([]);
    expect(model.requests).toHaveLength(1);
    const valid = await handle.resume({
      billing: runtime.billingContext,
      idempotencyKey: 'typed-key',
      step: 'approval',
      resumeData: { approved: true },
    });
    expect(valid.billing).toMatchObject({ billedUnits: 2 });
  });
  it('workflow schemas transform capture once and replay preserves the validated projection', async () => {
    const { runtime, model } = await fixture({ workflowTransforms: true });
    const handle = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'transformed' });
    await handle.start({ billing: runtime.billingContext, idempotencyKey: 'transform-start', inputData: { count: 0 } });
    const result = await handle.resume({
      billing: runtime.billingContext,
      idempotencyKey: 'transform-resume',
      step: 'approval',
      resumeData: { approved: true },
    });
    expect(result.kind).toBe('immediate');
    if (result.kind !== 'immediate' || result.result.status !== 'success')
      throw new Error('Expected actual successful SDK result');
    expect(result.result.result).toEqual({ count: 3 });
    expect(result.projection.output).toEqual({ count: 13 });
    expect(await handle.status(runtime.billingContext)).toMatchObject({
      kind: 'replay',
      result: { output: { count: 13 } },
    });
    expect(await handle.status(runtime.billingContext)).toMatchObject({
      kind: 'replay',
      result: { output: { count: 13 } },
    });
    expect(model.requests).toHaveLength(2);
  });
  it('prepaid call bounds disable processor retries and reject uncertified model selection', async () => {
    const { runtime, observer, model } = await fixture({
      processorRetry: true,
      agentMaxSteps: 1,
      configure: configuration => {
        configuration.resourcePolicies[0].policy.charge = {
          type: 'usage',
          meter: 'calls',
          measure: 'model-calls',
          maxUnits: 1,
          funding: 'prepaid',
        };
        return configuration;
      },
    });
    const response = await runtime.billing.agent('assistant').generate('[processor-retry] recover once', {
      billing: runtime.billingContext,
      idempotencyKey: 'processor-bound',
    });
    if (response.kind === 'nested') throw new Error('Unexpected nested execution');
    expect(model.requests).toHaveLength(1);
    expect(response.billing).toMatchObject({ executionStatus: 'failed', billedUnits: 0, settlementStatus: 'released' });
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
    const selected = { id: 'billing-test/model' as const, url: model.url, apiKey: 'controlled', api: 'chat' as const };
    const common = { id: 'assistant', name: 'Uncertified assistant', instructions: 'Return ok.' };
    const variants = [
      new Agent({ ...common, model: selected, maxRetries: 2 }),
      new Agent({
        ...common,
        model: [
          { id: 'primary', model: selected },
          { id: 'fallback', model: selected },
        ],
      }),
      new Agent({ ...common, model: () => selected }),
    ];
    for (const variant of variants)
      expect(
        () =>
          new MastraBilling({
            organizations: runtime.organizations,
            accounting: runtime.accounting,
            workflowStorage: runtime.workflowStorage,
            provider: runtime.provider,
            configuration: runtime.configuration,
            agents: {
              assistant: agentResource(variant, { version: 'uncertified-v1', maxSteps: 1, maxOutputTokens: 20 }),
            },
            workflows: runtime.workflows,
          }),
      ).toThrowError(expect.objectContaining({ code: 'invalid_configuration' }));
    expect(model.requests).toHaveLength(1);
  });
  it('workflow snapshot files stay private through legacy sidecars and SQLite reopen', async () => {
    const { runtime, model, database } = await fixture();
    const directory = await mkdtemp('/tmp/mastra-private-snapshots-');
    cleanups.push(() => rm(directory, { recursive: true, force: true }));
    await chmod(directory, 0o755);
    const filename = join(directory, 'workflow.db');
    const url = pathToFileURL(filename).href;
    const sentinel = `private-snapshot-${directory}`;
    const options = {
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: runtime.billingContext.workspaceId,
      workflowDatabaseUrl: url,
      sentinel,
    };
    const written = await worker('write', options, '', 'privacy-worker.mjs');
    expect(written.sentinelInWal).toBe(true);
    expect(written.initial).toEqual([0o600, 0o600, 0o600]);
    expect(written.legacy).toEqual([0o644, 0o644, 0o644]);
    expect(written.restricted).toEqual([0o600, 0o600, 0o600]);
    expect(written.output).toEqual({ private: sentinel });
    const sql = await independentClient(url);
    try {
      expect((await sql.execute('PRAGMA wal_checkpoint(TRUNCATE)')).rows[0].busy).toBe(0n);
      expect((await sql.execute('PRAGMA journal_mode = DELETE')).rows[0].journal_mode).toBe('delete');
    } finally {
      sql.close();
    }
    await expect(stat(`${filename}-wal`)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(`${filename}-shm`)).rejects.toMatchObject({ code: 'ENOENT' });
    const recreated = await worker('read', options, written.executionId, 'privacy-worker.mjs');
    expect(recreated.output).toEqual({ private: sentinel });
    expect(recreated.modes).toEqual([0o600, 0o600, 0o600]);
    expect((await stat(directory)).mode & 0o777).toBe(0o755);
    expect(model.requests).toHaveLength(0);
  });
  it('financial recovery expires an undispatched completed workflow without rerunning its steps', async () => {
    const { runtime, observer, model, database } = await fixture();
    const context = runtime.billingContext;
    const run = await runtime.billing
      .workflow('report')
      .createRun({ billing: context, idempotencyKey: 'dispatch-cutoff' });
    await run.start({ billing: context, idempotencyKey: 'start', inputData: { count: 0 } });
    await observer.execute(
      "CREATE TRIGGER fail_workflow_dispatch BEFORE UPDATE OF terminal_dispatched ON billing_remote_operations WHEN OLD.terminal_dispatched = 0 AND NEW.terminal_dispatched = 1 BEGIN SELECT RAISE(ABORT, 'Injected dispatch claim failure'); END",
    );
    const approval = {
      billing: context,
      idempotencyKey: 'approve',
      step: 'approval',
      resumeData: { approved: true },
    } as const;
    await expect(run.resume(approval)).rejects.toMatchObject({ code: 'storage_unavailable' });
    expect((await run.status(context)).billing).toMatchObject({
      executionStatus: 'completed',
      settlementStatus: 'pending',
      billedUnits: null,
    });
    const saved = (
      await observer.execute({ sql: 'SELECT result FROM billing_workflow_runs WHERE id = ?', args: [run.executionId] })
    ).rows[0].result;
    const request = JSON.parse(
      String((await observer.execute('SELECT request FROM billing_remote_operations')).rows[0].request),
    );
    await observer.execute('DROP TRIGGER fail_workflow_dispatch');
    const options = {
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: context.workspaceId,
    };
    await runtime.close();
    const restored = await runtimeFixture(options);
    cleanups.push(restored.close);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(request.confirmationCutoff + 1);
    try {
      await restored.accounting.recoverFinancial();
      const owned = await restored.billing
        .workflow('report')
        .getRun({ executionId: run.executionId, billing: restored.billingContext });
      const receipt = await owned.status(restored.billingContext);
      expect(receipt).toMatchObject({
        result: { status: 'failed', output: { count: 2 } },
        billing: { executionStatus: 'failed', settlementStatus: 'released', billedUnits: 0 },
      });
      const replay = await owned.resume({ ...approval, billing: restored.billingContext });
      expect(replay).toMatchObject({ kind: 'replay', result: { status: 'failed' }, billing: { billedUnits: 0 } });
      expect(
        (
          await observer.execute({
            sql: 'SELECT result FROM billing_workflow_runs WHERE id = ?',
            args: [run.executionId],
          })
        ).rows[0].result,
      ).toBe(saved);
      expect((await observer.execute('SELECT units, outcome FROM billing_ledger')).rows).toEqual([
        { units: 0n, outcome: 'failed' },
      ]);
      expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
      const effect = (await observer.execute('SELECT terminal_payload FROM local_provider_reservations')).rows[0];
      expect(JSON.parse(String(effect.terminal_payload))).toMatchObject({ action: 'release', units: 0 });
      expect(model.requests).toHaveLength(2);
    } finally {
      clock.mockRestore();
    }
  });
});

// Real catalog extension: SQL/Mastra/Hono run normally; only the paid model wire is controlled.
async function catalogFixture() {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const model = await modelBoundary();
  cleanups.push(model.close);
  const environment = {
    BILLING_DATABASE_URL: database.url,
    BILLING_PROJECT_ROOT: database.directory,
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
    BILLING_STUDIO_ENABLED: 'true',
  };
  const organizations = await configuredOrganizations(environment);
  const first = await organizations.provisionLocal({ profileId: 'first', displayName: 'First' });
  const second = await organizations.provisionLocal({ profileId: 'second', displayName: 'Second' });
  const firstContext = await organizations.context({ credential: first.credential! });
  const secondContext = await organizations.context({ credential: second.credential! });
  const workspaceIds = [firstContext.workspaceId, secondContext.workspaceId];
  organizations.close();
  const created: string[] = [];
  const closed: string[] = [];
  const inputSchema = z.strictObject({ prompt: z.string().min(1) });
  const outputSchema = z.strictObject({ answer: z.string() });
  const agent = (id: string) => {
    created.push(id);
    return new Agent({
      id,
      name: id,
      instructions: 'Return the controlled structured answer.',
      maxRetries: 0,
      model: { id: 'billing-test/model', url: model.url, apiKey: 'controlled', api: 'chat' },
    });
  };
  const actionExecutions: string[] = [];
  const transformedCount = resourceAction({
    id: 'billing-catalog-count',
    description: 'Read a normalized numeric count.',
    inputSchema: z.strictObject({ count: z.string().min(1).transform(Number) }),
    execute: async input => {
      actionExecutions.push('count');
      return { count: input.count };
    },
  });
  const transformedLabel = resourceAction({
    id: 'billing-catalog-label',
    description: 'Append one label marker.',
    inputSchema: z.strictObject({
      label: z
        .string()
        .min(1)
        .transform(label => `${label}!`),
    }),
    execute: async input => {
      actionExecutions.push('label');
      return { label: input.label };
    },
  });
  const actions = [
    resourceAction({
      id: 'billing-catalog-answer',
      description: 'Generate a billed catalog answer.',
      inputSchema: z.strictObject({ workspaceId: z.string(), idempotencyKey: z.string(), prompt: z.string() }),
      execute: async (input, { execution, selected }) =>
        execution.generate('catalog-answer', input.prompt, await selected(input.workspaceId), input.idempotencyKey),
    }),
    transformedCount,
    transformedLabel,
  ];
  const createReport = (dependencies: ResourceDependencies) => {
    created.push('catalog-report');
    const child = dependencies.nestedAgent('catalog-answer');
    const prepare = createStep({
      id: 'prepare',
      inputSchema,
      outputSchema: inputSchema,
      resumeSchema: z.strictObject({ approved: z.literal(true) }),
      suspendSchema: inputSchema,
      execute: async ({ inputData, resumeData, suspend }) => (resumeData ? inputData : suspend(inputData)),
    });
    const answer = createStep({
      id: 'answer',
      inputSchema,
      outputSchema,
      execute: async ({ inputData }) => ({
        answer: (await child.generate(inputData.prompt)).text,
      }),
    });
    return createWorkflow({
      id: 'catalog-report',
      inputSchema,
      outputSchema,
      steps: [prepare, answer],
      options: { autoRestartActiveRuns: false },
    })
      .then(prepare)
      .then(answer)
      .commit();
  };
  const resources = [
    {
      id: 'catalog-answer',
      kind: 'agent',
      create: () => agent('catalog-answer'),
      adapter: {
        version: 'answer-v1',
        maxSteps: 1,
        outputSchema,
        promptSchema: z.string().transform(prompt => prompt.replace('[normalize]', '[structured]')),
      },
      dispose: () => {
        closed.push('catalog-answer');
      },
      operations: ['generate'],
      measurements: [],
      policy: { version: 'answer-price-v1', charge: { type: 'credits', meter: 'credits', units: 2 } },
      actions,
    },
    {
      id: 'catalog-extra',
      kind: 'agent',
      create: () => agent('catalog-extra'),
      adapter: { version: 'extra-v1', maxSteps: 1 },
      dispose: () => {
        closed.push('catalog-extra');
      },
      operations: ['generate'],
      measurements: [],
      policy: { version: 'extra-price-v1', charge: { type: 'credits', meter: 'credits', units: 5 } },
    },
    {
      id: 'catalog-report',
      kind: 'workflow',
      create: createReport,
      adapter: { version: 'report-v1', measurement: 'facade-calls', expectedCalls: [0, 1] },
      agentDependencies: ['catalog-answer'],
      dispose: () => {
        closed.push('catalog-report');
      },
      operations: ['start', 'resume', 'cancel'],
      measurements: [
        { key: 'tokens', unit: 'tokens', enforceableBound: false },
        { key: 'input-tokens', unit: 'tokens', enforceableBound: false },
        { key: 'output-tokens', unit: 'tokens', enforceableBound: false },
        { key: 'model-calls', unit: 'custom', enforceableBound: true },
      ],
      policy: {
        version: 'report-price-v1',
        suspendedReservationTtlMs: 1800000,
        charge: { type: 'credits', meter: 'credits', units: 7 },
      },
    },
  ] as const satisfies readonly ResourceDefinition[];
  const { resourcePolicies: _, ...configuration } = billingConfigurationSchema.parse({
    provider: 'local',
    resourcePolicies: [],
    billingKeys: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
    localAccounts: workspaceIds.map(workspaceId => ({
      workspaceId,
      meters: [{ key: 'credits', funding: 'prepaid', balance: 100 }],
    })),
  });
  const catalog = { definitions: resources, configuration } satisfies ResourceCatalog<typeof resources>;
  return {
    database,
    model,
    environment,
    first,
    second,
    workspaceIds,
    catalog,
    created,
    closed,
    actionExecutions,
    transformedCount,
    transformedLabel,
  };
}

it('catalog extensions execute distinct resources with configured billing policies', async () => {
  const f = await catalogFixture();
  let application = await createBillingApplication({ environment: f.environment, catalog: f.catalog });
  cleanups.push(() => application.close());
  expect(f.created).toEqual(['catalog-answer', 'catalog-extra', 'catalog-report']);
  const billing = await application.organizations.context({ credential: f.first.credential! });
  const other = await application.organizations.context({ credential: f.second.credential! });
  const first = await application.runtime.billing
    .agent('catalog-answer')
    .generate('[structured]', { billing, idempotencyKey: 'catalog-one' });
  if (first.kind !== 'immediate') throw new Error('Expected immediate generation');
  const answer: string | undefined = first.projection.object?.answer;
  expect(answer).toBe('ok');
  expect(first.billing).toMatchObject({ billedUnits: 2, replayed: false });
  const extra = await application.runtime.billing
    .agent('catalog-extra')
    .generate('[success]', { billing, idempotencyKey: 'catalog-extra' });
  expect(extra).toMatchObject({ result: { text: 'ok' }, billing: { billedUnits: 5 } });
  if (extra.kind === 'immediate') {
    const unstructured: undefined = extra.projection.object;
    expect(unstructured).toBeUndefined();
  }
  const replay = await application.runtime.billing
    .agent('catalog-answer')
    .generate('[structured]', { billing, idempotencyKey: 'catalog-one' });
  expect(replay).toMatchObject({
    kind: 'replay',
    result: { object: { answer: 'ok' } },
    billing: { billedUnits: 2, replayed: true },
  });
  const runs = await Promise.all(
    [billing, other].map((context, index) =>
      application.runtime.billing
        .workflow('catalog-report')
        .createRun({ billing: context, idempotencyKey: `report-${index}` }),
    ),
  );
  const started = await Promise.all(
    runs.map((run, index) =>
      run.start({
        billing: index ? other : billing,
        idempotencyKey: 'start',
        inputData: { prompt: `[normalize] parent-${index}` },
      }),
    ),
  );
  expect(started.map(result => result.result.status)).toEqual(['suspended', 'suspended']);
  expect(f.model.requests).toHaveLength(2);
  const completed = await Promise.all(
    runs.map((run, index) =>
      run.resume({
        billing: index ? other : billing,
        idempotencyKey: 'approve',
        step: 'prepare',
        resumeData: { approved: true },
      }),
    ),
  );
  for (const result of completed) {
    expect(result).toMatchObject({
      result: { status: 'success', result: { answer: '{"answer":"ok"}' } },
      billing: { billedUnits: 7, executionStatus: 'completed' },
    });
    if (result.kind === 'immediate') {
      const typed: string | undefined = result.projection.output?.answer;
      expect(typed).toBe('{"answer":"ok"}');
    }
  }
  await expect(runs[0].status(other)).rejects.toMatchObject({ code: 'forbidden' });
  const observer = await independentClient(f.database.url);
  cleanups.push(() => observer.close());
  expect(
    (
      await observer.execute(
        'SELECT resource_id, COUNT(*) AS count FROM billing_executions GROUP BY resource_id ORDER BY resource_id',
      )
    ).rows,
  ).toEqual([
    { resource_id: 'catalog-answer', count: 1n },
    { resource_id: 'catalog-extra', count: 1n },
    { resource_id: 'catalog-report', count: 2n },
  ]);
  expect(
    (
      await observer.execute(
        'SELECT workspace_id, SUM(billed_units) AS billed FROM billing_executions GROUP BY workspace_id ORDER BY billed',
      )
    ).rows,
  ).toEqual([
    { workspace_id: other.workspaceId, billed: 7n },
    { workspace_id: billing.workspaceId, billed: 14n },
  ]);
  expect(
    (
      await observer.execute(
        "SELECT execution_id, COUNT(*) AS count FROM billing_measurements WHERE execution_id IN (SELECT id FROM billing_executions WHERE resource_id = 'catalog-report') GROUP BY execution_id ORDER BY execution_id",
      )
    ).rows,
  ).toEqual(
    runs
      .map(run => ({ execution_id: run.executionId, count: 4n }))
      .sort((left, right) => left.execution_id.localeCompare(right.execution_id)),
  );
  const nestedRequests = f.model.requests.slice(2).map(request => JSON.stringify(request.body));
  expect(nestedRequests.some(body => body.includes('[structured] parent-0'))).toBe(true);
  expect(nestedRequests.some(body => body.includes('[structured] parent-1'))).toBe(true);
  expect(nestedRequests.join('')).not.toContain('[normalize]');
  expect(f.model.requests).toHaveLength(4);
  // Mount the production middleware and real SDK tool route over a socket.
  const app = new Hono();
  const configured = application.mastra.getServer()!.middleware!;
  const middleware = Array.isArray(configured) ? configured[0] : configured;
  if (typeof middleware !== 'object' || typeof middleware.handler !== 'function')
    throw new Error('Missing billing boundary');
  app.use('*', middleware.handler);
  app.post('/api/tools/:toolId/execute', async context => {
    const body = await context.req.json();
    return context.json(
      await EXECUTE_TOOL_ROUTE.handler({
        mastra: application.mastra,
        toolId: context.req.param('toolId'),
        data: body.data,
        abortSignal: context.req.raw.signal,
        requestContext: Object.assign(new RequestContext(), {} as Record<string, unknown>),
      }),
    );
  });
  const server = await billingSocket(app);
  cleanups.push(server.close);
  const toolInput = { workspaceId: billing.workspaceId, idempotencyKey: 'studio-catalog', prompt: '[structured]' };
  const call = (path: string, credential?: string) =>
    fetch(server.url + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(credential ? { authorization: `Bearer ${credential}` } : {}) },
      body: JSON.stringify({ data: toolInput, requestContext: { credential: f.first.credential! } }),
    });
  expect((await call('/api/tools/billing-catalog-answer/execute')).status).toBe(401);
  const denied = await call('/api/tools/billing-catalog-answer/execute', f.second.credential!);
  expect(await denied.json()).toMatchObject({ error: { code: 'forbidden' } });
  const tool = await call('/api/tools/billing-catalog-answer/execute', f.first.credential!);
  expect(tool.status).toBe(200);
  expect(await tool.json()).toMatchObject({ result: { object: { answer: 'ok' } }, billing: { billedUnits: 2 } });
  expect((await call('/api/agents/catalog-answer/generate', f.first.credential!)).status).toBe(403);
  expect(f.model.requests).toHaveLength(5);
  // F10-REVIEW-001: execute the actual derived Studio SDK tools, whose input validation applies transforms.
  const actionContext = {
    execution: application.execution,
    selected: (workspaceId: string) =>
      application.organizations.context({ credential: f.first.credential!, workspaceId }),
  };
  expect(await f.transformedCount.execute({ count: '2' }, actionContext)).toEqual({ count: 2 });
  expect(await f.transformedLabel.execute({ label: 'tag' }, actionContext)).toEqual({ label: 'tag!' });
  const countTool = application.mastra.getTool('billing-catalog-count');
  const labelTool = application.mastra.getTool('billing-catalog-label');
  if (!countTool.execute || !labelTool.execute) throw new Error('Missing derived Studio action executors');
  expect.soft(await countTool.execute({ count: '2' }, {})).toEqual({ count: 2 });
  expect.soft(await labelTool.execute({ label: 'tag' }, {})).toEqual({ label: 'tag!' });
  const validExecutions = [...f.actionExecutions];
  await expect(async () => f.transformedCount.execute({ count: null }, actionContext)).rejects.toBeInstanceOf(
    z.ZodError,
  );
  await expect(async () => f.transformedLabel.execute({ label: null }, actionContext)).rejects.toBeInstanceOf(
    z.ZodError,
  );
  expect(await countTool.execute({ count: null }, {})).toMatchObject({ error: true });
  expect(await labelTool.execute({ label: null }, {})).toMatchObject({ error: true });
  expect(f.actionExecutions).toEqual(validExecutions);
  expect(f.model.requests).toHaveLength(5);
  if (false) {
    // Compile-time contract: literal IDs, structured outputs and workflow payloads remain precise.
    // @ts-expect-error Unknown resource ID cannot enter the facade.
    application.runtime.billing.agent('missing');
    // @ts-expect-error Workflows cannot be selected as agents.
    application.runtime.billing.agent('catalog-report');
    // @ts-expect-error Structured answer is a string.
    const invalid: number = first.projection.object!.answer;
    void invalid;
    // @ts-expect-error Input must match the workflow schema.
    await runs[0].start({ billing, idempotencyKey: 'bad', inputData: { prompt: 42 } });
    // @ts-expect-error Approval must be true.
    await runs[0].resume({ billing, idempotencyKey: 'bad', step: 'prepare', resumeData: { approved: false } });
  }
  const operations = (await observer.execute('SELECT * FROM billing_remote_operations ORDER BY execution_id')).rows;
  await server.close();
  const closeOne = application.close();
  const closeTwo = application.close();
  expect(closeOne).toBe(closeTwo);
  await Promise.all([closeOne, closeTwo]);
  expect(f.closed).toEqual(['catalog-report', 'catalog-extra', 'catalog-answer']);
  application = await createBillingApplication({ environment: f.environment, catalog: f.catalog });
  expect((await observer.execute('SELECT * FROM billing_remote_operations ORDER BY execution_id')).rows).toEqual(
    operations,
  );
  const fresh = await application.organizations.context({ credential: f.first.credential! });
  expect(
    await application.runtime.billing
      .agent('catalog-answer')
      .generate('[structured]', { billing: fresh, idempotencyKey: 'catalog-one' }),
  ).toMatchObject({ kind: 'replay', billing: { billedUnits: 2, replayed: true } });
  expect(f.model.requests).toHaveLength(5);
}, 60_000);

it('invalid catalogs and partial startup fail without external work or leaked lifecycle', async () => {
  const f = await catalogFixture();
  f.catalog.configuration.billingKeys.meters.push({ key: 'tasks', unit: 'tasks', funding: ['metered'] });
  const [answer, extra, report] = f.catalog.definitions;
  const invalid: readonly ResourceDefinition[][] = [
    [answer, answer],
    [{ ...answer, policy: null } as unknown as ResourceDefinition],
    [{ ...answer, dispose: 'invalid' } as unknown as ResourceDefinition],
    [{ ...answer, measurements: undefined } as unknown as ResourceDefinition],
    [{ ...answer, actions: [{ ...answer.actions[0], id: 'invalid.action' }] }],
    [{ ...answer, policy: { ...answer.policy, charge: { type: 'credits', meter: 'missing', units: 1 } } }],
    [{ ...answer, operations: ['start'] }],
    [{ ...answer, adapter: { ...answer.adapter, maxSteps: 0 } }],
    [
      {
        ...answer,
        adapter: { ...answer.adapter, artifactSlots: 1 },
        policy: { ...answer.policy, charge: { type: 'none' } },
      },
    ],
    [
      answer,
      {
        ...report,
        adapter: { ...report.adapter, artifactSlots: 1 },
        policy: { ...report.policy, charge: { type: 'none' } },
      },
    ],
    [
      {
        ...answer,
        adapter: { ...answer.adapter, artifactSlots: 1 },
        policy: { ...answer.policy, charge: { type: 'per-task', meter: 'tasks', units: 1, funding: 'metered' } },
      },
    ],
    [
      answer,
      {
        ...report,
        adapter: { ...report.adapter, artifactSlots: 1 },
        policy: { ...report.policy, charge: { type: 'per-task', meter: 'tasks', units: 1, funding: 'metered' } },
      },
    ],
    [{ ...answer, actions: [...answer.actions, ...answer.actions] }],
    [{ ...report, agentDependencies: ['missing'] }],
    [answer, { ...report, agentDependencies: ['catalog-report'] }],
    [
      { ...answer, agentDependencies: ['catalog-extra'] },
      { ...extra, agentDependencies: ['catalog-answer'] },
    ],
    [
      {
        ...answer,
        policy: {
          version: 'bad',
          charge: { type: 'usage', meter: 'credits', measure: 'tokens', maxUnits: 1, funding: 'metered' },
        },
      },
    ],
  ];
  for (const resources of invalid) {
    await expect(
      createBillingApplication({ environment: f.environment, catalog: { ...f.catalog, definitions: resources } }).then(
        application => {
          cleanups.push(() => application.close());
          return application;
        },
      ),
    ).rejects.toMatchObject({ code: 'invalid_configuration' });
    expect(f.created).toEqual([]);
    expect(f.closed).toEqual([]);
    expect(f.model.requests).toEqual([]);
  }
  // Unsupported provider capabilities fail before factories and before opening provider state.
  await expect(
    createBillingApplication({
      environment: { ...f.environment, BILLING_PROVIDER: 'autumn' },
      catalog: {
        ...f.catalog,
        definitions: [
          {
            ...answer,
            policy: {
              version: 'metered',
              charge: { type: 'per-task', meter: 'tasks', units: 1, funding: 'metered' },
            },
          },
        ],
        configuration: {
          ...f.catalog.configuration,
          provider: 'autumn',
          localAccounts: [],
          billingKeys: {
            entitlements: [],
            subscriptions: [],
            meters: [{ key: 'tasks', unit: 'tasks', funding: ['metered'] }],
          },
        },
      },
    }),
  ).rejects.toMatchObject({ code: 'invalid_configuration' });
  expect(f.created).toEqual([]);
  // Factory dependencies may resolve handles, but execution still requires a ready runtime.
  await expect(
    createBillingApplication({
      environment: f.environment,
      catalog: {
        ...f.catalog,
        definitions: [
          answer,
          {
            ...report,
            create: dependencies => {
              dependencies.nestedAgent('catalog-answer').generate('too early');
              return report.create(dependencies);
            },
          },
        ],
      },
    }),
  ).rejects.toMatchObject({ code: 'state_unavailable' });
  expect(f.closed).toEqual(['catalog-answer']);
  f.created.length = 0;
  f.closed.length = 0;
  let application = await createBillingApplication({ environment: f.environment, catalog: f.catalog });
  const billing = await application.organizations.context({ credential: f.first.credential! });
  await application.runtime.billing
    .agent('catalog-extra')
    .generate('[success]', { billing, idempotencyKey: 'preserve' });
  const observer = await independentClient(f.database.url);
  cleanups.push(() => observer.close());
  const before = (await observer.execute('SELECT * FROM billing_remote_operations')).rows;
  expect(before).toHaveLength(1);
  await application.close();
  f.closed.length = 0;
  const startupFailure = new Error('Late catalog factory failure');
  const cleanupFailure = new Error('Controlled disposer failure');
  const badCatalog = {
    ...f.catalog,
    definitions: [
      answer,
      {
        ...extra,
        dispose: () => {
          f.closed.push('catalog-extra');
          throw cleanupFailure;
        },
      },
      {
        ...report,
        create: () => {
          throw startupFailure;
        },
      },
    ],
  } as const;
  await expect(createBillingApplication({ environment: f.environment, catalog: badCatalog })).rejects.toMatchObject({
    cause: startupFailure,
    errors: [startupFailure, expect.any(AggregateError)],
  });
  expect(f.closed).toEqual(['catalog-extra', 'catalog-answer']);
  expect((await observer.execute('SELECT * FROM billing_remote_operations')).rows).toEqual(before);
  // Inject only the construction boundary: all SQL, billing, storage and Mastra objects are real.
  const identityClose = vi.spyOn(OrganizationService.prototype, 'close');
  const providerClose = vi.spyOn(LocalBillingStorage.prototype, 'close');
  const snapshotClose = vi.spyOn(LibSQLStore.prototype, 'close');
  const recoveryStop = vi.spyOn(BillingRecovery.prototype, 'stop');
  const starts = vi.spyOn(BillingRecovery.prototype, 'start');
  try {
    await expect(
      createBillingApplication({
        environment: f.environment,
        catalog: f.catalog,
        createMastra: configuration => {
          const mastra = new Mastra(configuration);
          expect(mastra.getStorage()).toBeInstanceOf(LibSQLStore);
          expect(mastra.getWorkflow('catalog-report').id).toBe('catalog-report');
          throw startupFailure;
        },
      }),
    ).rejects.toBe(startupFailure);
    expect(identityClose).toHaveBeenCalledTimes(1);
    expect(providerClose).toHaveBeenCalledTimes(1);
    expect(snapshotClose).toHaveBeenCalledTimes(1);
    expect(recoveryStop).toHaveBeenCalledTimes(1);
    expect(starts).not.toHaveBeenCalled();
  } finally {
    identityClose.mockRestore();
    providerClose.mockRestore();
    snapshotClose.mockRestore();
    recoveryStop.mockRestore();
    starts.mockRestore();
  }
  expect((await observer.execute('SELECT * FROM billing_remote_operations')).rows).toEqual(before);
  application = await createBillingApplication({ environment: f.environment, catalog: f.catalog });
  const context = await application.organizations.context({ credential: f.first.credential! });
  const suspended = await application.runtime.billing
    .workflow('catalog-report')
    .createRun({ billing: context, idempotencyKey: 'recover-suspension' });
  expect(
    await suspended.start({ billing: context, idempotencyKey: 'start', inputData: { prompt: '[structured] expired' } }),
  ).toMatchObject({ result: { status: 'suspended' }, billing: { settlementStatus: 'reserved' } });
  await application.close();
  await observer.execute({
    sql: 'UPDATE billing_workflow_runs SET expires_at = ? WHERE id = ?',
    args: [Date.now() - 1, suspended.executionId],
  });
  application = await createBillingApplication({ environment: f.environment, catalog: f.catalog });
  cleanups.push(application.close);
  const recoveredContext = await application.organizations.context({ credential: f.first.credential! });
  const recovered = await application.runtime.billing
    .workflow('catalog-report')
    .getRun({ billing: recoveredContext, executionId: suspended.executionId });
  expect(await recovered.status(recoveredContext)).toMatchObject({
    result: { status: 'canceled' },
    billing: { billedUnits: 0, settlementStatus: 'released' },
  });
  expect(
    (
      await observer.execute({
        sql: 'SELECT terminal_state FROM billing_remote_operations WHERE execution_id = ?',
        args: [suspended.executionId],
      })
    ).rows,
  ).toEqual([{ terminal_state: 'released' }]);
  expect(
    (
      await observer.execute({
        sql: 'SELECT * FROM billing_remote_operations WHERE execution_id = ?',
        args: [String(before[0].execution_id)],
      })
    ).rows,
  ).toEqual(before);
  expect(f.model.requests).toHaveLength(1);
  await Promise.all([application.close(), application.close(), application.close()]);
  f.closed.length = 0;
  const failingCloseApplication = await createBillingApplication({
    environment: f.environment,
    catalog: {
      ...f.catalog,
      definitions: [
        answer,
        {
          ...extra,
          dispose: () => {
            f.closed.push('catalog-extra');
            throw cleanupFailure;
          },
        },
        report,
      ],
    },
  });
  const failedClose = failingCloseApplication.close();
  expect(failingCloseApplication.close()).toBe(failedClose);
  await expect(failedClose).rejects.toMatchObject({ errors: [cleanupFailure] });
  await expect(failingCloseApplication.close()).rejects.toMatchObject({ errors: [cleanupFailure] });
  expect(f.closed).toEqual(['catalog-report', 'catalog-extra', 'catalog-answer']);
}, 60_000);

it('shutdown waits for pending preparation and rejects preparation after closure', async () => {
  const f = await catalogFixture();
  for (let round = 0; round < 20; round++) {
    const gate = operationBarrier();
    const billing = createBilling({
      environment: f.environment,
      billingKeys: f.catalog.configuration.billingKeys,
      localAccounts: async () => {
        await gate.pause();
        return f.catalog.configuration.localAccounts;
      },
    });
    const preparing = billing.prepare({ agents: {}, workflows: {} });
    await gate.entered;
    let closed = false;
    const closing = billing.close().then(() => {
      closed = true;
    });
    await new Promise(resolve => setTimeout(resolve, 1));
    const closedBeforePreparation = closed;
    gate.release();
    const prepared = await preparing;
    await closing;
    expect(closedBeforePreparation).toBe(false);
    await expect(prepared.organizations.context({ credential: f.first.credential! })).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
  }
  const billing = createBilling({ environment: f.environment, billingKeys: f.catalog.configuration.billingKeys });
  await billing.close();
  await expect(billing.prepare({ agents: {}, workflows: {} })).rejects.toMatchObject({ code: 'state_unavailable' });
});

it('the socket fixture terminates rejected handlers and broken response bodies', async () => {
  for (const failure of ['handler', 'body'] as const) {
    const server = await billingSocket({
      fetch: async () => {
        if (failure === 'handler') throw new Error('Handler failed');
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('Body failed'));
            },
          }),
        );
      },
    });
    cleanups.push(server.close);
    await expect(fetch(server.url, { signal: AbortSignal.timeout(1000) })).rejects.toThrow('fetch failed');
  }
});

it.each(['before-create', 'before-dispatch'] as const)(
  'Studio recovers an interrupted start %s after reopening without repeating compute',
  async phase => {
    const f = await catalogFixture();
    let executions = 0;
    const open = async () => {
      const billing = createBilling({
        environment: { ...f.environment, BILLING_STUDIO_ENABLED: 'false' },
        billingKeys: f.catalog.configuration.billingKeys,
        localAccounts: async () => f.catalog.configuration.localAccounts,
      });
      const data = z.strictObject({ value: z.string() });
      const step = createStep({
        id: 'compute',
        inputSchema: data,
        outputSchema: data,
        execute: async ({ inputData }) => {
          executions++;
          return inputData;
        },
      });
      const workflow = createWorkflow({
        id: 'report',
        inputSchema: data,
        outputSchema: data,
        options: { autoRestartActiveRuns: false },
      })
        .then(step)
        .commit();
      const integration = await billing.prepare({
        agents: {},
        workflows: {
          report: billing.workflow(workflow, {
            policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
          }),
        },
      });
      cleanups.push(integration.close);
      const runtime = new StudioAgentRuntime(integration);
      const memory = new Memory({
        storage: integration.storage,
        options: { semanticRecall: false, workingMemory: { enabled: false }, generateTitle: false },
      });
      const agent = runtime.decorate(
        new Agent({
          id: 'recovery-chat',
          name: 'Recovery chat',
          instructions: 'Answer.',
          model: { id: 'billing-test/model', api: 'chat', url: f.model.url, apiKey: 'controlled' },
          memory,
        }),
      );
      new Mastra({
        agents: { 'recovery-chat': agent },
        workflows: integration.workflows,
        storage: integration.storage,
        logger: false,
      });
      const context = await integration.organizations.context({ credential: f.first.credential! });
      const owner = await integration.conversations.thread(context, agent.id, 'recovery-thread', true);
      if (!(await memory.getThreadById({ threadId: owner.threadId })))
        await memory.createThread({ threadId: owner.threadId, resourceId: owner.resourceId });
      const conversation = runtime.bind({ billing: context, owner, controller: new AbortController() });
      return {
        integration,
        runtime,
        memory,
        context,
        owner,
        conversation,
        tools: createStudioOperationTools(runtime).workflowTools('report'),
      };
    };
    const input = { value: 'Recover the original request' };
    const first = await open();
    await first.memory.saveMessages({
      messages: [
        {
          id: 'recovery-user',
          role: 'user',
          threadId: first.owner.threadId,
          resourceId: first.owner.resourceId,
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'Start the saved request.' }] },
        },
      ],
    });
    const operation = await first.integration.conversations.claim(first.context, first.owner, {
      messageId: 'recovery-user',
      toolCallId: 'recovery-call',
      resourceId: 'report',
      action: 'start',
      input,
    });
    if (phase === 'before-dispatch') {
      const run = await first.integration.execution.createRun('report', first.context, operation.requestKey);
      await first.integration.conversations.bindExecution(first.context, first.owner, operation.id, run.executionId);
    }
    await first.integration.close();
    const reopened = await open();
    const executeTool = async (
      tool: { execute?: unknown },
      input: unknown,
      context: unknown = {},
    ): Promise<unknown> => {
      if (typeof tool.execute !== 'function') throw new Error('Missing operation tool');
      return tool.execute(input, context);
    };
    const context = { agent: { threadId: reopened.owner.threadId, toolCallId: 'recovery-call' } };
    const invoke = () =>
      reopened.runtime.request.run(reopened.conversation, () =>
        executeTool(reopened.tools['report-start'], input, context),
      );
    await Promise.all(Array.from({ length: 20 }, invoke));
    const queryTool = reopened.tools['report-query'];
    const result = await reopened.runtime.request.run(reopened.conversation, () =>
      executeTool(queryTool, { operationId: operation.id }),
    );
    expect(result).toMatchObject({
      result: { status: 'completed', output: input },
      billing: { billedUnits: 3, settlementStatus: 'settled' },
    });
    expect(executions).toBe(1);
    const observer = await independentClient(f.database.url);
    cleanups.push(() => observer.close());
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
    expect(
      (await observer.execute("SELECT COUNT(*) AS count FROM billing_workflow_operations WHERE operation = 'start'"))
        .rows[0].count,
    ).toBe(1n);
    expect(f.model.requests).toHaveLength(0);
  },
);

async function conversationFixture() {
  const f = await catalogFixture();
  const billing = createBilling({
    environment: { ...f.environment, BILLING_STUDIO_ENABLED: 'false' },
    billingKeys: { meters: [] },
  });
  const integration = await billing.prepare({ agents: {}, workflows: {} });
  cleanups.push(integration.close);
  const runtime = new StudioAgentRuntime(integration);
  const memory = new Memory({
    storage: integration.storage,
    options: { semanticRecall: false, workingMemory: { enabled: false }, generateTitle: false },
  });
  const agent = runtime.decorate(
    new Agent({
      id: 'conversation',
      name: 'Conversation',
      instructions: 'Answer.',
      model: { id: 'billing-test/model', api: 'chat', url: f.model.url, apiKey: 'controlled' },
      memory,
      maxRetries: 0,
    }),
  );
  new Mastra({ agents: { conversation: agent }, storage: integration.storage, logger: false });
  const context = await integration.organizations.context({ credential: f.first.credential! });
  const owner = await integration.conversations.thread(context, agent.id, 'cleanup-thread', true);
  await memory.createThread({ threadId: owner.threadId, resourceId: owner.resourceId });
  const conversation = runtime.bind({ billing: context, owner, controller: new AbortController() });
  const observer = await independentClient(pathToFileURL(join(f.database.directory, 'workflow.db')).href);
  cleanups.push(() => observer.close());
  return { ...f, integration, runtime, memory, agent, context, owner, conversation, observer };
}

it('conversation activity retries stopped-message cleanup after recall or persistence recovers', async () => {
  for (const failure of ['recall', 'save'] as const) {
    const f = await conversationFixture();
    await f.memory.saveMessages({
      messages: [
        {
          id: 'pending-message',
          role: 'assistant',
          threadId: f.owner.threadId,
          resourceId: f.owner.resourceId,
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: { toolCallId: 'pending-call', toolName: 'business', state: 'call', args: {} },
              },
            ],
            metadata: { pendingToolApprovals: { 'pending-call': { runId: 'stopped-run' } } },
          },
        },
      ],
    });
    // Interrupt real SQLite reads/writes instead of replacing Memory or storage.
    if (failure === 'recall') await f.observer.execute('ALTER TABLE mastra_messages RENAME TO unavailable_messages');
    else
      await f.observer.execute(
        "CREATE TRIGGER unavailable_messages BEFORE INSERT ON mastra_messages BEGIN SELECT RAISE(FAIL, 'temporary storage failure'); END",
      );
    f.runtime.request.run(f.conversation, () =>
      f.agent.abortThreadStream({ threadId: f.owner.threadId, resourceId: f.owner.resourceId }),
    );
    await expect(f.runtime.settled(f.owner.threadId)).rejects.toThrow();
    if (failure === 'recall') await f.observer.execute('ALTER TABLE unavailable_messages RENAME TO mastra_messages');
    else await f.observer.execute('DROP TRIGGER unavailable_messages');
    await f.runtime.settled(f.owner.threadId);
    const { messages } = await f.memory.recall({ threadId: f.owner.threadId, resourceId: f.owner.resourceId });
    expect(messages[0].content.metadata?.pendingToolApprovals).toBeUndefined();
    expect(messages[0].content.parts).toMatchObject([
      { toolInvocation: { state: 'output-error', errorText: expect.stringContaining('Conversation stopped') } },
    ]);
  }
});

it('a run-specific Stop cannot stop the newer active run in the same conversation', async () => {
  const f = await conversationFixture();
  await f.integration.conversations.bindRun(f.context, f.owner, 'old-run');
  const stream = await f.runtime.request.run(f.conversation, () =>
    f.agent.streamUntilIdle('[abort] waiting for Stop', {
      runId: 'new-run',
      memory: { thread: f.owner.threadId, resource: f.owner.resourceId },
    }),
  );
  const output = stream.getFullOutput().catch(() => {});
  await f.model.stallStarted;
  const app = new Hono();
  app.use(
    '*',
    studioChatProxy(f.runtime, '/api', async (_context, next) => next()),
  );
  app.all('*', context => context.json({ unexpected: true }));
  const server = await billingSocket(app);
  cleanups.push(server.close);
  const stop = async (path: string, body: object) => {
    const response = await fetch(server.url + path, {
      method: 'POST',
      headers: { authorization: `Bearer ${f.first.credential}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    return response.json();
  };
  try {
    // A conflicting body must not replace the route's run identity.
    expect(await stop('/api/agents/conversation/runs/old-run/abort', { runId: 'new-run' })).toEqual({ aborted: false });
    expect(f.agent.getActiveThreadRunId({ threadId: f.owner.threadId, resourceId: f.owner.resourceId })).toBe(
      'new-run',
    );
    expect(f.conversation.controller.signal.aborted).toBe(false);
    expect(
      await stop('/api/agents/conversation/threads/abort', { threadId: f.owner.threadId, expectedRunId: 'old-run' }),
    ).toEqual({ aborted: false });
    expect(
      await stop('/api/agents/conversation/threads/abort', { threadId: f.owner.threadId, expectedRunId: 'new-run' }),
    ).toEqual({ aborted: true });
  } finally {
    f.model.release();
    await output;
  }
});

it.each(['nestedAgent', 'agent'] as const)('agents only execute declared children through %s', async entrypoint => {
  for (const dependencies of [undefined, [], ['child']]) {
    const f = await catalogFixture();
    let invoke!: () => Promise<unknown>;
    const outcomes: string[] = [];
    const native = (id: string) =>
      new Agent({
        id,
        name: id,
        instructions: 'Use echo once, then answer.',
        maxRetries: 0,
        model: { id: 'billing-test/model', api: 'chat', url: f.model.url, apiKey: 'controlled' },
        ...(id === 'parent'
          ? {
              tools: {
                echo: createTool({
                  id: 'echo',
                  description: 'Call a child.',
                  inputSchema: z.object({ fail: z.boolean() }),
                  execute: async () => {
                    try {
                      await invoke();
                      outcomes.push('allowed');
                      return { code: 'allowed' };
                    } catch (error) {
                      const code = (error as { code: string }).code;
                      outcomes.push(code);
                      return { code };
                    }
                  },
                }),
              },
            }
          : {}),
      });
    const definition = (id: string) => ({
      id,
      kind: 'agent' as const,
      create: () => native(id),
      operations: ['generate'] as const,
      measurements: [],
      adapter: { version: 'v1', maxSteps: id === 'parent' ? 2 : 1 },
      policy: { version: 'v1', charge: { type: 'credits' as const, meter: 'credits', units: 1 } },
    });
    const application = await createBillingApplication({
      environment: f.environment,
      catalog: {
        configuration: f.catalog.configuration,
        definitions: [
          { ...definition('parent'), ...(dependencies === undefined ? {} : { agentDependencies: dependencies }) },
          definition('child'),
        ],
      },
    });
    try {
      const billing = await application.organizations.context({ credential: f.first.credential! });
      invoke =
        entrypoint === 'nestedAgent'
          ? () => application.runtime.billing.nestedAgent('child').generate('[success] child')
          : () =>
              application.runtime.billing
                .agent('child')
                .generate('[success] child', { billing, idempotencyKey: 'nested' });
      const result = await application.runtime.billing
        .agent('parent')
        .generate('[multi] parent', { billing, idempotencyKey: 'parent' });
      if (result.kind === 'nested') throw new Error('Expected a root execution');
      expect(outcomes).toEqual([dependencies?.includes('child') ? 'allowed' : 'unsupported']);
      expect(f.model.requests).toHaveLength(dependencies?.includes('child') ? 3 : 2);
      expect(result.billing).toMatchObject({ billedUnits: 1, settlementStatus: 'settled' });
      const observer = await independentClient(f.database.url);
      try {
        expect((await observer.execute('SELECT resource_id FROM billing_executions')).rows).toEqual([
          { resource_id: 'parent' },
        ]);
      } finally {
        observer.close();
      }
    } finally {
      await application.close();
    }
  }
});

async function subscriptionFixture(response: 'stream' | 'empty' | 'failure' = 'stream') {
  const f = await conversationFixture();
  const sources: ReadableStreamDefaultController<Uint8Array>[] = [];
  const signals: AbortSignal[] = [];
  const app = new Hono();
  app.use(
    '*',
    studioChatProxy(f.runtime, '/api', async (_context, next) => next()),
  );
  app.post('/api/agents/conversation/threads/subscribe', context => {
    signals.push(context.req.raw.signal);
    if (response === 'failure') throw new Error('Subscription failed');
    return new Response(
      response === 'empty'
        ? null
        : new ReadableStream<Uint8Array>({
            start(controller) {
              sources.push(controller);
            },
          }),
    );
  });
  const subscribe = (signal?: AbortSignal) =>
    app.fetch(
      new Request('http://127.0.0.1/api/agents/conversation/threads/subscribe', {
        method: 'POST',
        signal,
        headers: { authorization: `Bearer ${f.first.credential}`, 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: f.owner.threadId }),
      }),
    );
  return { ...f, sources, signals, subscribe };
}

it('Studio subscriptions already aborted before dispatch do not open native streams', async () => {
  const f = await subscriptionFixture();
  for (let round = 0; round < 20; round++) {
    const controller = new AbortController();
    controller.abort();
    await f.subscribe(controller.signal);
    await f.runtime.settled(f.owner.threadId);
    expect(f.sources).toHaveLength(0);
    expect(f.signals).toHaveLength(0);
    expect(f.runtime.subscriptions.has(f.owner.threadId)).toBe(false);
    expect(() => f.agent.abortThreadStream({ threadId: f.owner.threadId, resourceId: f.owner.resourceId })).toThrow(
      expect.objectContaining({ code: 'forbidden' }),
    );
  }
});

it.each(['end', 'cancel', 'abort', 'error', 'empty', 'failure'] as const)(
  'Studio subscription %s releases listeners and stopped conversations',
  async ending => {
    const f = await subscriptionFixture(ending === 'empty' || ending === 'failure' ? ending : 'stream');
    const controller = new AbortController();
    const response = await f.subscribe(controller.signal);
    if (ending === 'failure') await response.text();
    if (ending !== 'empty' && ending !== 'failure') {
      const reader = response.body!.getReader();
      if (ending === 'end') {
        f.sources[0].close();
        expect((await reader.read()).done).toBe(true);
      }
      if (ending === 'cancel') await reader.cancel();
      if (ending === 'abort') {
        controller.abort();
        await f.runtime.settled(f.owner.threadId);
        await reader.cancel();
      }
      if (ending === 'error') {
        f.sources[0].error(new Error('Broken stream'));
        await expect(reader.read()).rejects.toThrow('Broken stream');
      }
    }
    await f.runtime.settled(f.owner.threadId);
    expect(f.runtime.subscriptions.has(f.owner.threadId)).toBe(false);
    expect(getEventListeners(f.signals[0], 'abort')).toHaveLength(0);
    expect(() => f.agent.abortThreadStream({ threadId: f.owner.threadId, resourceId: f.owner.resourceId })).toThrow(
      expect.objectContaining({ code: 'forbidden' }),
    );
  },
);

it('an older subscription cannot stop or remove its replacement', async () => {
  const f = await subscriptionFixture();
  for (let round = 0; round < 20; round++) {
    const first = await f.subscribe();
    const second = await f.subscribe();
    const token = f.runtime.subscriptions.get(f.owner.threadId);
    f.sources.shift()!.close();
    await first.body!.getReader().read();
    expect(f.runtime.subscriptions.get(f.owner.threadId)).toBe(token);
    f.sources.shift()!.close();
    await second.body!.getReader().read();
    expect(f.runtime.subscriptions.has(f.owner.threadId)).toBe(false);
  }
});

it('subscription cleanup finishes after failed transcript finalization recovers', async () => {
  const f = await subscriptionFixture();
  const response = await f.subscribe();
  await f.observer.execute('ALTER TABLE mastra_messages RENAME TO unavailable_messages');
  f.sources[0].close();
  await expect(response.body!.getReader().read()).rejects.toThrow();
  expect(f.runtime.subscriptions.has(f.owner.threadId)).toBe(true);
  await f.observer.execute('ALTER TABLE unavailable_messages RENAME TO mastra_messages');
  await f.runtime.settled(f.owner.threadId);
  expect(f.runtime.subscriptions.has(f.owner.threadId)).toBe(false);
  expect(() => f.agent.abortThreadStream({ threadId: f.owner.threadId, resourceId: f.owner.resourceId })).toThrow(
    expect.objectContaining({ code: 'forbidden' }),
  );
});

it('a completed subscription preserves a replacement conversation controller', async () => {
  const f = await subscriptionFixture();
  const response = await f.subscribe();
  const replacement = f.runtime.bind({ billing: f.context, owner: f.owner, controller: new AbortController() }, true);
  f.sources[0].close();
  expect((await response.body!.getReader().read()).done).toBe(true);
  expect(replacement.controller.signal.aborted).toBe(false);
  expect(f.runtime.subscriptions.has(f.owner.threadId)).toBe(false);
  // A retained replacement still resolves through the decorated public API.
  f.agent.abortThreadStream({ threadId: f.owner.threadId, resourceId: f.owner.resourceId });
  expect(replacement.controller.signal.aborted).toBe(true);
  await f.runtime.settled(f.owner.threadId);
});

it.each([false, true])(
  'completion capture and replay share the projection contract (output schema: %s)',
  async structured => {
    const f = await catalogFixture();
    const definition = f.catalog.definitions[1];
    const application = await createBillingApplication({
      environment: f.environment,
      catalog: {
        configuration: f.catalog.configuration,
        definitions: [
          {
            ...definition,
            adapter: {
              ...definition.adapter,
              ...(structured ? { outputSchema: z.object({ asset: z.string() }) } : {}),
              completion: async () => ({ text: 'done', finishReason: 'stop', object: { asset: 'a' } }),
            },
          },
        ],
      },
    });
    cleanups.push(application.close);
    const billing = await application.organizations.context({ credential: f.first.credential! });
    const first = await application.runtime.billing
      .agent('catalog-extra')
      .generate('[success]', { billing, idempotencyKey: 'projection' });
    if (first.kind === 'nested') throw new Error('Expected root execution');
    expect(first.billing).toMatchObject({
      executionStatus: structured ? 'completed' : 'failed',
      billedUnits: structured ? 5 : 0,
    });
    const replay = await application.runtime.billing
      .agent('catalog-extra')
      .generate('[success]', { billing, idempotencyKey: 'projection' });
    expect(replay).toMatchObject({
      kind: 'replay',
      result: structured ? { text: 'done', object: { asset: 'a' } } : null,
      billing: { replayed: true, billedUnits: structured ? 5 : 0 },
    });
    expect(f.model.requests).toHaveLength(1);
  },
);

it.each([undefined, 'https://unused.example/snapshots'])(
  'supplied snapshot storage skips unused local paths (%s)',
  async workflowDatabaseUrl => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const databaseUrl = pathToFileURL(join(database.directory, 'workflow.db')).href;
    const organizations = await configuredOrganizations({
      BILLING_MODE: 'local',
      BILLING_PROVIDER: 'local',
      BILLING_DATABASE_URL: databaseUrl,
    });
    cleanups.push(() => organizations.close());
    const storage = new LibSQLStore({
      id: 'application-owned',
      url: pathToFileURL(join(database.directory, 'owned.db')).href,
    });
    cleanups.push(() => storage.close());
    const runtime = await initializeMastraBilling({
      organizations,
      configuration: { provider: 'local', resourcePolicies: [], billingKeys: { meters: [] } },
      agents: {},
      workflows: {},
      databaseUrl,
      workflowDatabaseUrl,
      storage,
    });
    await runtime.close();
    const memory = new Memory({ storage, options: { semanticRecall: false, workingMemory: { enabled: false } } });
    await memory.createThread({ threadId: 'still-owned', resourceId: 'application' });
    expect(await memory.getThreadById({ threadId: 'still-owned' })).toMatchObject({
      id: 'still-owned',
      resourceId: 'application',
    });
  },
);

it('dispatch that monopolizes a turn past its cutoff expires before returning a result', async () => {
  const { runtime } = await fixture();
  const identity = await runtime.organizations.accountingIdentity(runtime.billingContext);
  for (let round = 0; round < 20; round++) {
    let cancellations = 0;
    const collector = new MeasurementCollector(
      'deadline-check',
      1,
      identity,
      runtime.configuration.resourcePolicies[0],
      runtime.accounting,
      runtime.workflowStorage,
      false,
      async () => {
        cancellations++;
      },
    );
    const deadline = Date.now() + 2;
    const result = await collector.runWithinDeadline(deadline, async () => {
      while (Date.now() <= deadline + 2) {
        /* Keep the timer from running in this turn. */
      }
      return 'late';
    });
    expect(result).toEqual({ status: 'expired_during_execution' });
    expect(collector.deadlineExpired).toBe(true);
    expect(collector.controller.signal.aborted).toBe(true);
    expect(cancellations).toBe(1);
  }
});

it('saved conversation history stays request-local and preserves an active subscription', async () => {
  const f = await conversationFixture();
  f.runtime.request.run(f.conversation, () =>
    f.agent.abortThreadStream({ threadId: f.owner.threadId, resourceId: f.owner.resourceId }),
  );
  await f.runtime.settled(f.owner.threadId);
  const app = new Hono();
  app.use(
    '*',
    studioChatProxy(f.runtime, '/api', async (_context, next) => next()),
  );
  app.get('/api/memory/threads/:threadId/messages', context =>
    context.json({ messages: [], threadId: context.req.param('threadId') }),
  );
  for (let round = 0; round < 20; round++) {
    const owner = await f.integration.conversations.thread(f.context, f.agent.id, `saved-history-${round}`, true);
    const response = await app.request(`/api/memory/threads/${owner.threadId}/messages?agentId=${f.agent.id}`, {
      headers: { authorization: `Bearer ${f.first.credential}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ threadId: owner.threadId });
    expect(() => f.agent.abortThreadStream({ threadId: owner.threadId, resourceId: owner.resourceId })).toThrow(
      expect.objectContaining({ code: 'forbidden' }),
    );
  }
  const active = f.runtime.bind({ billing: f.context, owner: f.owner, controller: new AbortController() });
  f.runtime.subscriptions.set(f.owner.threadId, Symbol());
  await app.request(`/api/memory/threads/${f.owner.threadId}/messages?agentId=${f.agent.id}`, {
    headers: { authorization: `Bearer ${f.first.credential}` },
  });
  f.agent.abortThreadStream({ threadId: f.owner.threadId, resourceId: f.owner.resourceId });
  expect(active.controller.signal.aborted).toBe(true);
  f.runtime.subscriptions.delete(f.owner.threadId);
  await f.runtime.settled(f.owner.threadId);
});

it.each([false, true])(
  'failed settlement releases full model outputs (later replay: %s)',
  async replay => {
    const { runtime, model, database } = await fixture();
    const options = {
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: runtime.credential,
      workspaceId: runtime.billingContext.workspaceId,
      configuration: runtime.configuration,
    };
    await runtime.close();
    const child = fork(
      fileURLToPath(new URL('../support/output-cache-worker.mjs', import.meta.url)),
      [JSON.stringify(options), String(replay)],
      { execArgv: ['--expose-gc'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
    );
    const exited = once(child, 'exit');
    cleanups.push(async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exited;
    });
    const [message] = await once(child, 'message');
    expect(message).toMatchObject({ type: 'result', code: 'storage_unavailable', observed: true, retained: false });
    const [code] = await exited;
    expect(code).toBe(0);
    expect(model.requests).toHaveLength(1);
  },
  30000,
);

it.each(['invalid', 'missing', 'transform'] as const)(
  'completion objects use outputSchema exactly once: %s',
  async scenario => {
    const f = await catalogFixture();
    const definition = f.catalog.definitions[1];
    const application = await createBillingApplication({
      environment: f.environment,
      catalog: {
        configuration: f.catalog.configuration,
        definitions: [
          {
            ...definition,
            adapter: {
              ...definition.adapter,
              outputSchema: z.object({
                count: z
                  .number()
                  .min(1)
                  .transform(value => value + 1),
              }),
              completion: async () => ({
                text: 'done',
                finishReason: 'stop',
                ...(scenario === 'missing' ? {} : { object: { count: scenario === 'invalid' ? 0 : 1 } }),
              }),
            },
          },
        ],
      },
    });
    cleanups.push(application.close);
    const billing = await application.organizations.context({ credential: f.first.credential! });
    const first = await application.runtime.billing
      .agent('catalog-extra')
      .generate('[success]', { billing, idempotencyKey: 'validated-completion' });
    if (first.kind === 'nested') throw new Error('Expected root execution');
    expect(first.billing).toMatchObject({
      executionStatus: scenario === 'transform' ? 'completed' : 'failed',
      billedUnits: scenario === 'transform' ? 5 : 0,
    });
    if (scenario === 'transform' && first.kind === 'immediate') {
      expect(first.result.object).toEqual({ count: 2 });
      expect(first.projection.object).toEqual({ count: 2 });
    }
    const replay = await application.runtime.billing
      .agent('catalog-extra')
      .generate('[success]', { billing, idempotencyKey: 'validated-completion' });
    expect(replay).toMatchObject({
      kind: 'replay',
      result: scenario === 'transform' ? { object: { count: 2 } } : null,
      billing: { replayed: true, billedUnits: scenario === 'transform' ? 5 : 0 },
    });
    expect(f.model.requests).toHaveLength(1);
  },
);

it.each(['nestedAgent', 'agent'] as const)(
  'transitive dependencies follow the executing agent across facades via %s',
  async entrypoint => {
    const f = await catalogFixture();
    const outcomes: string[] = [];
    let invoke!: (owner: string, target: string) => Promise<unknown>;
    const dependencies: Record<string, string[]> = { A: ['B', 'D'], B: ['C'], C: [], D: [] };
    const definitions = Object.keys(dependencies).map(id => ({
      id,
      kind: 'agent' as const,
      agentDependencies: dependencies[id],
      operations: ['generate'] as const,
      measurements: [],
      policy: { version: 'v1', charge: { type: 'credits' as const, meter: 'credits', units: 1 } },
      adapter: { version: 'v1', maxSteps: 2 },
      create: () =>
        new Agent({
          id,
          name: id,
          instructions: 'Use echo once, then answer.',
          maxRetries: 0,
          model: { id: 'billing-test/model', api: 'chat', url: f.model.url, apiKey: 'controlled' },
          ...(['A', 'B'].includes(id)
            ? {
                tools: {
                  echo: createTool({
                    id: 'echo',
                    description: 'Execute declared children.',
                    inputSchema: z.object({ fail: z.boolean() }),
                    outputSchema: z.object({ done: z.literal(true) }),
                    execute: async () => {
                      for (const target of id === 'A' ? ['B', 'C', 'D'] : ['C', 'D']) {
                        try {
                          await invoke(id, target);
                          outcomes.push(`${id}->${target}:allowed`);
                        } catch (error) {
                          outcomes.push(`${id}->${target}:${(error as { code: string }).code}`);
                        }
                      }
                      return { done: true as const };
                    },
                  }),
                },
              }
            : {}),
        }),
    }));
    const application = await createBillingApplication({
      environment: f.environment,
      catalog: { configuration: f.catalog.configuration, definitions },
    });
    cleanups.push(application.close);
    const other = await createBillingApplication({
      environment: f.environment,
      catalog: { configuration: f.catalog.configuration, definitions },
    });
    cleanups.push(other.close);
    const contexts = await Promise.all(
      [application, other].map(current => current.organizations.context({ credential: f.first.credential! })),
    );
    invoke = (owner, target) => {
      const current = owner === 'A' && target !== 'B' ? application : other;
      const billing = current === application ? contexts[0] : contexts[1];
      const prompt = ['A', 'B'].includes(target) ? `[multi] ${target}` : `[success] ${target}`;
      return entrypoint === 'nestedAgent'
        ? current.runtime.billing.nestedAgent(target).generate(prompt)
        : current.runtime.billing.agent(target).generate(prompt, { billing, idempotencyKey: `nested-${target}` });
    };
    const result = await application.runtime.billing
      .agent('A')
      .generate('[multi] A', { billing: contexts[0], idempotencyKey: 'transitive' });
    expect(outcomes).toEqual(['B->C:allowed', 'B->D:unsupported', 'A->B:allowed', 'A->C:unsupported', 'A->D:allowed']);
    expect(result).toMatchObject({ billing: { billedUnits: 1, settlementStatus: 'settled' } });
    expect(f.model.requests).toHaveLength(6);
    const observer = await independentClient(f.database.url);
    try {
      expect((await observer.execute('SELECT resource_id FROM billing_executions')).rows).toEqual([
        { resource_id: 'A' },
      ]);
      expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 1n }]);
    } finally {
      observer.close();
    }
  },
);

it.each(['configuration', 'snapshot initialization'] as const)(
  'failed fixture %s closes every acquired billing store',
  async failure => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    if (failure === 'snapshot initialization') {
      const snapshots = await independentClient(pathToFileURL(join(database.directory, 'workflow.db')).href);
      try {
        // A real legacy object permits opening SQLite but rejects the schema upgrade during init.
        await snapshots.execute('CREATE VIEW mastra_messages AS SELECT 1 AS id');
      } finally {
        snapshots.close();
      }
    }
    const initializing = vi.spyOn(LibSQLStore.prototype, 'init');
    const acquired: BillingDatabase[] = [];
    const open = BillingDatabase.open;
    const opening = vi.spyOn(BillingDatabase, 'open').mockImplementation(async options => {
      const store = await open(options);
      acquired.push(store);
      return store;
    });
    try {
      const pending = runtimeFixture({
        databaseUrl: database.url,
        directory: database.directory,
        modelUrl: 'http://127.0.0.1:1/v1',
        ...(failure === 'configuration'
          ? {
              configure: () => {
                throw new Error('Invalid fixture configuration');
              },
            }
          : {}),
      });
      if (failure === 'configuration') await expect(pending).rejects.toThrow('Invalid fixture configuration');
      else {
        await expect(pending).rejects.toMatchObject({ id: 'MASTRA_STORAGE_LIBSQL_ALTER_TABLE_FAILED' });
        const snapshot = initializing.mock.contexts[0];
        if (!(snapshot instanceof LibSQLStore)) throw new Error('Snapshot initialization did not acquire a store');
        await expect(
          snapshot.stores.workflows!.loadWorkflowSnapshot({ workflowName: 'report', runId: 'missing' }),
        ).rejects.toThrow(/closed/i);
      }
      expect(acquired).toHaveLength(failure === 'configuration' ? 1 : 4);
      for (const store of acquired)
        await expect(store.write(tx => tx.execute('SELECT 1'))).rejects.toMatchObject({ code: 'storage_unavailable' });
    } finally {
      opening.mockRestore();
      const snapshots = [...initializing.mock.contexts];
      initializing.mockRestore();
      for (const snapshot of snapshots) if (snapshot instanceof LibSQLStore) await snapshot.close();
      for (const store of acquired) store.close();
    }
  },
);

it.each(['bound thread', 'request context'] as const)(
  'a decorated targeted abort preserves the newer run and its approvals through %s',
  async entrypoint => {
    const f = await conversationFixture();
    const memory = { thread: f.owner.threadId, resource: f.owner.resourceId };
    await f.runtime.request.run(f.conversation, () =>
      f.agent.generate('Finished run', { runId: 'finished-run', memory }),
    );
    const stream = await f.runtime.request.run(f.conversation, () =>
      f.agent.streamUntilIdle('[abort] active newer run', { runId: 'current-run', memory }),
    );
    const output = stream.getFullOutput().catch(() => {});
    try {
      await f.model.stallStarted;
      await f.memory.saveMessages({
        messages: [
          {
            id: 'pending-runs',
            role: 'assistant',
            threadId: f.owner.threadId,
            resourceId: f.owner.resourceId,
            createdAt: new Date(),
            content: {
              format: 2,
              parts: ['finished', 'current'].map(id => ({
                type: 'tool-invocation' as const,
                toolInvocation: { toolCallId: `${id}-call`, toolName: 'business', state: 'call' as const, args: {} },
              })),
              metadata: {
                pendingToolApprovals: {
                  'finished-call': { runId: 'finished-run' },
                  'current-call': { runId: 'current-run' },
                },
              },
            },
          },
        ],
      });
      const pendingMessage = async () =>
        (await f.memory.recall({ threadId: f.owner.threadId, resourceId: f.owner.resourceId })).messages.find(
          message => message.id === 'pending-runs',
        )!;
      const before = await pendingMessage();
      const abort = (expectedRunId: string) => {
        const invoke = () =>
          f.agent.abortThreadStream({ threadId: f.owner.threadId, resourceId: f.owner.resourceId, expectedRunId });
        return entrypoint === 'request context' ? f.runtime.request.run(f.conversation, invoke) : invoke();
      };
      expect(abort('finished-run')).toBe(false);
      expect(f.conversation.controller.signal.aborted).toBe(false);
      await f.runtime.settled(f.owner.threadId);
      expect(await pendingMessage()).toEqual(before);
      expect(f.agent.getActiveThreadRunId({ threadId: f.owner.threadId, resourceId: f.owner.resourceId })).toBe(
        'current-run',
      );
      expect(f.runtime.bind({ ...f.conversation, controller: new AbortController() }).controller).toBe(
        f.conversation.controller,
      );
      expect(abort('current-run')).toBe(true);
      expect(f.conversation.controller.signal.aborted).toBe(true);
      await f.runtime.settled(f.owner.threadId);
      const after = await pendingMessage();
      expect(after.content.metadata?.pendingToolApprovals).toEqual({ 'finished-call': { runId: 'finished-run' } });
      expect(after.content.parts).toMatchObject([
        { toolInvocation: { toolCallId: 'finished-call', state: 'call' } },
        { toolInvocation: { toolCallId: 'current-call', state: 'output-error' } },
      ]);
    } finally {
      f.model.release();
      await output;
    }
  },
);
