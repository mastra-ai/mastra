import { access, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';
import { CaseStore, StaleCaseWriteError } from '../../src/mastra/lib/case-store';
import {
  legacyAmountToMoney,
  money,
  moneyToLegacyAmount,
  refundFingerprint,
  subscriptionCreditFingerprint,
} from '../../src/mastra/lib/money';
import { deliverOutbox, LocalRuntime, recoverLocalWorkflows } from '../../src/mastra/runtime/local-runtime';
import { serializeSqliteClient } from '../../src/mastra/lib/sqlite-client';
import { resolveDatabaseUrl } from '../../src/mastra/lib/database-url';
import {
  createLocalLoopbackFacade,
  type LoopbackFetch,
  LoopbackHttpCommerceProvider,
  LoopbackHttpProviderRegistry,
} from '../../src/mastra/providers/advanced/loopback-http';
import { registerProviderRegistry, resetProviderRegistryForTests } from '../../src/mastra/providers/registry';
import type { CaseProviderBindings, ProviderBinding, ProviderRegistry } from '../../src/mastra/providers/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

const files: string[] = [];
const execFileAsync = promisify(execFile);
const binding: ProviderBinding = {
  // Direct financial effects now validate the active approver identity against
  // the command's tenant.  Use the seeded local-demo tenant in this fixture.
  tenantId: 'local-demo',
  providerKind: 'local',
  providerAccountId: 'account-a',
  externalConversationId: 'conversation-a',
};
function supportCase(id: string, externalId = id) {
  const createdAt = '2026-09-05T00:00:00.000Z';
  return {
    id,
    externalId,
    source: 'mock-email' as const,
    customer: { email: 'alex@example.com' },
    subject: 'Duplicate',
    messages: [
      {
        id: `message-${id}`,
        author: 'customer' as const,
        body: 'Refund please',
        createdAt,
      },
    ],
    status: 'new' as 'new' | 'waiting_approval',
    createdAt,
    updatedAt: createdAt,
    metadata: { providerBinding: binding },
  };
}
async function approvedCommand(store: CaseStore, key: string, minor: number) {
  const amount = money('USD', minor);
  const base = {
    approvalCaseId: `approval-${key}`,
    binding,
    orderId: 'ORD-1001',
    amount,
    reason: 'duplicate',
    idempotencyKey: key,
  };
  const command = { ...base, fingerprint: refundFingerprint(base) };
  const persistedCommand = {
    approvalCaseId: base.approvalCaseId,
    orderId: base.orderId,
    amount: moneyToLegacyAmount(base.amount),
    currency: base.amount.currency,
    reason: base.reason,
    idempotencyKey: base.idempotencyKey,
    fingerprint: command.fingerprint,
  };
  const turnId = `native-turn-${key}`;
  const nativeRunId = `native-run-${key}`;
  const nativeToolCallId = `native-call-${key}`;
  await store.create({
    ...supportCase(base.approvalCaseId),
    status: 'waiting_approval',
    metadata: {
      providerBinding: binding,
      refundCommand: persistedCommand,
      activeTurnId: turnId,
      nativeApproval: {
        runId: nativeRunId,
        toolCallId: nativeToolCallId,
        fingerprint: command.fingerprint,
        turnId,
      },
    },
  });
  await store.saveAction(base.approvalCaseId, 'refund-command', command.fingerprint, command);
  await store.recordApprovalDecision({
    caseId: base.approvalCaseId,
    turnId,
    commandFingerprint: command.fingerprint,
    principalId: 'approver-demo',
    approved: true,
    nativeRunId,
    nativeToolCallId,
  });
  return command;
}
async function approvedSubscriptionCreditCommand(store: CaseStore, key: string) {
  const amount = money('USD', 4900);
  const base = {
    approvalCaseId: `credit-${key}`,
    binding,
    customerId: 'local:local-demo:alex@example.com',
    subscriptionId: 'SUB-1001',
    amount,
    reason: 'service_problem',
    idempotencyKey: `credit-${key}`,
  };
  const command = {
    ...base,
    fingerprint: subscriptionCreditFingerprint(base),
  };
  const turnId = `native-credit-turn-${key}`;
  const nativeRunId = `native-credit-run-${key}`;
  const nativeToolCallId = `native-credit-call-${key}`;
  await store.create({
    ...supportCase(base.approvalCaseId),
    status: 'waiting_approval',
    approval: { approved: true, approverId: 'approver-demo' },
    metadata: {
      providerBinding: binding,
      subscriptionCreditCommand: {
        approvalCaseId: base.approvalCaseId,
        customerId: base.customerId,
        subscriptionId: base.subscriptionId,
        amount: moneyToLegacyAmount(base.amount),
        currency: base.amount.currency,
        reason: base.reason,
        idempotencyKey: base.idempotencyKey,
        fingerprint: command.fingerprint,
      },
      activeTurnId: turnId,
      nativeApproval: {
        runId: nativeRunId,
        toolCallId: nativeToolCallId,
        fingerprint: command.fingerprint,
        turnId,
      },
    },
  });
  await store.saveAction(base.approvalCaseId, 'subscription-credit-command', command.fingerprint, command);
  await store.recordApprovalDecision({
    caseId: base.approvalCaseId,
    turnId,
    commandFingerprint: command.fingerprint,
    principalId: 'approver-demo',
    approved: true,
    nativeRunId,
    nativeToolCallId,
  });
  return command;
}
async function runtime() {
  const path = join(tmpdir(), `phase002-${crypto.randomUUID()}.db`);
  files.push(path, `${path}-shm`, `${path}-wal`);
  const store = new CaseStore({ url: `file:${path}` });
  await store.list();
  const local = new LocalRuntime(store.getClient());
  // Recovery is a trusted knowledge-publication boundary.  Register this
  // fixture's actual local port instead of leaving it to fail before a mocked
  // workflow can exercise recovery behavior.
  resetProviderRegistryForTests();
  registerProviderRegistry(local, [binding]);
  return { path, store, local };
}

async function realLoopback(fetcher: LoopbackFetch) {
  const server = createServer(async (incoming, outgoing) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const request = new Request(`http://loopback${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers as HeadersInit,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const response = await fetcher(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No loopback port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    fetch: async (request: Request) =>
      fetch(`${baseUrl}${new URL(request.url).pathname}`, {
        method: request.method,
        headers: request.headers,
        body: request.method === 'GET' ? undefined : await request.text(),
      }),
    close: () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  };
}

afterEach(async () => {
  resetProviderRegistryForTests();
  await Promise.all(files.splice(0).map(file => rm(file, { force: true })));
});

describe('Phase 002 persistent local runtime', () => {
  it('preserves unrelated tables while refusing an unsupported durable-schema downgrade and rejecting stale writes', async () => {
    const { store } = await runtime();
    await store.getClient().execute('CREATE TABLE mastra_owned_probe (id TEXT PRIMARY KEY)');
    await store.getClient().execute("INSERT INTO mastra_owned_probe VALUES ('keep')");
    await store.create(supportCase('legacy'));
    await expect(store.migrate(1)).rejects.toThrow('Refusing unsupported downgrade from support schema v26 to v1.');
    expect((await store.get('legacy'))?.externalId).toBe('legacy');
    expect((await store.getClient().execute('SELECT id FROM mastra_owned_probe')).rows).toHaveLength(1);
    await store.update('legacy', { subject: 'Changed' }, 1);
    await expect(store.update('legacy', { subject: 'Stale' }, 1)).rejects.toBeInstanceOf(StaleCaseWriteError);
    await store.close();
  });

  it('reopens a tenant-scoped database and permits the same provider event identity in independent accounts', async () => {
    const { path, store } = await runtime();
    const secondBinding = {
      ...binding,
      tenantId: 'tenant-b',
      providerAccountId: 'account-b',
    };
    await store.acceptInbound(supportCase('tenant-a', 'shared-event'), 'same-provider-event-id', 'run-a');
    const caseB = supportCase('tenant-b', 'shared-event');
    caseB.metadata.providerBinding = secondBinding;
    await expect(store.acceptInbound(caseB, 'same-provider-event-id', 'run-b')).resolves.toEqual({
      caseId: 'tenant-b',
      isNew: true,
    });
    await store.close();

    const reopened = new CaseStore({ url: `file:${path}` });
    expect((await reopened.list()).map(entry => entry.id).sort()).toEqual(['tenant-a', 'tenant-b']);
    await reopened.close();
  });

  it('persists independent port bindings and rejects a later redirect', async () => {
    const { store } = await runtime();
    const commerce = {
      ...binding,
      tenantId: 'tenant-commerce',
      providerAccountId: 'account-commerce',
    };
    const bindings: CaseProviderBindings = {
      support: binding,
      commerce,
      transactions: binding,
      knowledge: binding,
    };
    const created = await store.create({
      ...supportCase('bound-case'),
      metadata: { providerBindings: bindings },
    });
    expect((created.metadata.providerBindings as CaseProviderBindings).commerce).toEqual(commerce);
    await expect(
      store.update('bound-case', {
        metadata: {
          providerBindings: {
            ...bindings,
            transactions: { ...binding, providerAccountId: 'redirected' },
          },
        },
      }),
    ).rejects.toThrow('transactions provider binding is immutable');
    await store.close();
  });

  it('refuses a pre-v6 target before touching the current durable migration marker', async () => {
    const { store } = await runtime();
    await store.create(supportCase('bad-migration'));
    await expect(store.migrate(3)).rejects.toThrow('Refusing unsupported downgrade from support schema v26 to v3.');
    const versions = await store.getClient().execute('SELECT version FROM support_schema_migrations ORDER BY version');
    expect(versions.rows.map(row => Number(row.version))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
    ]);
    expect(await store.getClient().execute("SELECT id FROM support_cases WHERE id = 'bad-migration'")).toMatchObject({
      rows: [expect.objectContaining({ id: 'bad-migration' })],
    });
    await store.close();
  });

  it('deduplicates inbound acceptance atomically and keeps its generated dispatch durable after reopen', async () => {
    const { store } = await runtime();
    const first = await store.acceptInbound(supportCase('case-one', 'event-one'), 'event-one', 'run-one');
    const second = await store.acceptInbound(supportCase('case-two', 'event-one'), 'event-one', 'run-two');
    expect(first).toEqual({ caseId: 'case-one', isNew: true });
    expect(second).toEqual({ caseId: 'case-one', isNew: false });
    const dispatch = await store
      .getClient()
      .execute("SELECT run_id, state FROM support_dispatch WHERE case_id = 'case-one'");
    expect(dispatch.rows[0]).toMatchObject({
      run_id: 'run-one',
      state: 'pending',
    });
    await store.close();
  });

  it('keeps simultaneous verified first events in one canonical conversation', async () => {
    const { path, store } = await runtime();
    const other = new CaseStore({ url: `file:${path}` });
    await other.list();
    const conversation = `race-${crypto.randomUUID()}`;
    const candidate = (id: string, event: string) => ({
      ...supportCase(id, event),
      metadata: {
        providerBinding: { ...binding, externalConversationId: conversation },
        ownerId: 'customer-alex',
      },
    });
    // These are independent SQLite clients.  Each caller follows the actual
    // ingress contract: a canonical winner persists turn one, while any
    // create-or-append result appends its own event and immutable message.
    const attempts = [
      {
        client: store,
        input: candidate('canonical-first', 'event-first'),
        eventId: 'event-first',
        runId: 'run-first',
      },
      {
        client: other,
        input: candidate('canonical-second', 'event-second'),
        eventId: 'event-second',
        runId: 'run-second',
      },
    ];
    const accepted = await Promise.all(
      attempts.map(async attempt => ({
        ...attempt,
        result: await attempt.client.acceptInbound(attempt.input, attempt.eventId, attempt.runId),
      })),
    );
    await Promise.all(
      accepted.map(async attempt => {
        if (!('appendRequired' in attempt.result)) return;
        await attempt.client.appendFollowUp({
          caseId: attempt.result.caseId,
          eventId: attempt.eventId,
          runId: attempt.runId,
          message: attempt.input.messages[0],
          expectedOwnerId: 'customer-alex',
        });
      }),
    );
    const rows = await store.getClient().execute({
      sql: 'SELECT case_id FROM support_conversations WHERE external_conversation_id = ?',
      args: [conversation],
    });
    expect(rows.rows).toHaveLength(1);
    const turns = await store.getClient().execute({
      sql: 'SELECT sequence, event_id FROM support_turns WHERE case_id = ? ORDER BY sequence',
      args: [String(rows.rows[0]?.case_id)],
    });
    expect(turns.rows).toEqual([
      { sequence: 1, event_id: expect.any(String) },
      { sequence: 2, event_id: expect.any(String) },
    ]);
    expect(turns.rows.map(turn => turn.event_id).sort()).toEqual(['event-first', 'event-second']);
    const messages = await store.getClient().execute({
      sql: 'SELECT message_data FROM support_turns WHERE case_id = ? ORDER BY sequence',
      args: [String(rows.rows[0]?.case_id)],
    });
    expect(messages.rows.map(row => JSON.parse(String(row.message_data)).id).sort()).toEqual([
      'message-canonical-first',
      'message-canonical-second',
    ]);
    const winnerCaseId = String(rows.rows[0]?.case_id);
    await expect(
      store.acceptInbound(
        {
          ...candidate('replay-with-redirect', 'event-first'),
          metadata: {
            providerBinding: {
              ...binding,
              externalConversationId: 'redirected-conversation',
            },
            ownerId: 'customer-alex',
          },
        },
        'event-first',
        'replay-run',
      ),
    ).resolves.toEqual({ caseId: winnerCaseId, isNew: false });
    await expect(
      store.acceptInbound(
        {
          ...candidate('foreign-replay', 'event-first'),
          metadata: {
            providerBinding: {
              ...binding,
              externalConversationId: conversation,
            },
            ownerId: 'customer-jordan',
          },
        },
        'event-first',
        'foreign-replay-run',
      ),
    ).rejects.toThrow('owned by another principal');
    await expect(
      other.acceptInbound(
        {
          ...candidate('foreign-canonical', 'event-third'),
          metadata: {
            providerBinding: {
              ...binding,
              externalConversationId: conversation,
            },
            ownerId: 'customer-jordan',
          },
        },
        'event-third',
        'foreign-canonical-run',
      ),
    ).rejects.toThrow('owned by another principal');
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT COUNT(*) AS total FROM support_turns WHERE case_id = ?',
          args: [winnerCaseId],
        })
      ).rows[0],
    ).toMatchObject({ total: 2 });
    await other.close();
    await store.close();
  });

  it('retries a real competing SQLite seed after the holder commits on the event loop', async () => {
    const { path, store, local } = await runtime();
    const holderClient = createClient({ url: `file:${path}`, timeout: 0 });
    await holderClient.execute('PRAGMA busy_timeout = 0');
    await holderClient.execute('BEGIN IMMEDIATE');

    const release = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        void holderClient.execute('COMMIT').then(() => resolve(), reject);
      }, 20);
    });
    await expect(local.seed(binding)).resolves.toBeUndefined();
    await release;
    expect(await local.findOrder(binding, '', 'ORD-1001')).toBeTruthy();
    holderClient.close();
    await store.close();
  });

  it('keeps a serialized transaction fenced through a failed commit until rollback or close', async () => {
    let commitAttempts = 0;
    let rollbacks = 0;
    let executes = 0;
    const rawTransaction = {
      commit: async () => {
        commitAttempts += 1;
        throw new Error('commit failed');
      },
      rollback: async () => {
        rollbacks += 1;
      },
      close: () => undefined,
      execute: async () => ({ rows: [] }),
    };
    const client = serializeSqliteClient({
      closed: false,
      protocol: 'file',
      execute: async () => {
        executes += 1;
        return { rows: [] };
      },
      transaction: async () => rawTransaction,
      batch: async () => [],
      executeMultiple: async () => undefined,
      migrate: async () => undefined,
      sync: async () => undefined,
      reconnect: async () => undefined,
      close: () => undefined,
    } as never);
    const transaction = await client.transaction('write');
    await expect(transaction.commit()).rejects.toThrow('commit failed');
    const queued = client.execute('SELECT 1');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(executes).toBe(0);
    await transaction.rollback();
    await queued;
    expect(commitAttempts).toBe(1);
    expect(rollbacks).toBe(1);
    expect(executes).toBe(1);

    const closedTransaction = await client.transaction('write');
    const releasedByClose = client.execute('SELECT 1');
    await closedTransaction.close();
    await releasedByClose;
    expect(executes).toBe(2);
  });

  it('does not let a legacy durable decision invoke a financial provider directly', async () => {
    const { store, local } = await runtime();
    await local.seed(binding);
    const commandA = await approvedCommand(store, 'case-a', 2400);
    await expect(local.issueRefund(commandA)).rejects.toThrow('approved native refund tool context');
    const conflictingBase = { ...commandA, amount: money('USD', 2300) };
    const conflicting = {
      ...conflictingBase,
      fingerprint: refundFingerprint(conflictingBase),
    };
    const caseA = await store.get(commandA.approvalCaseId);
    await store.update(commandA.approvalCaseId, {
      metadata: {
        ...caseA!.metadata,
        refundCommand: {
          approvalCaseId: conflicting.approvalCaseId,
          orderId: conflicting.orderId,
          amount: moneyToLegacyAmount(conflicting.amount),
          currency: conflicting.amount.currency,
          reason: conflicting.reason,
          idempotencyKey: conflicting.idempotencyKey,
          fingerprint: conflicting.fingerprint,
        },
      },
    });
    await expect(local.issueRefund(conflicting)).rejects.toThrow('approved native refund tool context');
    await expect(local.issueRefund(await approvedCommand(store, 'case-c', 1))).rejects.toThrow(
      'approved native refund tool context',
    );
    expect(await local.refunds(binding, 'ORD-1001')).toEqual([]);
    await store.close();
  });

  it('rejects malformed direct commands and concurrent direct financial bypasses', async () => {
    const { path, store, local } = await runtime();
    await local.seed(binding);
    await expect(
      local.issueRefund({
        ...(await approvedCommand(store, 'zero', 1)),
        amount: money('USD', 0),
      }),
    ).rejects.toThrow('positive safe integer');
    const secondClient = createClient({ url: `file:${path}` });
    const secondRuntime = new LocalRuntime(secondClient);
    const concurrentA = await approvedCommand(store, 'concurrent-a', 3000);
    const concurrentB = await approvedCommand(store, 'concurrent-b', 3000);
    const results = await Promise.allSettled([local.issueRefund(concurrentA), secondRuntime.issueRefund(concurrentB)]);
    expect(results.every(result => result.status === 'rejected')).toBe(true);
    expect(await local.refunds(binding, 'ORD-1001')).toEqual([]);
    secondClient.close();
    await store.close();
  });

  it('quotes only the exact seeded monthly subscription and refuses a direct credit effect', async () => {
    const { store, local } = await runtime();
    await local.seed(binding);
    const command = await approvedSubscriptionCreditCommand(store, 'quote');
    await expect(local.quoteSubscriptionCredit(command)).resolves.toEqual({
      approvedAmount: money('USD', 4900),
      commandFingerprint: command.fingerprint,
    });
    await expect(local.issueSubscriptionCredit(command)).rejects.toThrow('authorized native decision');
    await expect(
      local.quoteSubscriptionCredit({
        ...command,
        amount: money('USD', 1901),
      }),
    ).rejects.toThrow('fingerprint was tampered with');
    const credits = await store.getClient().execute({
      sql: 'SELECT COUNT(*) AS total FROM local_subscription_credits',
    });
    expect(credits.rows[0]).toMatchObject({ total: 0 });
    await store.close();
  });

  it('seeds and resets only the requested binding and rejects ambiguous local lookups', async () => {
    const { store, local } = await runtime();
    const other = {
      ...binding,
      tenantId: 'tenant-b',
      providerAccountId: 'account-b',
    };
    await local.seed(binding);
    await local.seed(other);
    const documents = await local.listChanged(binding);
    expect(documents).toContainEqual(expect.objectContaining({ source: 'duplicate-charge-policy' }));
    await expect(local.fetchDocument(binding, 'duplicate-charge-policy')).resolves.toMatchObject({
      version: 'local-v1',
    });
    await store.getClient().execute({
      sql: "INSERT INTO local_orders VALUES (?, ?, 'ORD-extra', 'alex@example.com', 'Extra', 100, 'USD', 'fulfilled', 1, '2026-09-05T00:00:00.000Z')",
      args: [binding.tenantId, binding.providerAccountId],
    });
    await expect(local.findOrder(binding, 'alex@example.com')).rejects.toThrow('Ambiguous');
    await local.reset(binding);
    expect(await local.findOrder(other, 'alex@example.com', 'ORD-1001')).toBeTruthy();
    expect(await local.findOrder(binding, 'alex@example.com', 'ORD-1001')).toBeUndefined();
    await store.close();
  });

  it('invalidates a committed fixture memo so seed-reset-seed restores the same binding', async () => {
    const { store, local } = await runtime();
    await local.seed(binding);
    await local.reset(binding);
    expect(await local.findOrder(binding, 'alex@example.com', 'ORD-1001')).toBeUndefined();
    await local.seed(binding);
    expect(await local.findOrder(binding, 'alex@example.com', 'ORD-1001')).toMatchObject({ orderId: 'ORD-1001' });
    await store.close();
  });

  it('keeps CLI fixtures and delivery receipts intact when reset sees a durable effect', async () => {
    const path = join(tmpdir(), `phase002-cli-${crypto.randomUUID()}.db`);
    files.push(path, `${path}-shm`, `${path}-wal`);
    const environment = {
      ...process.env,
      APP_MODE: 'local',
      DATABASE_URL: `file:${path}`,
      LOCAL_DEMO_DATABASE_URL: `file:${path}`,
      ORIGINAL_DATABASE_URL: `file:${path}.external`,
      LOCAL_DEMO_FIXTURE_PROFILE: 'characterization',
      LOCAL_FIXTURE_TENANT: binding.tenantId,
      LOCAL_FIXTURE_ACCOUNT: binding.providerAccountId,
    };
    await execFileAsync(process.execPath, ['scripts/local-fixtures.mjs', 'seed'], {
      cwd: process.cwd(),
      env: environment,
    });
    await execFileAsync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { createClient } from "@libsql/client"; const client = createClient({ url: ${JSON.stringify(`file:${path}`)}, timeout: 0 }); await client.execute({ sql: "INSERT INTO local_deliveries VALUES (?, ?, 'receipt-key', 'payload', '{}')", args: [${JSON.stringify(binding.tenantId)}, ${JSON.stringify(binding.providerAccountId)}] }); client.close();`,
      ],
      { cwd: process.cwd() },
    );

    await expect(
      execFileAsync(process.execPath, ['scripts/local-fixtures.mjs', 'reset'], {
        cwd: process.cwd(),
        env: environment,
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('durable refund/idempotency or delivery effects'),
    });
    const verification = await execFileAsync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { createClient } from "@libsql/client"; const client = createClient({ url: ${JSON.stringify(`file:${path}`)}, timeout: 0 }); const orders = await client.execute({ sql: "SELECT order_id FROM local_orders WHERE tenant_id = ? AND provider_account_id = ? AND order_id = 'ORD-1001'", args: [${JSON.stringify(binding.tenantId)}, ${JSON.stringify(binding.providerAccountId)}] }); const receipts = await client.execute({ sql: "SELECT receipt FROM local_deliveries WHERE tenant_id = ? AND provider_account_id = ? AND idempotency_key = 'receipt-key'", args: [${JSON.stringify(binding.tenantId)}, ${JSON.stringify(binding.providerAccountId)}] }); console.log(JSON.stringify({ orders: orders.rows.length, receipts: receipts.rows.length })); client.close();`,
      ],
      { cwd: process.cwd() },
    );
    expect(JSON.parse(verification.stdout)).toEqual({ orders: 1, receipts: 1 });
  });

  it('creates nested database parents for direct seed and reset commands', async () => {
    const directory = join(tmpdir(), `phase002-cli-parent-${crypto.randomUUID()}`);
    const database = join(directory, 'nested', 'local.db');
    files.push(database, `${database}-shm`, `${database}-wal`);
    const environment = {
      ...process.env,
      APP_MODE: 'local',
      LOCAL_DEMO_DATABASE_URL: `file:${database}`,
      LOCAL_DEMO_CLIENT_DATABASE_URL: `file:${directory}/client.db`,
      LOCAL_FIXTURE_TENANT: binding.tenantId,
      LOCAL_FIXTURE_ACCOUNT: binding.providerAccountId,
    };

    await execFileAsync(process.execPath, ['scripts/local-fixtures.mjs', 'seed'], {
      cwd: process.cwd(),
      env: environment,
    });
    await access(database);

    const resetDatabase = join(directory, 'reset', 'local.db');
    files.push(resetDatabase, `${resetDatabase}-shm`, `${resetDatabase}-wal`);
    await execFileAsync(process.execPath, ['scripts/local-fixtures.mjs', 'reset'], {
      cwd: process.cwd(),
      env: {
        ...environment,
        LOCAL_DEMO_DATABASE_URL: `file:${resetDatabase}`,
      },
    });
    await access(resetDatabase);
    await rm(directory, { recursive: true, force: true });
  });

  it('uses one default relative database identity across the CLI and runtime cwd', async () => {
    const relative = `file:./phase002-cwd-${crypto.randomUUID()}.db`;
    const expected = resolveDatabaseUrl(relative, process.cwd());
    files.push(
      expected.replace('file://', ''),
      `${expected.replace('file://', '')}-shm`,
      `${expected.replace('file://', '')}-wal`,
    );
    expect(resolveDatabaseUrl(expected, join(process.cwd(), 'src/mastra/public'))).toBe(expected);
    await execFileAsync('npm', ['run', 'local:seed'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_MODE: 'local',
        DATABASE_URL: relative,
        LOCAL_DEMO_DATABASE_URL: relative,
        ORIGINAL_DATABASE_URL: `file:${join(tmpdir(), `phase002-external-${crypto.randomUUID()}.db`)}`,
        LOCAL_DEMO_FIXTURE_PROFILE: 'characterization',
        LOCAL_FIXTURE_TENANT: binding.tenantId,
        LOCAL_FIXTURE_ACCOUNT: binding.providerAccountId,
      },
    });
    const previous = process.env.DATABASE_URL;
    const previousLocal = process.env.LOCAL_DEMO_DATABASE_URL;
    const previousAppMode = process.env.APP_MODE;
    const previousOriginal = process.env.ORIGINAL_DATABASE_URL;
    process.env.DATABASE_URL = relative;
    process.env.LOCAL_DEMO_DATABASE_URL = relative;
    process.env.ORIGINAL_DATABASE_URL = `file:${join(tmpdir(), `phase002-external-${crypto.randomUUID()}.db`)}`;
    process.env.APP_MODE = 'local';
    try {
      const store = new CaseStore({ url: expected });
      const local = new LocalRuntime(store.getClient());
      await local.seed(binding);
      expect(await local.findOrder(binding, 'alex@example.com', 'ORD-1001')).toMatchObject({ orderId: 'ORD-1001' });
      await store.close();
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      if (previousLocal === undefined) delete process.env.LOCAL_DEMO_DATABASE_URL;
      else process.env.LOCAL_DEMO_DATABASE_URL = previousLocal;
      if (previousAppMode === undefined) delete process.env.APP_MODE;
      else process.env.APP_MODE = previousAppMode;
      if (previousOriginal === undefined) delete process.env.ORIGINAL_DATABASE_URL;
      else process.env.ORIGINAL_DATABASE_URL = previousOriginal;
    }
  });

  it('shares local commerce conformance through the optional loopback HTTP boundary', async () => {
    const { store, local } = await runtime();
    await local.seed(binding);
    const direct = await local.findOrder(binding, '', 'ORD-1001');
    const http = new LoopbackHttpCommerceProvider(createLocalLoopbackFacade(local));
    expect(await http.findOrder(binding, '', 'ORD-1001')).toEqual(direct);
    expect(await http.findSubscription(binding, 'alex@example.com')).toEqual(
      await local.findSubscription(binding, 'alex@example.com'),
    );
    expect(await http.refunds(binding, 'ORD-1001')).toEqual(await local.refunds(binding, 'ORD-1001'));
    const rateLimited = new LoopbackHttpCommerceProvider(createLocalLoopbackFacade(local, () => '429'));
    await expect(rateLimited.findOrder(binding, '', 'ORD-1001')).rejects.toThrow('429');
    const timeout = new LoopbackHttpCommerceProvider(
      createLocalLoopbackFacade(local, () => 'timeout'),
      5,
    );
    await expect(timeout.findOrder(binding, '', 'ORD-1001')).rejects.toThrow('timeout');
    await store.close();
  });

  it('keeps a scheduled local subscription active until its controlled effective time through direct and loopback commerce', async () => {
    const { store } = await runtime();
    let current = new Date('2026-08-31T23:59:59.000Z');
    const local = new LocalRuntime(store.getClient(), () => current);
    await local.seed(binding);
    await store.getClient().execute({
      sql: "UPDATE local_subscriptions SET cancel_at_period_end = 1, cancels_at = renews_at WHERE tenant_id = ? AND provider_account_id = ? AND subscription_id = 'SUB-1001'",
      args: [binding.tenantId, binding.providerAccountId],
    });
    const http = new LoopbackHttpCommerceProvider(createLocalLoopbackFacade(local));
    const before = {
      direct: await local.findSubscription(binding, 'alex@example.com'),
      loopback: await http.findSubscription(binding, 'alex@example.com'),
    };
    expect(before).toEqual({
      direct: expect.objectContaining({
        status: 'active',
        cancelAtPeriodEnd: true,
        cancelsAt: '2026-09-01T00:00:00.000Z',
      }),
      loopback: expect.objectContaining({
        status: 'active',
        cancelAtPeriodEnd: true,
        cancelsAt: '2026-09-01T00:00:00.000Z',
      }),
    });
    current = new Date('2026-09-01T00:00:00.000Z');
    const after = {
      direct: await local.findSubscription(binding, 'alex@example.com'),
      loopback: await http.findSubscription(binding, 'alex@example.com'),
    };
    expect(after).toEqual({
      direct: expect.objectContaining({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        cancelsAt: '2026-09-01T00:00:00.000Z',
      }),
      loopback: expect.objectContaining({
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        cancelsAt: '2026-09-01T00:00:00.000Z',
      }),
    });
    await store.close();
  });

  it('conforms through loopback HTTP for non-financial ports and refuses direct refund effects', async () => {
    const { store, local } = await runtime();
    await local.seed(binding);
    const server = await realLoopback(createLocalLoopbackFacade(local));
    const http = new LoopbackHttpProviderRegistry(server.fetch);
    const normalized = await http.support(binding).normalizeInbound({
      externalId: 'loopback-inbound',
      from: 'alex@example.com',
      body: 'A message through the HTTP boundary.',
    });
    expect(normalized).toMatchObject({
      externalId: 'loopback-inbound',
      customer: { email: 'alex@example.com' },
    });
    const directReceipt = await local.support(binding).deliver(binding, 'reply', 'resolved', 'loopback-receipt');
    expect(await http.support(binding).deliver(binding, 'reply', 'resolved', 'loopback-receipt')).toEqual(
      directReceipt,
    );
    await expect(
      http.support(binding).deliver(binding, 'altered reply', 'resolved', 'loopback-receipt'),
    ).rejects.toThrow('different content');
    expect(await http.knowledge(binding).search(binding, 'duplicate charge', 3)).toEqual(
      await local.search(binding, 'duplicate charge', 3),
    );
    expect(await http.knowledge(binding).fetchDocument(binding, 'duplicate-charge-policy')).toEqual(
      await local.fetchDocument(binding, 'duplicate-charge-policy'),
    );
    const command = await approvedCommand(store, 'loopback-drop', 100);
    expect(await http.transactions(binding).quoteRefund(command)).toEqual(await local.quoteRefund(command));
    await expect(http.transactions(binding).issueRefund(command)).rejects.toThrow(
      'missing or invalid native refund authorization',
    );
    expect(await local.refunds(binding, 'ORD-1001')).toEqual([]);
    await server.close();
    await store.close();
  });

  it('rejects malformed loopback delivery requests before invoking the provider', async () => {
    const { store, local } = await runtime();
    await local.seed(binding);
    let deliveriesAttempted = 0;
    const support = local.support(binding);
    const facade = createLocalLoopbackFacade({
      support: () => ({
        kind: 'local',
        normalizeInbound: support.normalizeInbound.bind(support),
        deliver: async (...args) => {
          deliveriesAttempted += 1;
          return support.deliver(...args);
        },
        addInternalNote: support.addInternalNote.bind(support),
        updateStatus: support.updateStatus.bind(support),
      }),
      commerce: () => local,
      transactions: () => local,
      knowledge: () => local,
    });
    const response = await facade(
      new Request('http://loopback/support/deliver', {
        body: JSON.stringify({
          binding,
          body: { not: 'a string' },
          status: 17,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );
    expect(response.status).toBe(400);
    expect(deliveriesAttempted).toBe(0);
    const deliveries = await store.getClient().execute('SELECT COUNT(*) AS total FROM local_deliveries');
    expect(deliveries.rows[0]).toMatchObject({ total: 0 });
    await store.close();
  });

  it('restarts claimable work but leaves suspended approvals untouched', async () => {
    const { store } = await runtime();
    const active = supportCase(`recovery-active-${crypto.randomUUID()}`);
    const suspended = supportCase(`recovery-suspended-${crypto.randomUUID()}`);
    suspended.status = 'waiting_approval';
    await store.acceptInbound(active, `event-${active.id}`, `run-${active.id}`);
    await store.acceptInbound(suspended, `event-${suspended.id}`, `run-${suspended.id}`);
    const restart = vi.fn().mockResolvedValue({ status: 'success' });
    const start = vi.fn().mockResolvedValue({ status: 'success' });
    await recoverLocalWorkflows(
      {
        getWorkflow: () => ({
          createRun: async () => ({ restart, start }),
          getWorkflowRunById: async (runId: string) =>
            runId === `run-${suspended.id}` ? { status: 'suspended' } : { status: 'running' },
        }),
      },
      10,
      store,
    );
    expect(restart).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    const dispatches = await store.getClient().execute({
      sql: 'SELECT case_id, state FROM support_dispatch WHERE case_id IN (?, ?)',
      args: [active.id, suspended.id],
    });
    expect(dispatches.rows).toContainEqual(expect.objectContaining({ case_id: active.id, state: 'completed' }));
    expect(dispatches.rows).toContainEqual(expect.objectContaining({ case_id: suspended.id, state: 'suspended' }));
    await store.close();
  });

  it('starts a dispatch that was persisted before its first workflow run instead of restarting a nonexistent run', async () => {
    const { store } = await runtime();
    const pending = supportCase(`recovery-pending-${crypto.randomUUID()}`);
    await store.acceptInbound(pending, `event-${pending.id}`, `run-${pending.id}`);
    const restart = vi.fn().mockResolvedValue({ status: 'success' });
    const start = vi.fn().mockResolvedValue({ status: 'success' });
    await recoverLocalWorkflows(
      {
        getWorkflow: () => ({
          createRun: async () => ({
            runId: `run-${pending.id}`,
            restart,
            start,
          }),
          getWorkflowRunById: async () => undefined,
        }),
      },
      10,
      store,
    );
    expect(start).toHaveBeenCalledWith({
      inputData: { caseId: pending.id, turnId: expect.any(String) },
    });
    expect(restart).not.toHaveBeenCalled();
    expect((await store.get(pending.id))?.workflowRunId).toBe(`run-${pending.id}`);
    await store.close();
  });

  it('recovers an active post-approval snapshot even if the durable case still says waiting', async () => {
    const { store } = await runtime();
    const pending = supportCase('post-approval');
    pending.status = 'waiting_approval';
    await store.acceptInbound(pending, 'post-approval-event', 'post-approval-run');
    const restart = vi.fn().mockResolvedValue({ status: 'success' });
    await recoverLocalWorkflows(
      {
        getWorkflow: () => ({
          createRun: async () => ({ restart }),
          getWorkflowRunById: async () => ({ status: 'running' }),
        }),
      },
      10,
      store,
    );
    expect(restart).toHaveBeenCalledOnce();
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state FROM support_dispatch WHERE case_id = ?',
          args: [pending.id],
        })
      ).rows[0],
    ).toMatchObject({ state: 'completed' });
    await store.close();
  });

  it('backfills a resumable dispatch for a migrated waiting approval case', async () => {
    const { store } = await runtime();
    const legacy = supportCase('legacy-resume');
    legacy.status = 'waiting_approval';
    legacy.workflowRunId = 'legacy-run';
    await store.create(legacy);
    const claim = await store.claimDispatchForResume(legacy.id, legacy.workflowRunId);
    expect(claim).toMatchObject({
      caseId: legacy.id,
      runId: 'legacy-run',
      state: 'claimed',
    });
    await store.close();
  });

  it('returns a bounded conflict when a resume dispatch was already advanced', async () => {
    const { store } = await runtime();
    const support = supportCase('resume-conflict');
    support.status = 'waiting_approval';
    await store.acceptInbound(support, 'resume-conflict-event', 'resume-run');
    await store.getClient().execute({
      sql: "UPDATE support_dispatch SET state = 'claimed' WHERE case_id = ?",
      args: [support.id],
    });
    await expect(store.claimDispatchForResume(support.id, 'resume-run')).resolves.toBeUndefined();
    await store.close();
  });

  it('retries returned workflow failures before durable escalation', async () => {
    const { store } = await runtime();
    const failed = supportCase('recovery-failure');
    await store.acceptInbound(failed, 'recovery-failure-event', 'recovery-failure-run');
    await recoverLocalWorkflows(
      {
        getWorkflow: () => ({
          createRun: async () => ({
            restart: async () => ({ status: 'failed' }),
          }),
          getWorkflowRunById: async () => ({ status: 'running' }),
        }),
      },
      10,
      store,
    );
    expect(await store.get(failed.id)).toMatchObject({ status: 'escalated' });
    expect(await store.turns(failed.id)).toContainEqual(
      expect.objectContaining({
        state: 'escalated',
        outcome: expect.objectContaining({
          operationalFailure: expect.objectContaining({
            disposition: 'escalate',
          }),
        }),
      }),
    );
    await store.close();
  });

  it('preserves classified snapshots and escalates after bounded recovery retries', async () => {
    const { path, store } = await runtime();
    const failedAfterClassification = supportCase('classified-failure');
    await store.acceptInbound(failedAfterClassification, 'classified-failure-event', 'classified-failure-run');
    const [classificationDispatch] = await store.claimDispatch();
    await store.activateDispatch(classificationDispatch!);
    const classified = await store.get(failedAfterClassification.id);
    await store.update(failedAfterClassification.id, {
      status: 'processing',
      triage: {
        intent: 'duplicate_charge',
        urgency: 'normal',
        sentiment: 'negative',
        requiresHumanReview: true,
        confidence: 1,
        rationale: 'synthetic classification',
      },
      draft: {
        draftResponse: 'A staff-visible draft.',
        citedSources: ['duplicate-charge-policy'],
        recommendRefund: true,
        refundAmount: 20,
        refundCurrency: 'USD',
        refundReason: 'duplicate',
        requiresEscalation: false,
      },
      metadata: {
        ...classified!.metadata,
        activeTurnId: classificationDispatch!.turnId,
      },
    });
    await store.recordTurnTelemetry(failedAfterClassification.id, classificationDispatch!.turnId, {
      traceId: 'trace-classified',
      workflowRunId: 'classified-failure-run',
    });
    await store.failDispatchAndCase(
      classificationDispatch!.id,
      failedAfterClassification.id,
      'injected failure after classification',
      classificationDispatch!.leaseToken,
    );

    const waitingApproval = supportCase('waiting-approval-follow-up');
    await store.acceptInbound(waitingApproval, 'waiting-approval-event', 'waiting-approval-run');
    const waitingTurn = (await store.turns(waitingApproval.id))[0]!;
    const waitingCurrent = await store.get(waitingApproval.id);
    await store.update(waitingApproval.id, {
      status: 'waiting_approval',
      draft: {
        draftResponse: 'A pending refund recommendation.',
        citedSources: ['duplicate-charge-policy'],
        recommendRefund: true,
        refundAmount: 20,
        refundCurrency: 'USD',
        refundReason: 'duplicate',
        requiresEscalation: false,
      },
      approval: { approved: true, approverId: 'approver-demo' },
      metadata: {
        ...waitingCurrent!.metadata,
        activeTurnId: waitingTurn.id,
      },
    });
    await store.recordTurnTelemetry(waitingApproval.id, waitingTurn.id, {
      traceId: 'trace-waiting',
      workflowRunId: 'waiting-approval-run',
    });
    await store.appendFollowUp({
      caseId: waitingApproval.id,
      eventId: 'waiting-approval-follow-up-event',
      runId: 'waiting-approval-follow-up-run',
      message: {
        id: 'waiting-approval-follow-up-message',
        author: 'customer',
        body: 'Please add this detail before approval.',
        createdAt: new Date().toISOString(),
      },
    });
    // The separate snapshot assertion intentionally leaves this real follow-up
    // pending; keep it out of the bounded recovery sweep below.
    await store.getClient().execute({
      sql: "UPDATE support_dispatch SET state = 'suspended' WHERE case_id = ? AND state = 'pending'",
      args: [waitingApproval.id],
    });

    const exhausted = supportCase('recovery-exhausted');
    await store.acceptInbound(exhausted, 'recovery-exhausted-event', 'recovery-exhausted-run');
    const failedWorkflow = {
      getWorkflow: () => ({
        createRun: async () => ({
          start: async () => {
            throw new Error('injected retryable provider failure');
          },
        }),
        getWorkflowRunById: async () => undefined,
      }),
    };
    await recoverLocalWorkflows(failedWorkflow, 3, store);
    expect(await store.get(exhausted.id)).toMatchObject({
      status: 'escalated',
      metadata: { workflowStatus: 'escalated' },
    });
    expect(await store.turns(exhausted.id)).toContainEqual(
      expect.objectContaining({
        state: 'escalated',
        outcome: expect.objectContaining({
          operationalFailure: expect.objectContaining({
            disposition: 'escalate',
          }),
        }),
      }),
    );
    // Recovery intentionally projects exhaustion as customer-visible
    // escalation. Its immutable operational failure must still reach the
    // workflow error counter rather than disappearing with the state change.
    await expect(store.monitoringOperationalFailures([exhausted.id])).resolves.toMatchObject({ workflow: 1 });
    await store.close();

    const reopened = new CaseStore({ url: `file:${path}` });
    await reopened.list();
    expect(await reopened.turn(failedAfterClassification.id, classificationDispatch!.turnId)).toMatchObject({
      state: 'failed',
      outcome: {
        telemetry: { traceId: 'trace-classified' },
        triage: { intent: 'duplicate_charge' },
        draft: { recommendRefund: true },
        escalationReason: 'injected failure after classification',
      },
    });
    expect(await reopened.turn(waitingApproval.id, waitingTurn.id)).toMatchObject({
      outcome: {
        telemetry: { traceId: 'trace-waiting' },
        draft: { recommendRefund: true },
        approval: { approved: true, approverId: 'approver-demo' },
      },
    });
    await reopened.close();
  });

  it('never fresh-starts a terminal Mastra snapshot', async () => {
    const { store } = await runtime();
    const terminal = supportCase('terminal-run');
    await store.acceptInbound(terminal, 'terminal-event', 'terminal-run-id');
    const start = vi.fn();
    const restart = vi.fn();
    await recoverLocalWorkflows(
      {
        getWorkflow: () => ({
          createRun: async () => ({ start, restart }),
          getWorkflowRunById: async () => ({ status: 'failed' }),
        }),
      },
      10,
      store,
    );
    expect(start).not.toHaveBeenCalled();
    expect(restart).not.toHaveBeenCalled();
    expect(await store.get(terminal.id)).toMatchObject({
      status: 'escalated',
      escalationReason: 'Workflow recovery failed: failed',
    });
    await store.close();
  });

  it('reclaims a delivery after an effect-before-receipt crash and reuses the provider receipt', async () => {
    const { store, local } = await runtime();
    await local.seed(binding);
    await store.enqueueDelivery({
      id: 'outbox-crash',
      caseId: 'case-crash',
      binding,
      body: 'We resolved your case.',
      status: 'resolved',
    });
    const [claimed] = await store.claimOutbox();
    const receipt = await local.support(binding).deliver(binding, claimed.body, claimed.status, claimed.id);
    await store.getClient().execute({
      sql: 'UPDATE support_outbox SET lease_until = ? WHERE id = ?',
      args: ['2000-01-01T00:00:00.000Z', claimed.id],
    });
    await deliverOutbox(local, 10, store);
    const persisted = await store.getClient().execute({
      sql: 'SELECT state, receipt FROM support_outbox WHERE id = ?',
      args: [claimed.id],
    });
    expect(persisted.rows[0]).toMatchObject({
      state: 'delivered',
      receipt: JSON.stringify(receipt),
    });
    await store.close();
  });

  it('replays identical delivery content atomically and rejects a conversation redirect', async () => {
    const { store, local } = await runtime();
    const support = local.support(binding);
    const first = await support.deliver(binding, 'reply', 'resolved', 'receipt-key');
    await expect(support.deliver(binding, 'reply', 'resolved', 'receipt-key')).resolves.toEqual(first);
    await expect(
      support.deliver({ ...binding, externalConversationId: 'other-conversation' }, 'reply', 'resolved', 'receipt-key'),
    ).rejects.toThrow('different content');
    await store.close();
  });

  it('keeps 429 delivery failures claimable while surfacing permanent 4xx failures', async () => {
    const { store, local } = await runtime();
    const support = local.support(binding);
    const registry = (message: string): ProviderRegistry => ({
      support: () => ({
        kind: 'local',
        normalizeInbound: support.normalizeInbound.bind(support),
        deliver: async () => {
          throw new Error(message);
        },
        addInternalNote: support.addInternalNote.bind(support),
        updateStatus: support.updateStatus.bind(support),
      }),
      commerce: () => local,
      transactions: () => local,
      knowledge: () => local,
    });
    await store.enqueueDelivery({
      id: 'outbox-429',
      caseId: 'case-429',
      binding,
      body: 'retry me',
      status: 'resolved',
    });
    await deliverOutbox(registry('Loopback HTTP 429'), 10, store);
    const after429 = await store.getClient().execute("SELECT state FROM support_outbox WHERE id = 'outbox-429'");
    expect(after429.rows[0]).toMatchObject({ state: 'pending' });
    await store.enqueueDelivery({
      id: 'outbox-400',
      caseId: 'case-400',
      binding,
      body: 'do not retry',
      status: 'resolved',
    });
    await deliverOutbox(registry('Loopback HTTP 400'), 10, store);
    const after400 = await store.getClient().execute("SELECT state FROM support_outbox WHERE id = 'outbox-400'");
    expect(after400.rows[0]).toMatchObject({ state: 'failed' });
    await store.close();
  });

  it('claims deliveries only when capacity is free and never delivers a terminal item from an old sweep', async () => {
    const { store, local } = await runtime();
    await local.seed(binding);
    const first = supportCase('batch-first');
    const second = supportCase('batch-second');
    await store.create(first);
    await store.create(second);
    await store.enqueueDelivery({
      id: 'batch-first-outbox',
      caseId: first.id,
      binding,
      body: 'first',
      status: 'resolved',
    });
    await store.enqueueDelivery({
      id: 'batch-second-outbox',
      caseId: second.id,
      binding,
      body: 'second',
      status: 'resolved',
    });
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let enteredFirst!: () => void;
    const firstEntered = new Promise<void>(resolve => {
      enteredFirst = resolve;
    });
    const localSupport = local.support(binding);
    const slowWorker: ProviderRegistry = {
      support: () => ({
        kind: 'local',
        normalizeInbound: localSupport.normalizeInbound.bind(localSupport),
        deliver: async (...args) => {
          if (args[3] === 'batch-first-outbox') {
            enteredFirst();
            await firstReleased;
          }
          return localSupport.deliver(...args);
        },
        addInternalNote: localSupport.addInternalNote.bind(localSupport),
        updateStatus: localSupport.updateStatus.bind(localSupport),
      }),
      commerce: () => local,
      transactions: () => local,
      knowledge: () => local,
    };
    const permanentFailure: ProviderRegistry = {
      ...slowWorker,
      support: () => ({
        kind: 'local',
        normalizeInbound: localSupport.normalizeInbound.bind(localSupport),
        deliver: async () => {
          throw new Error('Loopback HTTP 400 permanent');
        },
        addInternalNote: localSupport.addInternalNote.bind(localSupport),
        updateStatus: localSupport.updateStatus.bind(localSupport),
      }),
    };

    const oldSweep = deliverOutbox(slowWorker, 2, store);
    await firstEntered;
    // This assertion fails against the published batch-claim implementation:
    // it had already leased the second item while the first delivery waited.
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state, attempts FROM support_outbox WHERE id = ?',
          args: ['batch-second-outbox'],
        })
      ).rows[0],
    ).toMatchObject({ state: 'pending', attempts: 0 });

    await deliverOutbox(permanentFailure, 1, store);
    releaseFirst();
    await oldSweep;

    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state, attempts, receipt FROM support_outbox WHERE id = ?',
          args: ['batch-second-outbox'],
        })
      ).rows[0],
    ).toMatchObject({ state: 'failed', attempts: 1, receipt: null });
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT COUNT(*) AS count FROM local_deliveries WHERE idempotency_key = ?',
          args: ['batch-second-outbox'],
        })
      ).rows[0],
    ).toMatchObject({ count: 0 });
    expect((await store.get(second.id))?.metadata).toMatchObject({
      deliveryStatus: 'failed',
    });
    await store.close();
  });

  it('does not spend delivery retries more than once per bounded sweep', async () => {
    const { store, local } = await runtime();
    const first = supportCase('retry-first');
    const second = supportCase('retry-second');
    await store.create(first);
    await store.create(second);
    for (const [id, caseId] of [
      ['retry-first-outbox', first.id],
      ['retry-second-outbox', second.id],
    ])
      await store.enqueueDelivery({
        id,
        caseId,
        binding,
        body: id,
        status: 'resolved',
      });
    let calls = 0;
    const retryable: ProviderRegistry = {
      support: () => ({
        kind: 'local',
        normalizeInbound: async () => ({
          externalId: 'unused',
          conversationId: 'unused',
          customer: { email: 'unused@example.com' },
          subject: 'unused',
          body: 'unused',
        }),
        deliver: async () => {
          calls += 1;
          throw new Error('Loopback HTTP 500');
        },
        addInternalNote: async () => ({ id: 'unused' }),
        updateStatus: async () => ({ id: 'unused' }),
      }),
      commerce: () => local,
      transactions: () => local,
      knowledge: () => local,
    };
    expect(await deliverOutbox(retryable, 2, store)).toBe(2);
    expect(calls).toBe(2);
    expect(
      (
        await store
          .getClient()
          .execute(
            "SELECT attempts FROM support_outbox WHERE id IN ('retry-first-outbox', 'retry-second-outbox') ORDER BY id",
          )
      ).rows,
    ).toEqual([{ attempts: 1 }, { attempts: 1 }]);
    await store.close();
  });

  it('claims recovery dispatches only when a run can start and revalidates ownership before start', async () => {
    const { store } = await runtime();
    const first = supportCase('recovery-first');
    const second = supportCase('recovery-second');
    await store.acceptInbound(first, 'recovery-first-event', 'recovery-first-run');
    await store.acceptInbound(second, 'recovery-second-event', 'recovery-second-run');
    // The two inserts can share a millisecond.  Make the capacity assertion
    // independent of UUID ordering when the recovery queue breaks that tie.
    await store.getClient().execute({
      sql: 'UPDATE support_dispatch SET created_at = ? WHERE case_id = ?',
      args: ['2026-09-05T00:00:00.000Z', first.id],
    });
    await store.getClient().execute({
      sql: 'UPDATE support_dispatch SET created_at = ? WHERE case_id = ?',
      args: ['2026-09-05T00:00:01.000Z', second.id],
    });
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let enteredFirst!: () => void;
    const firstEntered = new Promise<void>(resolve => {
      enteredFirst = resolve;
    });
    const starts: string[] = [];
    const worker = {
      getWorkflow: () => ({
        getWorkflowRunById: async () => undefined,
        createRun: async ({ runId }: { runId: string }) => ({
          runId,
          start: async () => {
            starts.push(runId);
            if (runId === 'recovery-first-run') {
              enteredFirst();
              await firstReleased;
            }
            return { status: 'success' };
          },
          restart: async () => ({ status: 'success' }),
          cancel: async () => ({ message: 'cancelled' }),
        }),
      }),
    };
    const oldSweep = recoverLocalWorkflows(worker, 2, store);
    await firstEntered;
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state, attempts FROM support_dispatch WHERE case_id = ?',
          args: [second.id],
        })
      ).rows[0],
    ).toMatchObject({ state: 'pending', attempts: 0 });
    await recoverLocalWorkflows(worker, 1, store);
    releaseFirst();
    await oldSweep;
    expect(starts.sort()).toEqual(['recovery-first-run', 'recovery-second-run']);

    const revoked = supportCase('recovery-revoked');
    await store.acceptInbound(revoked, 'recovery-revoked-event', 'recovery-revoked-run');
    const start = vi.fn(async () => ({ status: 'success' }));
    await recoverLocalWorkflows(
      {
        getWorkflow: () => ({
          getWorkflowRunById: async () => {
            await store.getClient().execute({
              sql: 'UPDATE support_dispatch SET lease_token = ?, lease_until = ? WHERE case_id = ?',
              args: ['new-owner', '2099-01-01T00:00:00.000Z', revoked.id],
            });
            return undefined;
          },
          createRun: async ({ runId }: { runId: string }) => ({
            runId,
            start,
            restart: start,
            cancel: async () => ({ message: 'cancelled' }),
          }),
        }),
      },
      1,
      store,
    );
    expect(start).not.toHaveBeenCalled();
    expect((await store.get(revoked.id))?.workflowRunId).toBeUndefined();
    await store.close();
  });

  it('fences stale leases, renews healthy claims, and visibly fails exhausted abandoned work', async () => {
    const { store } = await runtime();
    await store.create(supportCase('fenced-case'));
    await store.enqueueDelivery({
      id: 'fenced',
      caseId: 'fenced-case',
      binding,
      body: 'reply',
      status: 'resolved',
    });
    const [first] = await store.claimOutbox();
    expect(await store.renewOutboxLease(first.id, first.leaseToken!)).toBe(true);
    await store.getClient().execute({
      sql: 'UPDATE support_outbox SET lease_until = ? WHERE id = ?',
      args: ['2000-01-01T00:00:00.000Z', first.id],
    });
    const [second] = await store.claimOutbox();
    await store.completeOutbox(first.id, { stale: true }, first.leaseToken);
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state FROM support_outbox WHERE id = ?',
          args: [first.id],
        })
      ).rows[0],
    ).toMatchObject({ state: 'claimed' });
    await store.retryOutbox(second.id, 'crash', false, second.leaseToken);
    const [third] = await store.claimOutbox();
    await store.getClient().execute({
      sql: 'UPDATE support_outbox SET lease_until = ? WHERE id = ?',
      args: ['2000-01-01T00:00:00.000Z', third.id],
    });
    await store.claimOutbox();
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state, last_error FROM support_outbox WHERE id = ?',
          args: [first.id],
        })
      ).rows[0],
    ).toMatchObject({ state: 'failed' });
    expect((await store.get('fenced-case'))?.metadata).toMatchObject({
      deliveryStatus: 'failed',
    });
    await store.close();
  });

  it('does not let a stale terminal outbox retry overwrite a delivered case projection', async () => {
    const { store } = await runtime();
    await store.create(supportCase('stale-delivery-case'));
    await store.enqueueDelivery({
      id: 'stale-delivery',
      caseId: 'stale-delivery-case',
      binding,
      body: 'reply',
      status: 'resolved',
    });
    const [claim] = await store.claimOutbox();
    await store.completeOutbox(claim.id, { receipt: 'current' }, claim.leaseToken);
    await expect(store.retryOutbox(claim.id, 'stale failed', true, claim.leaseToken)).resolves.toBe(false);
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state FROM support_outbox WHERE id = ?',
          args: [claim.id],
        })
      ).rows[0],
    ).toMatchObject({ state: 'delivered' });
    expect((await store.get('stale-delivery-case'))?.metadata).not.toMatchObject({
      deliveryStatus: 'failed',
    });
    await store.close();
  });

  it('does not let a stale dispatch failure overwrite the current lease owner case', async () => {
    const { store } = await runtime();
    const support = supportCase('stale-dispatch-case');
    await store.acceptInbound(support, 'stale-dispatch-event', 'stale-run');
    const [first] = await store.claimDispatch();
    await store.getClient().execute({
      sql: 'UPDATE support_dispatch SET lease_until = ? WHERE id = ?',
      args: ['2000-01-01T00:00:00.000Z', first.id],
    });
    await expect(
      store.failDispatchAndCase(first.id, support.id, 'expired worker failed', first.leaseToken),
    ).resolves.toBe(false);
    expect((await store.get(support.id))?.status).toBe('new');
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state FROM support_dispatch WHERE id = ?',
          args: [first.id],
        })
      ).rows[0],
    ).toMatchObject({ state: 'claimed' });
    const [second] = await store.claimDispatch();
    await expect(
      store.failDispatchAndCase(first.id, support.id, 'stale worker failed', first.leaseToken),
    ).resolves.toBe(false);
    expect((await store.get(support.id))?.status).toBe('new');
    expect(
      (
        await store.getClient().execute({
          sql: 'SELECT state, lease_token FROM support_dispatch WHERE id = ?',
          args: [first.id],
        })
      ).rows[0],
    ).toMatchObject({ state: 'claimed', lease_token: second.leaseToken });
    await store.close();
  });

  it('uses currency-specific decimal exponents at the legacy boundary', () => {
    expect(legacyAmountToMoney(100, 'JPY')).toEqual({
      currency: 'JPY',
      minor: 100,
    });
    expect(legacyAmountToMoney(1.23, 'KWD')).toEqual({
      currency: 'KWD',
      minor: 1230,
    });
    expect(moneyToLegacyAmount({ currency: 'KWD', minor: 1230 })).toBe(1.23);
    expect(() => legacyAmountToMoney(1, 'ZZZ')).toThrow('Unsupported currency precision');
  });

  it('rejects malformed HTTP provider results before they reach persisted effects', async () => {
    const malformed = new LoopbackHttpCommerceProvider(async () =>
      Response.json({
        orderId: 'ORD',
        customerEmail: 'a@example.com',
        product: 'x',
        amount: { currency: '???', minor: 0.5 },
        status: 'fulfilled',
        chargeCount: 1,
        placedAt: 'not-a-date',
      }),
    );
    await expect(malformed.findOrder(binding, '', 'ORD')).rejects.toThrow();
  });

  it('rejects malformed support normalization and knowledge-list HTTP responses', async () => {
    const malformed = new LoopbackHttpProviderRegistry(async request => {
      if (request.url.endsWith('/support/normalize'))
        return Response.json({
          binding,
          externalId: 'event',
          source: 'mock-email',
          customer: { email: 'alex@example.com' },
          subject: 'missing message and raw payload',
        });
      return Response.json([{ source: 'policy', version: 'v1' }]);
    });
    await expect(malformed.support(binding).normalizeInbound({ externalId: 'event' })).rejects.toThrow();
    await expect(malformed.knowledge(binding).listChanged(binding)).rejects.toThrow();
  });
});
