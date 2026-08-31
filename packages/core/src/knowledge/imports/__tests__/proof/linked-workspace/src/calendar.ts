import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Knowledge } from '@mastra/core/knowledge';
import { knowledgeImporterBindingKey } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';

const adapter = process.env.KNOWLEDGE_ADAPTER === 'pg' ? 'pg' : 'libsql';
const scenarioArg = process.argv.indexOf('--scenario');
const scenario = scenarioArg >= 0 ? process.argv[scenarioArg + 1] : 'all';
if (scenario !== 'all') throw new Error(`Unsupported calendar proof scenario: ${scenario ?? '<missing>'}`);
const outArg = process.argv.indexOf('--out');
const outputDirectory = resolve(outArg >= 0 ? process.argv[outArg + 1]! : `./proof-${adapter}`);
const source = 'google-calendar:test-user@example.com';
const primary = { source, scope: 'resource:calendar-proof' } as const;
const secondary = { source: 'google-calendar:secondary@example.com', scope: 'resource:calendar-secondary' } as const;
const primaryBinding = knowledgeImporterBindingKey(primary);
const dbPath = resolve(outputDirectory, 'calendar.db');
const schemaName = `knowledge_calendar_${randomUUID().replaceAll('-', '')}`;

function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function eventRecordId(eventId: string, revision: number): string {
  const hex = createHash('sha256').update(`${eventId}:${revision}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

type CalendarEvent = { id: string; title: string; revision: number };
type CalendarPayload = {
  cursor?: string;
  events?: CalendarEvent[];
  removed?: string[];
  failAfterWrite?: boolean;
  hold?: string;
};

const holds = new Map<string, { started: () => void; release: Promise<void> }>();
const executionOrder: string[] = [];

await mkdir(outputDirectory, { recursive: true });
await rm(dbPath, { force: true });
const storage =
  adapter === 'pg'
    ? new PostgresStore({
        id: 'calendar-proof',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT) || 5434,
        database: process.env.POSTGRES_DB || 'postgres',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        schemaName,
      })
    : new LibSQLStore({ id: 'calendar-proof', url: `file:${dbPath}` });

const structure = {
  scopes: [
    { address: 'org:calendar-proof', name: 'Calendar proof' },
    { address: primary.scope, name: 'Primary calendar', parentAddresses: ['org:calendar-proof'] },
    { address: secondary.scope, name: 'Secondary calendar', parentAddresses: ['org:calendar-proof'] },
  ],
} as const;

const knowledge = new Knowledge({
  id: 'calendar-proof',
  storage,
  structure,
  importers: [
    {
      id: 'google-calendar-sync',
      access: { 'resource:$calendar': 'owner' },
      triggers: {
        cron: { schedule: '0 */6 * * *', bindings: [primary, secondary] },
        webhook: {
          bindings: [primary, secondary],
          resolveBinding: ({ payload }) =>
            (payload as { calendar?: 'secondary' } | undefined)?.calendar === 'secondary' ? secondary : primary,
        },
      },
      handler: async context => {
        const payload = (context.payload ?? {}) as CalendarPayload;
        if (payload.hold) {
          executionOrder.push(`start:${payload.hold}`);
          const hold = holds.get(payload.hold);
          invariant(hold, `Missing hold ${payload.hold}`);
          hold.started();
          await hold.release;
          executionOrder.push(`end:${payload.hold}`);
          return;
        }
        const importer = await context.importer();
        for (const event of payload.events ?? []) {
          const node = await importer.upsertNode(`event:${event.id}`, {
            name: event.title,
            metadata: { kind: 'calendar-event', revision: event.revision },
          });
          const expectedId = eventRecordId(event.id, event.revision);
          const existing = await node.listRecords();
          for (const record of existing) {
            if (record.id !== expectedId) await node.removeRecord(record.id);
          }
          if (!existing.some(record => record.id === expectedId)) {
            await node.appendRecord({
              id: expectedId,
              text: `${event.title} (revision ${event.revision})`,
              metadata: { eventId: event.id, revision: event.revision },
            });
          }
        }
        for (const eventId of payload.removed ?? []) await importer.removeNode(`event:${eventId}`);
        if (payload.failAfterWrite) throw new Error('simulated crash before cursor commit');
        if (payload.cursor) await context.state.set('syncToken', payload.cursor);
      },
    },
  ],
});

let cleanupError: unknown;
try {
  const reconciled = await knowledge.reconcile();
  const scopeId = reconciled.scopes[primary.scope]!;
  const importer = knowledge.getImporter('google-calendar-sync')!;
  const unauthorizedBinding = { source, scope: 'org:calendar-proof' } as const;
  const unauthorized = await importer.run(unauthorizedBinding, { cursor: 'must-not-commit' });
  invariant(unauthorized.status === 'failed', 'Binding outside importer access was not rejected');
  invariant(unauthorized.error?.includes('cannot write to scope'), 'Run did not fail at the importer access boundary');
  invariant(
    !(await knowledge.getImportStateInternal({
      importerId: 'google-calendar-sync',
      binding: knowledgeImporterBindingKey(unauthorizedBinding),
      key: 'syncToken',
    })),
    'Unauthorized binding committed importer state',
  );
  const initialPayload: CalendarPayload = {
    cursor: 'sync-1',
    events: [
      { id: 'evt-1', title: 'Architecture review', revision: 1 },
      { id: 'evt-2', title: 'Release readiness', revision: 1 },
    ],
    failAfterWrite: true,
  };
  const failed = await importer.run(primary, initialPayload);
  invariant(failed.status === 'failed', 'Crash run must fail');
  const failedCursor = await knowledge.getImportStateInternal({
    importerId: 'google-calendar-sync',
    binding: primaryBinding,
    key: 'syncToken',
  });
  invariant(!failedCursor, 'Cursor advanced before failed run completed');

  const firstAddress = await (await knowledge.getStorageInternal()).getNodeAddress({ source, address: 'event:evt-1' });
  invariant(firstAddress, 'Crash run did not durably commit the first event');
  const replay = await importer.run(primary, { ...initialPayload, failAfterWrite: false });
  invariant(replay.status === 'succeeded', 'Replay did not succeed');
  const replayCursor = await knowledge.getImportStateInternal({
    importerId: 'google-calendar-sync',
    binding: primaryBinding,
    key: 'syncToken',
  });
  invariant(replayCursor?.value === 'sync-1', 'Replay did not commit the cursor last');
  const replayAddress = await (await knowledge.getStorageInternal()).getNodeAddress({ source, address: 'event:evt-1' });
  invariant(replayAddress?.nodeId === firstAddress.nodeId, 'Replay changed the event UUID');

  const update = await importer.run(primary, {
    cursor: 'sync-2',
    events: [{ id: 'evt-1', title: 'Architecture review updated', revision: 2 }],
  });
  invariant(update.status === 'succeeded', 'Update run failed');
  const updateAddress = await (await knowledge.getStorageInternal()).getNodeAddress({ source, address: 'event:evt-1' });
  invariant(updateAddress?.nodeId === replayAddress.nodeId, 'Update changed the event UUID');
  const updatedNode = await knowledge.getNodeInternal(updateAddress.nodeId);
  invariant(updatedNode?.name === 'Architecture review updated', 'Update did not reconcile the event node');
  invariant(updatedNode.metadata?.revision === 2, 'Update did not reconcile event metadata');
  const updatedRecords = (
    await knowledge.listRecordsBySource({ source, scopeIds: [scopeId], limit: 100 })
  ).records.filter(record => record.nodeId === updateAddress.nodeId);
  invariant(
    updatedRecords.length === 1 &&
      updatedRecords[0]?.id === eventRecordId('evt-1', 2) &&
      updatedRecords[0]?.text === 'Architecture review updated (revision 2)',
    'Update did not replace the imported event record',
  );
  const updateCursor = await knowledge.getImportStateInternal({
    importerId: 'google-calendar-sync',
    binding: primaryBinding,
    key: 'syncToken',
  });
  invariant(updateCursor?.value === 'sync-2', 'Update did not advance the cursor after graph reconciliation');
  const omitted = await (await knowledge.getStorageInternal()).getNodeAddress({ source, address: 'event:evt-2' });
  invariant(omitted, 'Omitted event was incorrectly deleted');

  const removal = await importer.run(primary, { cursor: 'sync-3', removed: ['evt-2'] });
  invariant(removal.status === 'succeeded', 'Removal run failed');
  invariant(
    !(await (await knowledge.getStorageInternal()).getNodeAddress({ source, address: 'event:evt-2' })),
    'Explicitly removed event still has an address binding',
  );
  invariant(!(await knowledge.getNodeInternal(omitted.nodeId)), 'Explicitly removed event node remains visible');
  invariant(
    !(await knowledge.getRecordInternal({ id: eventRecordId('evt-2', 1), includeDeleted: true })),
    'Explicitly removed event record remains stored',
  );
  invariant(
    !(await knowledge.listRecordsBySource({ source, scopeIds: [scopeId], limit: 100 })).records.some(
      record => record.nodeId === omitted.nodeId,
    ),
    'Explicitly removed event records remain visible',
  );
  const removalCursor = await knowledge.getImportStateInternal({
    importerId: 'google-calendar-sync',
    binding: primaryBinding,
    key: 'syncToken',
  });
  invariant(removalCursor?.value === 'sync-3', 'Removal did not advance the cursor after graph reconciliation');

  let cronStarted!: () => void;
  let releaseCron!: () => void;
  const cronStartedPromise = new Promise<void>(resolveStarted => (cronStarted = resolveStarted));
  const releaseCronPromise = new Promise<void>(resolveRelease => (releaseCron = resolveRelease));
  holds.set('cron-primary', { started: cronStarted, release: releaseCronPromise });
  const cron = knowledge.runImporter(
    'google-calendar-sync',
    primary,
    { hold: 'cron-primary' },
    { triggerKind: 'cron' },
  );
  await cronStartedPromise;
  const skipped = await knowledge.runImporter(
    'google-calendar-sync',
    primary,
    { hold: 'cron-overlap' },
    { triggerKind: 'cron' },
  );
  invariant(skipped.status === 'skipped', 'Overlapping cron run was not skipped');
  let webhookStarted!: () => void;
  let releaseWebhook!: () => void;
  const webhookStartedPromise = new Promise<void>(resolveStarted => (webhookStarted = resolveStarted));
  const releaseWebhookPromise = new Promise<void>(resolveRelease => (releaseWebhook = resolveRelease));
  holds.set('webhook-primary', { started: webhookStarted, release: releaseWebhookPromise });
  const webhook = knowledge.runImporter(
    'google-calendar-sync',
    primary,
    { hold: 'webhook-primary' },
    { triggerKind: 'webhook' },
  );

  let secondaryStarted!: () => void;
  let releaseSecondary!: () => void;
  const secondaryStartedPromise = new Promise<void>(resolveStarted => (secondaryStarted = resolveStarted));
  const releaseSecondaryPromise = new Promise<void>(resolveRelease => (releaseSecondary = resolveRelease));
  holds.set('secondary', { started: secondaryStarted, release: releaseSecondaryPromise });
  const concurrent = importer.run(secondary, { hold: 'secondary' });
  await secondaryStartedPromise;
  releaseSecondary();
  releaseCron();
  await webhookStartedPromise;
  releaseWebhook();
  await Promise.all([cron, webhook, concurrent]);
  const cronEnd = executionOrder.indexOf('end:cron-primary');
  const webhookStart = executionOrder.indexOf('start:webhook-primary');
  invariant(cronEnd >= 0 && webhookStart > cronEnd, 'Same-binding webhook did not wait for the running cron import');

  const createActivity = await knowledge.listActivity({ scopeIds: [scopeId], importRunId: failed.id, limit: 100 });
  const removalActivity = await knowledge.listActivity({ scopeIds: [scopeId], importRunId: removal.id, limit: 100 });
  invariant(createActivity.length > 0, 'Failed run mutations are not linked to its run header');
  invariant(removalActivity.length > 0, 'Removal activity is not linked to its run header');

  const secondaryStart = executionOrder.indexOf('start:secondary');
  const result = {
    adapter,
    source,
    address: 'event:evt-1',
    stableNodeId: replayAddress.nodeId,
    failedRun: { id: failed.id, status: failed.status, cursorCommitted: Boolean(failedCursor) },
    replayRun: { id: replay.id, status: replay.status, cursor: replayCursor.value },
    updateRun: {
      id: update.id,
      status: update.status,
      nodeId: updateAddress.nodeId,
      name: updatedNode.name,
      revision: updatedNode.metadata?.revision,
      recordIds: updatedRecords.map(record => record.id),
      cursor: updateCursor.value,
    },
    removalRun: {
      id: removal.id,
      status: removal.status,
      removedNodeId: omitted.nodeId,
      activityCount: removalActivity.length,
      cursor: removalCursor.value,
    },
    omittedEntryPreserved: Boolean(omitted),
    explicitRemovalApplied: !(await knowledge.getNodeInternal(omitted.nodeId)),
    unauthorizedBindingRejected: unauthorized.status === 'failed',
    cronOverlapStatus: skipped.status,
    sameBindingWebhookFifo: webhookStart > cronEnd,
    differentBindingConcurrent: secondaryStart >= 0 && secondaryStart < cronEnd,
    activityLinkedToRuns: createActivity.length > 0 && removalActivity.length > 0,
    executionOrder,
  };
  await writeFile(resolve(outputDirectory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
  console.log(`PROOF: GREEN — calendar importer passed on ${adapter}`);
} finally {
  try {
    if (adapter === 'pg') {
      invariant(schemaName.startsWith('knowledge_calendar_'), 'Refusing to drop non-proof schema');
      await (storage as PostgresStore).db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
    await storage.close();
  } catch (error) {
    cleanupError = error;
  }
  if (cleanupError) throw cleanupError;
}
