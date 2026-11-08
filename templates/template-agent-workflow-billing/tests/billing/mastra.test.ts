import { afterEach, describe, expect, it } from 'vitest';
import { fork } from 'node:child_process';
import { readFile, stat, chmod, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { modelBoundary, runtimeFixture, mastraConfiguration } from '../support/mastra.js';
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { agentResource } from '../../src/billing/mastra-resources.js';
import { initializeMastraBilling } from '../../src/billing/mastra-setup.js';
import { billingConfigurationSchema } from '../../src/billing/configuration.js';
import { MastraBilling } from '../../src/billing/mastra.js';
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
    | 'workflowExpectedCalls'
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
    expect((await observer.execute('SELECT id FROM billing_outbox')).rows).toHaveLength(1);
    expect(
      (await observer.execute("SELECT SUM(units) AS units FROM billing_measurements WHERE measure = 'tokens'")).rows,
    ).toEqual([{ units: 10n }]);
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

  it('suspension expiry and resume race cannot double release or charge', async () => {
    const { runtime, model, observer, database } = await fixture({
      configure: configuration => {
        configuration.resources[1].policy.suspendedReservationTtlMs = 15;
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
        expect([0n, 2n]).toContain(ledger[0].units);
        expect(reservations).toEqual([{ active: 0n }]);
      }
      const events = (
        await observer.execute({
          sql: 'SELECT id FROM billing_outbox WHERE execution_id = ?',
          args: [handle.executionId],
        })
      ).rows;
      expect(events.length).toBe(ledger[0]?.units === 2n ? 1 : 0);
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
      executionStatus: 'completed',
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
        configuration.resources[1].policy.charge = {
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
    changed.resources[1].policy.version = 'new-policy';
    changed.resources[1].policy.charge = { type: 'per-task', meter: 'tasks', units: 7, funding: 'prepaid' };
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
    unbounded.resources[0].measurements.find(measure => measure.key === 'tokens')!.enforceableBound = true;
    unbounded.resources[0].policy.charge = {
      type: 'usage',
      meter: 'tokens',
      measure: 'tokens',
      maxUnits: 20,
      funding: 'prepaid',
    };
    expect(() => build(unbounded)).toThrowError(expect.objectContaining({ code: 'invalid_configuration' }));
    expect(model.requests).toHaveLength(0);
    const bounded = billingConfigurationSchema.parse(runtime.configuration);
    bounded.resources[0].policy.charge = {
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
    await pending;
    expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
    expect((await observer.execute('SELECT status FROM billing_workflow_runs')).rows).toEqual([
      { status: 'uncertain' },
    ]);
    expect((await runtime.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe('canceled');
  });

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
          configuration.resources[1].policy.charge = {
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
      expect(completed.billing).toMatchObject({ settlementStatus: 'pending', billedUnits: null });
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
        configuration.resources[1].policy.suspendedReservationTtlMs = 5;
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
        configuration.resources[0].policy.charge = {
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
});
