// Writes representative Knowledge data through a published W1 build's own storage API.
import * as libsqlPkg from '@mastra/libsql';
import * as pgPkg from '@mastra/pg';

const [adapter, target] = process.argv.slice(2);
const log = [];
const step = async (name, fn) => {
  try {
    const value = await fn();
    log.push({ step: name, ok: true });
    return value;
  } catch (error) {
    log.push({ step: name, ok: false, error: String(error?.message ?? error) });
    return undefined;
  }
};

const store =
  adapter === 'libsql'
    ? new libsqlPkg.LibSQLStore({ id: 'seed', url: `file:${target}` })
    : new pgPkg.PostgresStore({
        id: 'seed',
        connectionString: 'postgresql://postgres:postgres@localhost:5434/mastra',
        schemaName: target,
      });
const k = await store.getStore('knowledge');
await k.init();

const org = ['org:acme'];
const resource = ['org:acme', 'resource:shipyard'];
const thread = ['org:acme', 'resource:shipyard', 'thread:t1'];
const otherThread = ['org:acme', 'resource:shipyard', 'thread:t2'];

await step('reconcile structure', () =>
  k.reconcileStructure({
    scopes: [{ address: 'features', name: 'features', description: 'Feature areas' }],
  }),
);
const payments = await step('create node with description', () =>
  k.createNode({ name: 'Payments', kind: 'service', scope: resource, description: 'Handles billing and invoices' }),
);
const ledger = await step('create placed node', () =>
  k.createNode({ name: 'Ledger', kind: 'service', scope: resource, scopeAddresses: ['features'] }),
);
const heron = await step('create thread node', () => k.createNode({ name: 'Heron', kind: 'project', scope: thread }));
const alias = await step('create alias node', () => k.createNode({ name: 'Payment Service', kind: 'service', scope: resource }));
const orgNode = await step('create org node', () => k.createNode({ name: 'Acme Policy', kind: 'policy', scope: org }));

const append = (name, input) =>
  step(name, () =>
    k.appendKnowledge({ resolutionScope: thread, defaultScope: resource, sourceThreadId: 't1', ...input }),
  );
const r1 = await append('record with resolved and unresolved wikilinks', {
  node: payments,
  text: 'Payments writes to [[Ledger]] and reports to [[Nowhere Service]].',
  scope: resource,
  when: '2026-10-01T12:00:00.000Z',
  metadata: { origin: 'seed' },
});
await append('thread record', { node: heron, text: 'Heron is the codename for the Q4 launch.', scope: thread });
await append('other-thread record', {
  node: heron,
  text: 'Marisol owns verification for [[Heron]].',
  scope: otherThread,
  sourceThreadId: 't2',
  resolutionScope: otherThread,
});
await append('org record', { node: orgNode, text: 'All services log to the audit trail.', scope: org });
const aliasRecord = await append('alias record', { node: alias, text: 'Alias record about [[Payments]].', scope: resource });
const doomed = await append('record to delete', { node: payments, text: 'Temporary note.', scope: resource });
if (doomed) await step('remove record', () => k.removeKnowledge({ id: doomed.id, deletedBy: 'seed' }));
if (payments) {
  const fresh = await k.getNode(payments.id);
  await step('update node description', () =>
    k.updateNode({ id: payments.id, version: fresh.version, description: 'Billing, invoices and refunds' }),
  );
}
if (alias && payments) {
  const fresh = await k.getNode(alias.id);
  await step('merge alias into payments', () =>
    k.mergeNodes({ sourceId: alias.id, targetId: payments.id, sourceVersion: fresh.version }),
  );
}
void r1;
void aliasRecord;
void ledger;
console.log(JSON.stringify(log, null, 2));
process.exit(0);
