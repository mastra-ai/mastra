import { independentClient, removeDriverMigration } from './billing.js';
import { runtimeFixture } from './mastra.js';
import { initializeBilling } from '../../src/billing/setup.js';
import { RecoveryStorage } from '../../src/billing/storage/recovery.js';
import { BillingRecovery } from '../../src/billing/recovery.js';
const [kind, serialized] = process.argv.slice(2);
if (kind.startsWith('source-')) {
  const options = JSON.parse(serialized);
  const initialized = await initializeBilling({
    ...options,
    polar: { ...options.polar, contact: async () => ({ email: 'trusted@example.test', name: 'Workspace billing' }) },
  });
  const records = await RecoveryStorage.open(options.storage);
  const worker = new BillingRecovery(records, initialized.provider);
  if (kind === 'source-intake')
    await worker.intake({
      body: Buffer.from(options.notification.body, 'base64'),
      headers: options.notification.headers,
    });
  else await initialized.provider.getState(options.account);
  process.send?.({ boundaryCommitted: true });
  await new Promise(() => {
    setInterval(() => {}, 1000);
  });
}
const runtime = await runtimeFixture(JSON.parse(serialized));
if (kind.startsWith('expiry-')) {
  const handle = await runtime.billing
    .workflow('report')
    .createRun({ billing: runtime.billingContext, idempotencyKey: `boundary-${kind}` });
  await handle.start({ billing: runtime.billingContext, idempotencyKey: 'boundary-start', inputData: { count: 0 } });
  const observer = await independentClient(JSON.parse(serialized).databaseUrl);
  await observer.execute({
    sql: 'UPDATE billing_workflow_runs SET expires_at = 0 WHERE id = ?',
    args: [handle.executionId],
  });
  const checksums = (
    await observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 6 ORDER BY version')
  ).rows.map(row => ({ version: Number(row.version), checksum: String(row.checksum) }));
  const claim = await runtime.workflowStorage.claimExpiry(handle.executionId, Date.now(), 100);
  if (!claim) throw new Error('Expected durable expiry claim');
  if (kind === 'expiry-canceled') {
    if ((await runtime.workflows.report.native.getWorkflowRunById(handle.executionId))?.status !== 'suspended')
      throw new Error('Expected actual suspension');
    if (!(await runtime.workflowStorage.confirmExpiredSuspension(claim)))
      throw new Error('Expected current expiry lease');
    await (await runtime.workflows.report.native.createRun({ runId: handle.executionId })).cancel();
  }
  if (kind === 'expiry-unconfirmed-canceled')
    await (await runtime.workflows.report.native.createRun({ runId: handle.executionId })).cancel();
  if (kind === 'expiry-missing')
    await (await runtime.mastra.getStorage()!.getStore('workflows'))!.deleteWorkflowRunById({
      runId: handle.executionId,
      workflowName: 'report',
    });
  if (kind === 'expiry-active') {
    const workflows = (await runtime.mastra.getStorage()!.getStore('workflows'))!;
    const snapshot = await workflows.loadWorkflowSnapshot({ runId: handle.executionId, workflowName: 'report' });
    if (!snapshot) throw new Error('Expected persisted snapshot');
    // A contradictory persisted runtime status is injected through the actual
    // storage API; recovery must not treat it as proof of termination.
    await workflows.persistWorkflowSnapshot({
      runId: handle.executionId,
      workflowName: 'report',
      snapshot: { ...snapshot, status: 'running' },
    });
  }
  if (kind === 'expiry-legacy') {
    await removeDriverMigration(observer);
    // Reconstruct the shipped schema6 boundary in this disposable file only.
    await observer.execute('ALTER TABLE hosted_operations DROP COLUMN dispatch_state');
    await observer.execute('DROP TABLE billing_catalog');
    await observer.execute('DROP TABLE billing_usage_bindings');
    await observer.execute('DROP TABLE billing_expiry_recovery');
    await observer.execute('DELETE FROM billing_migrations WHERE version >= 7');
    await observer.execute('PRAGMA user_version = 6');
  }
  observer.close();
  process.send?.({
    executionId: handle.executionId,
    credential: runtime.credential,
    workspaceId: runtime.billingContext.workspaceId,
    configuration: runtime.configuration,
    checksums,
  });
  await new Promise(() => {
    setInterval(() => {}, 1000);
  });
}
if (kind === 'orphan') {
  const handle = await runtime.billing
    .workflow('report')
    .createRun({ billing: runtime.billingContext, idempotencyKey: 'orphan-create' });
  const identity = await runtime.organizations.accountingIdentity(runtime.billingContext);
  await runtime.workflowStorage.claim(
    identity,
    handle.executionId,
    'start',
    'orphan-start',
    { count: 0 },
    'orphan-runtime',
  );
  process.send?.({ claimed: true, executionId: handle.executionId });
  await new Promise(() => {
    setInterval(() => {}, 1000);
  });
}
if (kind === 'agent') {
  await runtime.billing
    .agent('assistant')
    .generate('[abort] interrupted', { billing: runtime.billingContext, idempotencyKey: 'interrupted-agent' });
} else {
  const handle = await runtime.billing
    .workflow('report')
    .createRun({ billing: runtime.billingContext, idempotencyKey: 'interrupted-workflow' });
  process.send?.({ executionId: handle.executionId });
  await handle.start({ billing: runtime.billingContext, idempotencyKey: 'interrupted-start', inputData: { count: 0 } });
}
await runtime.close();
