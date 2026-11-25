import { LocalBillingStorage } from '../../src/billing/providers/local/storage.js';
import { RecoveryStorage } from '../../src/billing/storage/recovery.js';
import type { UsageEvent } from '../../src/billing/contracts/core.js';
import { independentClient } from './billing.js';
import { runtimeFixture } from './mastra.js';
import { AutumnBillingProvider } from '../../src/billing/providers/autumn/index.js';
import { JwtIdentityAdapter } from '../../src/billing/identity.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
const [kind, serialized] = process.argv.slice(2);
const options = JSON.parse(serialized);
if (kind === 'metered-delivery') {
  const records = await RecoveryStorage.open({ url: options.databaseUrl });
  const provider = await LocalBillingStorage.open({ url: options.databaseUrl });
  const [claim] = await records.claimDeliveries({ batchSize: 1, leaseMs: 100 });
  if (!claim) throw new Error('Expected a persisted delivery');
  const result = await provider.reportUsage(JSON.parse(claim.payload) as UsageEvent);
  // The receiver committed, but the sender has not persisted its ACK. Killing
  // this process leaves a real leased delivery for the next process to recover.
  process.send?.({ boundary: 'metered-committed', status: result.status, id: claim.id, payload: claim.payload });
  await new Promise(() => {
    setInterval(() => {}, 1000);
  });
}
const directory = options.autumn ? await OrganizationStorage.open({ url: options.databaseUrl }) : undefined;
const organizations = directory
  ? new OrganizationService(directory, {
      identity: new JwtIdentityAdapter(directory, options.jwtConfiguration),
      mode: 'production',
      provider: 'autumn',
    })
  : undefined;
const provider = options.autumn
  ? await AutumnBillingProvider.open({ url: options.databaseUrl }, options.autumn)
  : undefined;
const runtime = await runtimeFixture({ ...options, organizations, provider });
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
function waitForInterruption(executionId: string): Promise<never> {
  process.send?.({ executionId, boundary: kind });
  return new Promise(() => setInterval(() => {}, 1000));
}
if (kind === 'initial-acknowledged') {
  // The real gateway and provider have already persisted a positive ACK.
  runtime.accounting.beginSegment = (_identity, executionId) => waitForInterruption(executionId);
}
if (kind === 'initial-handoff') {
  const begin = runtime.workflowStorage.beginNativeHandoff.bind(runtime.workflowStorage);
  runtime.workflowStorage.beginNativeHandoff = async (...args) => {
    await begin(...args);
    await waitForInterruption(args[1].id);
  };
}
if (kind === 'agent') {
  await runtime.billing
    .agent('assistant')
    .generate('[abort] interrupted', { billing: runtime.billingContext, idempotencyKey: 'interrupted-agent' });
} else {
  const handle = await runtime.billing
    .workflow('report')
    .createRun({ billing: runtime.billingContext, idempotencyKey: 'interrupted-workflow' });
  if (!kind.startsWith('initial-')) process.send?.({ executionId: handle.executionId });
  await handle.start({ billing: runtime.billingContext, idempotencyKey: 'interrupted-start', inputData: { count: 0 } });
  if (kind === 'initial-unknown') await waitForInterruption(handle.executionId);
}
await runtime.close();
provider?.close();
organizations?.close();
