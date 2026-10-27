import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { it } from 'vitest';
import { invoiceInput } from './helpers/invoice.ts';
import type { InvoiceResult } from '../src/mastra/invoice/schema.ts';

const exec = promisify(execFile);
const localDirectory = resolve('.local/tests');

type Bill = {
  Id: string;
  DocNumber: string;
  VendorRef: { value: string };
  CurrencyRef: { value: string };
  TotalAmt: number;
  Line: Array<{
    Amount: number;
    AccountBasedExpenseLineDetail: { AccountRef: { value: string } };
    LinkedTxn?: Array<{ TxnLineId: string }>;
  }>;
  LinkedTxn: Array<{ TxnId: string }>;
};
type WireState = {
  vendors: Array<{ Id: string; DisplayName: string; Active: boolean }>;
  orders: unknown[];
  bills: Bill[];
  calls: Array<{ name: string; writeDisabled: string }>;
  errorTool?: string;
  missingTool?: string;
};

async function scenario(options: { state?: Partial<WireState>; env?: Record<string, string> } = {}) {
  await mkdir(localDirectory, { recursive: true });
  const directory = await mkdtemp(join(localDirectory, 'workflow-'));
  const statePath = join(directory, 'qbo.json');
  await writeFile(
    statePath,
    JSON.stringify({
      vendors: [{ Id: 'vendor-1', DisplayName: 'AP Sandbox Vendor', Active: true }],
      orders: [
        {
          Id: 'po-1',
          DocNumber: 'AP-PO-1001',
          VendorRef: { value: 'vendor-1' },
          CurrencyRef: { value: 'USD' },
          TotalAmt: 100,
          Line: [
            {
              Id: '1',
              Amount: 100,
              Description: 'Pens',
              ItemBasedExpenseLineDetail: { ItemRef: { value: 'item-1' }, Qty: 10, UnitPrice: 10 },
            },
          ],
        },
      ],
      bills: [],
      calls: [],
      ...options.state,
    }),
  );
  const env = {
    ...process.env,
    QBO_MCP_SERVER_PATH: resolve('test/fixtures/quickbooks-mcp.mjs'),
    QBO_MCP_TOKEN_STORE_PATH: statePath,
    QBO_MCP_ENABLE_POSTING: 'true',
    QBO_MCP_SINGLE_WRITER: 'true',
    QBO_MCP_EXPENSE_ACCOUNT_ID: 'expense-1',
    QBO_MCP_TAX_ACCOUNT_ID: '',
    QBO_MCP_AP_ACCOUNT_ID: '',
    QBO_MCP_POSTING_LOCK_DIR: join(directory, 'locks'),
    AP_ALLOW_UNSCREENED_VENDORS: 'true',
    AP_APPROVAL_THRESHOLD_MINOR: '100000',
    AP_AMOUNT_TOLERANCE_MINOR: '1',
    AP_LOW_CONFIDENCE_THRESHOLD: '0.8',
    MASTRA_DB_URL: `file:${join(directory, 'mastra.db')}`,
    MASTRA_TELEMETRY_DISABLED: '1',
    ...options.env,
  };
  return {
    async run(operation: Record<string, unknown> = {}) {
      const { stdout } = await exec(
        process.execPath,
        ['--experimental-strip-types', 'test/helpers/workflow-runner.ts', JSON.stringify(operation)],
        { env, timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
      );
      const serialized = stdout.split('\n').find(line => line.startsWith('AP_RESULT:'));
      assert.ok(serialized, stdout);
      return JSON.parse(serialized.slice('AP_RESULT:'.length)) as {
        runId: string;
        status: string;
        result?: InvoiceResult;
        disposition?: string;
        invoiceNumber?: string;
        vendorName?: string;
        currency?: string;
        totalMinor?: number;
        invoiceDigest?: string;
        approvalPending?: boolean;
        reasons?: Array<{ code: string; message: string }>;
      };
    },
    async state(): Promise<WireState> {
      return JSON.parse(await readFile(statePath, 'utf8'));
    },
    async updateState(changes: Partial<WireState>) {
      const current = JSON.parse(await readFile(statePath, 'utf8'));
      await writeFile(statePath, JSON.stringify({ ...current, ...changes }));
    },
    async close() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

it('posts through real MCP stdio and prevents replay after restarting the workflow process', async () => {
  const test = await scenario();
  try {
    const first = await test.run();
    assert.equal(first.result?.executionStatus, 'posted');
    const replay = await test.run();
    assert.equal(replay.result?.disposition, 'review');
    assert.equal(replay.result?.executionStatus, 'not_postable');
    const state = await test.state();
    assert.equal(state.bills.length, 1);
    const bill = state.bills[0]!;
    assert.equal(bill.DocNumber, 'AP-TEST-1001');
    assert.equal(bill.VendorRef.value, 'vendor-1');
    assert.equal(bill.CurrencyRef.value, 'USD');
    assert.equal(bill.TotalAmt, 100);
    assert.equal(bill.Line[0]?.AccountBasedExpenseLineDetail.AccountRef.value, 'expense-1');
    assert.equal(bill.LinkedTxn[0]?.TxnId, 'po-1');
    assert.equal(state.calls.filter(call => call.name === 'create-bill').length, 1);
  } finally {
    await test.close();
  }
});

it('persists suspension and only posts after approval in a new process; rejection creates no Bill', async () => {
  for (const approved of [true, false]) {
    const test = await scenario({ env: { AP_APPROVAL_THRESHOLD_MINOR: '9999' } });
    try {
      const pending = await test.run();
      assert.equal(pending.status, 'suspended');
      assert.equal((await test.state()).bills.length, 0);
      const resumed = await test.run({ runId: pending.runId, approved });
      assert.equal(resumed.status, 'success');
      assert.equal(resumed.result?.executionStatus, approved ? 'posted' : 'rejected');
      assert.equal(resumed.result?.approval.status, approved ? 'approved' : 'rejected');
      assert.equal((await test.state()).bills.length, approved ? 1 : 0);
    } finally {
      await test.close();
    }
  }
});

it('never posts blocked, review, low-confidence, read-only or unavailable-provider invoices', async () => {
  const cases = [
    { name: 'read-only', env: { QBO_MCP_ENABLE_POSTING: 'false' }, status: 'posting_unavailable' },
    { name: 'screening required', env: { AP_ALLOW_UNSCREENED_VENDORS: 'false' }, disposition: 'review' },
    { name: 'missing vendor', state: { vendors: [] }, disposition: 'review' },
    {
      name: 'inactive vendor',
      state: { vendors: [{ Id: 'vendor-1', DisplayName: 'AP Sandbox Vendor', Active: false }] },
      disposition: 'blocked',
    },
    { name: 'missing PO', state: { orders: [] }, disposition: 'review' },
    { name: 'PO mismatch', invoice: { total: 101, subtotal: 101, lines: [{ sku: 'item-1', description: 'Pens', qty: 10, unitPrice: 10.1, lineTotal: 101 }] }, disposition: 'review' },
    { name: 'no printed PO', invoice: { poNumber: null }, disposition: 'review' },
    { name: 'low confidence', invoice: { overallConfidence: 0.5 }, disposition: 'verify_extraction' },
    { name: 'missing confidence', invoice: { confidence: [] }, disposition: 'verify_extraction' },
    { name: 'provider error', state: { errorTool: 'search_vendors' }, disposition: 'retry' },
    { name: 'missing MCP tool', state: { missingTool: 'search_bills' }, disposition: 'retry' },
  ];
  for (const entry of cases) {
    const test = await scenario(entry as Parameters<typeof scenario>[0]);
    try {
      const result = await test.run({ invoice: 'invoice' in entry ? entry.invoice : undefined });
      assert.equal(result.status, 'success', entry.name);
      if (entry.disposition) assert.equal(result.result?.disposition, entry.disposition, entry.name);
      assert.equal(result.result?.executionStatus, entry.status ?? 'not_postable', entry.name);
      const state = await test.state();
      assert.equal(state.bills.length, 0, entry.name);
      assert.equal(
        state.calls.some(call => call.name === 'create-bill'),
        false,
        entry.name,
      );
      if (entry.name === 'read-only') assert.ok(state.calls.every(call => call.writeDisabled === 'true'));
    } finally {
      await test.close();
    }
  }
});

it('treats the approval limit and PO tolerance boundaries consistently', async () => {
  for (const [threshold, total, expected] of [
    ['10000', 100, 'posted'],
    ['10000', 100.01, 'suspended'],
    ['10000', 100.02, 'not_postable'],
  ] as const) {
    const test = await scenario({ env: { AP_APPROVAL_THRESHOLD_MINOR: threshold } });
    try {
      const result = await test.run({
        invoice: {
          total,
          subtotal: total,
          lines: [{ sku: 'item-1', description: 'Pens', qty: 10, unitPrice: total / 10, lineTotal: total }],
        },
      });
      assert.equal(result.status === 'suspended' ? 'suspended' : result.result?.executionStatus, expected);
      assert.equal((await test.state()).bills.length, expected === 'posted' ? 1 : 0);
    } finally {
      await test.close();
    }
  }
});

it('posts tax to the configured account and fails closed when the tax account is absent', async () => {
  for (const taxAccount of ['', 'tax-expense-1']) {
    const test = await scenario({
      env: { QBO_MCP_TAX_ACCOUNT_ID: taxAccount },
      state: {
        orders: [
          {
            Id: 'po-1',
            DocNumber: 'AP-PO-1001',
            VendorRef: { value: 'vendor-1' },
            CurrencyRef: { value: 'USD' },
            TotalAmt: 108,
            Line: [
              {
                Id: '1',
                Amount: 100,
                Description: 'Pens',
                ItemBasedExpenseLineDetail: { ItemRef: { value: 'item-1' }, Qty: 10, UnitPrice: 10 },
              },
            ],
          },
        ],
      },
    });
    try {
      const result = await test.run({ invoice: { tax: 8, total: 108 } });
      assert.equal(result.result?.executionStatus, taxAccount ? 'posted' : 'posting_failed');
      const state = await test.state();
      assert.equal(state.bills.length, taxAccount ? 1 : 0);
      if (taxAccount) {
        const bill = state.bills[0]!;
        assert.equal(bill.TotalAmt, 108);
        assert.deepEqual(
          bill.Line.map(line => [line.Amount, line.AccountBasedExpenseLineDetail.AccountRef.value]),
          [
            [100, 'expense-1'],
            [8, taxAccount],
          ],
        );
      } else {
        assert.match(result.result?.postingError ?? '', /QBO_MCP_TAX_ACCOUNT_ID/);
        assert.equal(
          state.calls.some(call => call.name === 'create-bill'),
          false,
        );
      }
    } finally {
      await test.close();
    }
  }
});

it('refuses a forged workflow submission before any accounting operation', async () => {
  const test = await scenario();
  try {
    const result = await test.run({ invalidSignature: true });
    assert.equal(result.status, 'failed');
    assert.deepEqual((await test.state()).calls, []);
  } finally {
    await test.close();
  }
});

it('links reordered invoice lines to their actual PO line IDs', async () => {
  const test = await scenario({
    state: {
      orders: [
        {
          Id: 'po-1',
          DocNumber: 'AP-PO-1001',
          VendorRef: { value: 'vendor-1' },
          CurrencyRef: { value: 'USD' },
          TotalAmt: 100,
          Line: [
            {
              Id: '7',
              Amount: 40,
              Description: 'Pens',
              ItemBasedExpenseLineDetail: { ItemRef: { value: 'item-a' }, Qty: 1, UnitPrice: 40 },
            },
            {
              Id: '42',
              Amount: 60,
              Description: 'Paper',
              ItemBasedExpenseLineDetail: { ItemRef: { value: 'item-b' }, Qty: 1, UnitPrice: 60 },
            },
          ],
        },
      ],
    },
  });
  try {
    const result = await test.run({
      invoice: {
        lines: [
          { sku: 'item-b', description: 'Paper', qty: 1, unitPrice: 60, lineTotal: 60 },
          { sku: 'item-a', description: 'Pens', qty: 1, unitPrice: 40, lineTotal: 40 },
        ],
        confidence: [...invoiceInput().extractedResult.confidence, { field: 'lines', confidence: 0.99 }],
      },
    });
    assert.equal(result.result?.executionStatus, 'posted');
    const state = await test.state();
    assert.deepEqual(
      state.bills[0]!.Line.map(line => line.LinkedTxn?.[0]?.TxnLineId),
      ['42', '7'],
    );
  } finally {
    await test.close();
  }
});

it('does not post after approval if the external PO changed or lost its line identity', async () => {
  for (const change of ['changed', 'missing', 'missing-line-id']) {
    const test = await scenario({ env: { AP_APPROVAL_THRESHOLD_MINOR: '9999' } });
    try {
      const pending = await test.run();
      assert.equal(pending.status, 'suspended');
      const state = await test.state();
      const order = state.orders[0] as { TotalAmt: number; Line: Array<{ Id?: string }> };
      if (change === 'changed') order.TotalAmt = 200;
      if (change === 'missing-line-id') delete order.Line[0]!.Id;
      await test.updateState({ orders: change === 'missing' ? [] : state.orders });
      const resumed = await test.run({ runId: pending.runId, approved: true });
      assert.equal(resumed.result?.executionStatus, 'posting_failed', change);
      assert.equal((await test.state()).bills.length, 0, change);
      assert.equal(
        (await test.state()).calls.some(call => call.name === 'create-bill'),
        false,
        change,
      );
    } finally {
      await test.close();
    }
  }
});

// PR #28532, CodeRabbit 4383787296: malformed extraction stays a review result, not a tool exception.
it('returns structured extraction review for incomplete or inconsistent invoice drafts', async () => {
  const test = await scenario();
  try {
    for (const invoice of [{ invoiceNumber: null }, { invoiceDate: '2026-02-30' }, { total: 101 }]) {
      const result = await test.run({ tool: true, invoice });
      assert.equal(result.status, 'needs_extraction_review');
      assert.equal(result.disposition, 'verify_extraction');
      assert.ok(result.reasons?.every(reason => reason.code === 'EXTRACTION_VALIDATION_FAILED'));
      assert.ok(result.reasons?.length);
    }
    assert.deepEqual((await test.state()).calls, []);
  } finally {
    await test.close();
  }
});

// PR #28532, CodeRabbit 4383787281: approval must expose authoritative invoice identity and amount.
it('preserves invoice identity, amount and digest in the real approval tool response', async () => {
  const test = await scenario({ env: { AP_APPROVAL_THRESHOLD_MINOR: '9999' } });
  try {
    const result = await test.run({ tool: true });
    assert.equal(result.approvalPending, true);
    assert.equal(result.invoiceNumber, 'AP-TEST-1001');
    assert.equal(result.vendorName, 'AP Sandbox Vendor');
    assert.equal(result.currency, 'USD');
    assert.equal(result.totalMinor, 10000);
    assert.match(result.invoiceDigest ?? '', /^[a-f0-9]{64}$/);
    assert.equal((await test.state()).bills.length, 0);
  } finally {
    await test.close();
  }
});

// PR #28532, CodeRabbit 4383787324: equal descriptions cannot override distinct SKU identities.
it('matches identical descriptions by SKU and refuses a conflicting SKU before linking a Bill', async () => {
  for (const sku of ['item-b', 'item-c']) {
    const test = await scenario({
      state: {
        orders: [
          {
            Id: 'po-1',
            DocNumber: 'AP-PO-1001',
            VendorRef: { value: 'vendor-1' },
            CurrencyRef: { value: 'USD' },
            TotalAmt: 100,
            Line: ['a', 'b'].map(id => ({
              Id: `line-${id}`,
              Description: 'Pens',
              Amount: 50,
              ItemBasedExpenseLineDetail: { ItemRef: { value: `item-${id}` }, Qty: 1, UnitPrice: 50 },
            })),
          },
        ],
      },
    });
    try {
      const result = await test.run({
        invoice: {
          lines: [
            { sku, description: 'Pens', qty: 1, unitPrice: 50, lineTotal: 50 },
            { sku: 'item-a', description: 'Pens', qty: 1, unitPrice: 50, lineTotal: 50 },
          ],
          confidence: [...invoiceInput().extractedResult.confidence, { field: 'lines', confidence: 0.99 }],
        },
      });
      const state = await test.state();
      if (sku === 'item-b') {
        assert.equal(result.result?.executionStatus, 'posted');
        assert.deepEqual(
          state.bills[0]?.Line.map(line => line.LinkedTxn?.[0]?.TxnLineId),
          ['line-b', 'line-a'],
        );
      } else {
        assert.equal(result.result?.disposition, 'review');
        assert.equal(state.bills.length, 0);
      }
    } finally {
      await test.close();
    }
  }
});

// PR #28532, CodeRabbit 4383787373: a local history write must not erase an external success.
it('retains the posted Bill receipt when local history persistence fails', async () => {
  const test = await scenario();
  try {
    const result = await test.run({ historyFailure: true });
    assert.equal(result.result?.executionStatus, 'posted');
    assert.equal(result.result?.posting?.externalBillId, 'bill-1');
    assert.match(result.result?.postingError ?? '', /history.*failed/i);
    assert.match(result.result?.postingError ?? '', /ENOTDIR/);
    assert.equal((await test.state()).bills.length, 1);
    await test.run();
    assert.equal((await test.state()).bills.length, 1);
  } finally {
    await test.close();
  }
});
