import 'dotenv/config';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { it } from 'node:test';
import { promisify } from 'node:util';
import { parse } from 'dotenv';
import { MCPClient } from '@mastra/mcp';
import { createObservabilityContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { noopObserve } from '@mastra/core/tools';
import type { InvoiceResult } from '../src/mastra/invoice/schema.ts';

const exec = promisify(execFile);

type Row = Record<string, any>;
const records = (result: unknown): Row[] => {
  const response = result as { isError?: boolean; content: Array<{ type: string; text?: string }> };
  const texts = response.content.filter(item => item.type === 'text').map(item => item.text ?? '');
  assert.notEqual(response.isError, true, 'MCP returned an error');
  assert.ok(!texts.some(text => /^Error /i.test(text)), 'QuickBooks operation failed');
  return texts.flatMap(text => {
    if (
      /^Found \d+ .+:$/i.test(text.trim()) ||
      /^Count:\s*\d+$/.test(text.trim()) ||
      /^(Purchase order|Item) created successfully:$/.test(text.trim())
    )
      return [];
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [value];
  });
};

it(
  'verifies the real Intuit MCP and posting lifecycle in an explicitly dedicated sandbox',
  { timeout: 600000 },
  async () => {
    const required = [
      'QBO_MCP_SERVER_PATH',
      'QBO_MCP_TOKEN_STORE_PATH',
      'QBO_MCP_EXPENSE_ACCOUNT_ID',
      'QBO_MCP_TAX_ACCOUNT_ID',
      'QBO_TEST_REALM_ID',
    ];
    const missing = required.filter(name => !process.env[name]?.trim());
    assert.equal(
      missing.length,
      0,
      `Missing live sandbox configuration: ${missing.join(', ')}. See CONTRIBUTING.md; this suite never skips missing credentials.`,
    );
    assert.equal(
      process.env.QBO_TEST_ALLOW_WRITES,
      'true',
      'Set QBO_TEST_ALLOW_WRITES=true only for a dedicated sandbox company',
    );
    for (const name of ['QBO_MCP_SERVER_PATH', 'QBO_MCP_TOKEN_STORE_PATH'])
      assert.ok(isAbsolute(process.env[name]!), `${name} must be absolute`);
    const credentials = parse(await readFile(process.env.QBO_MCP_TOKEN_STORE_PATH!));
    assert.equal(credentials.QUICKBOOKS_ENVIRONMENT, 'sandbox', 'Live tests refuse production');
    assert.equal(
      credentials.QUICKBOOKS_REALM_ID,
      process.env.QBO_TEST_REALM_ID,
      'Sandbox realm acknowledgement must match the connected company',
    );
    for (const name of ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET', 'QUICKBOOKS_REFRESH_TOKEN'])
      assert.ok(credentials[name]?.trim(), `Missing ${name} in token store`);

    const prefix = `AP${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
    const directory = resolve('.local/integration', prefix);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const evidence = {
      prefix,
      checks: [] as string[],
      created: [] as Array<{ entity: string; id: string; number?: string }>,
    };
    const saveEvidence = () =>
      writeFile(join(directory, 'evidence.json'), JSON.stringify(evidence, null, 2), { mode: 0o600 });
    const record = async (entity: string, row: Row) => {
      assert.ok(row.Id, `${entity} returned no ID`);
      evidence.created.push({ entity, id: row.Id, number: row.DocNumber });
      await saveEvidence();
      return row;
    };
    const client = new MCPClient({
      id: `ap-live-${prefix}`,
      timeout: 60000,
      servers: {
        quickbooks: {
          command: process.execPath,
          args: [process.env.QBO_MCP_SERVER_PATH!],
          env: {
            QUICKBOOKS_TOKEN_STORE_PATH: process.env.QBO_MCP_TOKEN_STORE_PATH!,
            QUICKBOOKS_DISABLE_WRITE: 'false',
            QUICKBOOKS_DISABLE_UPDATE: 'true',
            QUICKBOOKS_DISABLE_DELETE: 'true',
          },
        },
      },
    });
    try {
      const tools = await client.listTools();
      for (const name of [
        'search_vendors',
        'search_purchase_orders',
        'search_bills',
        'create-bill',
        'get-bill',
        'search_accounts',
        'create-vendor',
        'create_item',
        'create_purchase_order',
      ]) {
        const tool = tools[`quickbooks_${name}`];
        assert.ok(tool?.inputSchema && tool.execute, `Missing tool/schema: ${name}`);
      }
      evidence.checks.push('Real MCP stdio discovery and tool schemas');
      const call = async (name: string, params: Row) => {
        const tool = tools[`quickbooks_${name}`];
        assert.ok(tool?.execute, `Missing tool ${name}`);
        return records(
          await tool.execute(
            { params },
            { ...createObservabilityContext(), observe: noopObserve, requestContext: new RequestContext() },
          ),
        );
      };
      const accounts = await call('search_accounts', { criteria: { fetchAll: true } });
      for (const [name, type] of [
        ['QBO_MCP_EXPENSE_ACCOUNT_ID', 'Expense'],
        ['QBO_MCP_TAX_ACCOUNT_ID', 'Expense'],
      ] as const) {
        assert.ok(
          accounts.some(
            account => account.Id === process.env[name] && account.Active !== false && account.AccountType === type,
          ),
          `${name} must identify an active ${type} account`,
        );
      }
      const income = accounts.find(account => account.Active !== false && account.AccountType === 'Income');
      assert.ok(income, 'Sandbox must have an active Income account for the test item');
      let vendor = await record(
        'Vendor',
        (await call('create-vendor', { vendor: { DisplayName: `${prefix} Vendor` } }))[0]!,
      );
      const item = await record(
        'Item',
        (
          await call('create_item', {
            name: `${prefix} Pens`,
            type: 'Service',
            income_account_ref: income.Id,
            expense_account_ref: process.env.QBO_MCP_EXPENSE_ACCOUNT_ID,
            unit_price: 10,
          })
        )[0]!,
      );
      let po = await record(
        'PurchaseOrder',
        (
          await call('create_purchase_order', {
            vendor_ref: vendor.Id,
            doc_number: `${prefix}PO`,
            txn_date: '2026-10-26',
            line_items: [{ item_ref: item.Id, qty: 10, unit_price: 10, description: 'Pens' }],
          })
        )[0]!,
      );
      let invoice = {
        vendorName: vendor.DisplayName,
        poNumber: po.DocNumber,
        lines: [{ sku: item.Id, description: 'Pens', qty: 10, unitPrice: 10, lineTotal: 100 }],
      };
      const state = { runId: '', invoiceNumber: '' };
      const run = async (label: string, env: Record<string, string> = {}, resume?: boolean) => {
        const invoiceNumber = resume === undefined ? `${prefix}${label}` : state.invoiceNumber;
        const operation =
          resume === undefined ? { invoice: { ...invoice, invoiceNumber } } : { runId: state.runId, approved: resume };
        const { stdout } = await exec(
          process.execPath,
          ['--experimental-strip-types', 'test/helpers/workflow-runner.ts', JSON.stringify(operation)],
          {
            timeout: 120000,
            maxBuffer: 2 * 1024 * 1024,
            env: {
              ...process.env,
              AP_ALLOW_UNSCREENED_VENDORS: 'true',
              AP_API_TOKEN: 'sandbox-test-reader-00000000000000000000',
              AP_APPROVAL_TOKEN: 'sandbox-test-human-00000000000000000000',
              AP_APPROVER_ID: 'sandbox-test-reviewer',
              AP_APPROVAL_THRESHOLD_MINOR: '100000',
              QBO_MCP_ENABLE_POSTING: 'true',
              QBO_MCP_SINGLE_WRITER: 'true',
              MASTRA_DB_URL: `file:${join(directory, `${label}.db`)}`,
              QBO_MCP_POSTING_LOCK_DIR: join(directory, 'locks'),
              ...env,
            },
          },
        );
        const serialized = stdout.split('\n').find(line => line.startsWith('AP_RESULT:'));
        assert.ok(serialized, 'Workflow process returned no result');
        const result = JSON.parse(serialized.slice('AP_RESULT:'.length)) as {
          runId: string;
          status: string;
          result?: InvoiceResult;
        };
        state.runId = result.runId;
        state.invoiceNumber = invoiceNumber;
        return result;
      };
      const billsFor = (number: string) =>
        call('search_bills', { criteria: [{ field: 'DocNumber', operator: '=', value: number }], fetchAll: true });
      const readOnly = await run('RO', { QBO_MCP_ENABLE_POSTING: 'false' });
      assert.equal(readOnly.result?.executionStatus, 'posting_unavailable');
      assert.deepEqual(await billsFor(state.invoiceNumber), []);
      evidence.checks.push('Read-only workflow creates no Bill');
      const screened = await run('SC', { AP_ALLOW_UNSCREENED_VENDORS: 'false' });
      assert.equal(screened.result?.disposition, 'review');
      assert.ok(
        screened.result.decisions.some(decision =>
          decision.reasons.some(reason => reason.code === 'VENDOR_SCREENING_UNAVAILABLE'),
        ),
      );
      assert.deepEqual(await billsFor(state.invoiceNumber), []);
      evidence.checks.push('Missing screening without bypass creates no Bill');

      const verifyBill = async (result: Awaited<ReturnType<typeof run>>) => {
        assert.equal(result.result?.executionStatus, 'posted');
        const id = result.result!.posting!.externalBillId;
        await record('Bill', { Id: id, DocNumber: state.invoiceNumber });
        const bill = (await call('get-bill', { id }))[0]!;
        assert.equal(bill.VendorRef.value, vendor.Id);
        assert.equal(bill.DocNumber, state.invoiceNumber);
        assert.equal(bill.CurrencyRef?.value ?? 'USD', 'USD');
        assert.equal(bill.TotalAmt, 100);
        assert.equal(bill.Line[0]?.Amount, 100);
        assert.equal(
          bill.Line[0]?.AccountBasedExpenseLineDetail?.AccountRef.value,
          process.env.QBO_MCP_EXPENSE_ACCOUNT_ID,
        );
        assert.ok(
          bill.LinkedTxn?.some((link: Row) => link.TxnId === po.Id && link.TxnType === 'PurchaseOrder'),
          'QuickBooks must retain PO linkage',
        );
        assert.equal((await billsFor(state.invoiceNumber)).length, 1);
      };
      await verifyBill(await run('OK'));
      evidence.checks.push('Valid invoice posted and Bill fields read back');
      const replay = await run('OK');
      assert.equal(replay.result?.executionStatus, 'not_postable');
      assert.equal((await billsFor(state.invoiceNumber)).length, 1);
      evidence.checks.push('Duplicate after process restart creates no second Bill');

      for (const approved of [true, false]) {
        const label = approved ? 'AP' : 'RJ';
        vendor = await record(
          'Vendor',
          (await call('create-vendor', { vendor: { DisplayName: `${prefix} ${label} Vendor` } }))[0]!,
        );
        po = await record(
          'PurchaseOrder',
          (
            await call('create_purchase_order', {
              vendor_ref: vendor.Id,
              doc_number: `${prefix}${label}PO`,
              txn_date: '2026-10-26',
              line_items: [{ item_ref: item.Id, qty: 10, unit_price: 10, description: 'Pens' }],
            })
          )[0]!,
        );
        invoice = { ...invoice, vendorName: vendor.DisplayName, poNumber: po.DocNumber };
        const environment = { AP_APPROVAL_THRESHOLD_MINOR: '9999' };
        const pending = await run(label, environment);
        assert.equal(pending.status, 'suspended');
        assert.deepEqual(await billsFor(state.invoiceNumber), []);
        const resumed = await run(label, environment, approved);
        if (approved) await verifyBill(resumed);
        else {
          assert.equal(resumed.result?.executionStatus, 'rejected');
          assert.deepEqual(await billsFor(state.invoiceNumber), []);
        }
        evidence.checks.push(
          approved
            ? 'Suspended invoice posts only after explicit approval after restart'
            : 'Rejected invoice creates no Bill',
        );
        await saveEvidence();
      }

      const { makeQuickBooksProvider } = await import('../src/mastra/accounting/quickbooks.ts');
      const { normalizeInvoice } = await import('../src/mastra/invoice/money.ts');
      const { invoiceInput } = await import('../test/helpers/invoice.ts');
      const adapter = {
        async listToolNames() {
          return new Set(Object.keys(tools).map(name => name.replace(/^quickbooks_/, '')));
        },
        async call(name: string, input: unknown) {
          return tools[`quickbooks_${name}`]!.execute!(input, {
            ...createObservabilityContext(),
            observe: noopObserve,
            requestContext: new RequestContext(),
          });
        },
      };
      const original = { ...process.env };
      try {
        process.env.QBO_MCP_ENABLE_POSTING = 'true';
        process.env.QBO_MCP_SINGLE_WRITER = 'true';
        process.env.QBO_MCP_POSTING_LOCK_DIR = join(directory, 'tax-locks');
        process.env.QBO_MCP_TAX_ACCOUNT_ID = '';
        const noTaxAccount = makeQuickBooksProvider(adapter);
        const unsigned = invoiceInput({ ...invoice, invoiceNumber: `${prefix}TX`, tax: 8, total: 108 });
        const normalized = normalizeInvoice({ ...unsigned, submissionSignature: '0'.repeat(64) });
        const digest = createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');
        const request = {
          invoice: normalized,
          vendor: (await noTaxAccount.findVendors({ name: vendor.DisplayName }))[0]!,
          purchaseOrder: (await noTaxAccount.findPurchaseOrders(po.DocNumber))[0]!,
          idempotencyKey: `ap-${digest}`,
          approval: {
            status: 'not_required' as const,
            reviewerId: null,
            decidedAt: new Date().toISOString(),
            invoiceDigest: digest,
            comment: null,
          },
        };
        await assert.rejects(() => noTaxAccount.postBill!(request), /QBO_MCP_TAX_ACCOUNT_ID/);
        assert.deepEqual(await billsFor(unsigned.extractedResult.invoiceNumber), []);
        process.env.QBO_MCP_TAX_ACCOUNT_ID = original.QBO_MCP_TAX_ACCOUNT_ID;
        const withTax = makeQuickBooksProvider(adapter);
        const posted = await withTax.postBill!(request);
        await record('Bill', { Id: posted.externalBillId, DocNumber: unsigned.extractedResult.invoiceNumber });
        const bill = (await call('get-bill', { id: posted.externalBillId }))[0]!;
        assert.equal(bill.TotalAmt, 108);
        assert.equal(bill.VendorRef.value, vendor.Id);
        assert.equal(bill.DocNumber, unsigned.extractedResult.invoiceNumber);
        assert.equal(bill.CurrencyRef?.value ?? 'USD', 'USD');
        assert.deepEqual(
          bill.Line.map((line: Row) => [line.Amount, line.AccountBasedExpenseLineDetail?.AccountRef.value]),
          [
            [100, original.QBO_MCP_EXPENSE_ACCOUNT_ID],
            [8, original.QBO_MCP_TAX_ACCOUNT_ID],
          ],
        );
        evidence.checks.push('Provider tax contract: configured account read back; missing account prevents creation');
      } finally {
        for (const name of [
          'QBO_MCP_ENABLE_POSTING',
          'QBO_MCP_SINGLE_WRITER',
          'QBO_MCP_POSTING_LOCK_DIR',
          'QBO_MCP_TAX_ACCOUNT_ID',
        ]) {
          if (original[name] === undefined) delete process.env[name];
          else process.env[name] = original[name];
        }
      }
      await saveEvidence();
    } finally {
      await saveEvidence();
      await client.disconnect();
    }
  },
);
