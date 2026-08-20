import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { defaultStoragePath, mastra } from '../mastra/index.ts';
import { isLoopbackHost, setAuthenticatedReviewer } from '../mastra/auth.ts';
import { detectMediaType, invoiceReader, prepareDocument } from '../mastra/readers/invoice-reader.ts';
import { extractionFidelityScorer, scoreExtraction } from '../mastra/scorers/extraction-fidelity.ts';
import type { ExtractedInvoice } from '../mastra/schemas/invoice.ts';
import { resolveReferences } from '../mastra/tools/resolve-references.ts';
import { validateExtraction } from '../mastra/validation/extraction-checks.ts';
import { runProviderConformance } from '../mastra/phase2/conformance.ts';
import { fixtureConformanceCases } from '../mastra/phase2/conformance-fixtures.ts';
import { createPhase2Runtime } from '../mastra/phase2/composition.ts';
import { toMinorUnits, normalizePhase1Output } from '../mastra/phase2/money.ts';
import {
  FixturePolicyProvider,
  FixtureSanctionsScreener,
  InMemoryInvoiceHistoryRepository,
} from '../mastra/phase2/adapters/fixture.ts';
import { QuickBooksAdapter, type QboClient } from '../mastra/phase2/adapters/quickbooks-adapter.ts';
import { QuickBooksMcpAdapter } from '../mastra/phase2/adapters/quickbooks-mcp-adapter.ts';
import type { McpToolClient } from '../mastra/phase2/adapters/mcp-tool-client.ts';
import { makeCompositeProvider } from '../mastra/phase2/providers/composite-provider.ts';
import { NotImplementedError } from '../mastra/phase2/providers/connector-provider.ts';
import { fixtureProvider } from '../mastra/phase2/providers/fixture-provider.ts';
import { makeQuickBooksProvider } from '../mastra/phase2/providers/quickbooks-provider.ts';
import { makeQuickBooksMcpProvider } from '../mastra/phase2/providers/quickbooks-mcp-provider.ts';
import { providerRegistry } from '../mastra/phase2/providers/registry.ts';
import { assertProvider } from '../mastra/phase2/providers/types.ts';
import { makeInvoiceMatch } from '../mastra/phase2/steps/match.ts';
import { makeDuplicateDetection } from '../mastra/phase2/steps/dedup.ts';
import { makePolicyRouting } from '../mastra/phase2/steps/policy.ts';
import { makeVendorValidation } from '../mastra/phase2/steps/vendor.ts';
import { signAssessment } from '../mastra/phase2/assessment-integrity.ts';
import { ProviderUnavailableError } from '../mastra/phase2/ports.ts';
import type { FinalAssessment } from '../mastra/phase2/schemas.ts';
import { apExecutionWorkflow } from '../mastra/phase3/workflow.ts';
import { buildApKpiReport } from '../mastra/monitoring/ap-kpi-report.ts';
import { recordApKpi, type ApKpiEvent } from '../mastra/monitoring/ap-kpis.ts';
import { buildExtractionReviewResult, buildSuspendedApprovalResult } from '../mastra/agents/invoice-chat-intake.ts';
import { invoiceFixtures, runFixture } from './support.ts';

assert.equal(isLoopbackHost('127.0.0.1'), true);
assert.equal(isLoopbackHost('127.20.30.40'), true);
assert.equal(isLoopbackHost('localhost'), true);
assert.equal(isLoopbackHost('::1'), true);
assert.equal(isLoopbackHost('0.0.0.0'), false);
assert.equal(isLoopbackHost('192.168.1.10'), false);
assert.equal(isLoopbackHost('127.0.0.1.example.com'), false);

for (const fixture of invoiceFixtures) {
  const run = await runFixture(fixture);
  assert.equal(run.suspended, fixture.requiresReview);
  assert.deepEqual(run.result.extractedResult, fixture.groundTruth);
  const score = await extractionFidelityScorer.run({
    input: fixture.groundTruth,
    output: run.result.extractedResult,
  });
  assert.equal(score.score, 1);
  assert.ok(scoreExtraction(fixture.draft, fixture.groundTruth).overall >= fixture.minimumFidelity);
}

const cleanExtraction = invoiceFixtures[0]!.groundTruth;
assert.equal(validateExtraction({ ...cleanExtraction, vendorName: '   ' }).extracted, null);
assert.equal(validateExtraction({ ...cleanExtraction, vendorTaxId: undefined }).extracted?.vendorTaxId, null);
assert.ok(
  validateExtraction({ ...cleanExtraction, invoiceDate: '2026-02-30' }).issues.includes(
    'invoiceDate must be yyyy-mm-dd',
  ),
);
assert.ok(
  validateExtraction({ ...cleanExtraction, subtotal: 99 }).issues.includes('line totals do not equal subtotal'),
);
assert.ok(
  validateExtraction({ ...cleanExtraction, subtotal: null, tax: null, lines: [] }).issues.includes(
    'total cannot be reconciled from printed amounts',
  ),
);
assert.equal(validateExtraction({ ...cleanExtraction, total: Number.POSITIVE_INFINITY }).extracted, null);
assert.equal(validateExtraction({ ...cleanExtraction, currency: 'XAU' }).extracted?.currency, 'XAU');
assert.equal(validateExtraction({ ...cleanExtraction, currency: 'XCG' }).extracted?.currency, 'XCG');
assert.equal(validateExtraction({ ...cleanExtraction, currency: 'XAD' }).extracted?.currency, 'XAD');
assert.ok(
  validateExtraction({ ...cleanExtraction, currency: 'XCG', total: 108.001 }).issues.includes(
    'total exceeds XCG minor-unit precision',
  ),
);
assert.ok(
  validateExtraction({ ...cleanExtraction, currency: 'XAD', total: 108.001 }).issues.includes(
    'total exceeds XAD minor-unit precision',
  ),
);
assert.equal(validateExtraction({ ...cleanExtraction, currency: 'usd' }).extracted, null);
assert.ok(
  validateExtraction({ ...cleanExtraction, total: 108.004 }).issues.includes('total exceeds USD minor-unit precision'),
);
assert.ok(
  validateExtraction({
    ...cleanExtraction,
    lines: [{ ...cleanExtraction.lines[0]!, lineTotal: 100.001 }],
  }).issues.includes('lines.0.lineTotal exceeds USD minor-unit precision'),
);
assert.ok(
  validateExtraction({
    ...cleanExtraction,
    lines: [{ ...cleanExtraction.lines[0]!, unitPrice: 10.0001 }],
  }).extracted,
);
assert.ok(
  validateExtraction({ ...cleanExtraction, total: 108.01 }).issues.includes('subtotal + tax does not equal total'),
);
const bhd: ExtractedInvoice = {
  ...cleanExtraction,
  currency: 'BHD',
  subtotal: 10,
  tax: 0.001,
  total: 10.003,
  lines: [{ ...cleanExtraction.lines[0]!, qty: 1, unitPrice: 10, lineTotal: 10 }],
};
assert.ok(validateExtraction(bhd).issues.includes('subtotal + tax does not equal total'));

const nullable = invoiceFixtures[1]!.groundTruth;
assert.equal(scoreExtraction({ ...nullable, vendorTaxId: '0' }, nullable).fields.vendorTaxId, 0);
assert.equal(
  scoreExtraction({ ...cleanExtraction, invoiceNumber: '001' }, { ...cleanExtraction, invoiceNumber: '1' }).fields
    .invoiceNumber,
  0,
);
assert.equal(
  scoreExtraction({ ...cleanExtraction, lines: [{ ...cleanExtraction.lines[0]!, qty: 9 }] }, cleanExtraction).fields[
    'lines.qty'
  ],
  0,
);
assert.ok(scoreExtraction(invoiceFixtures[1]!.draft, invoiceFixtures[1]!.groundTruth).overall < 1);
assert.equal(resolveReferences({ ...cleanExtraction, poNumber: 'po-1001' }).poId, 'po_1001');

assert.equal(detectMediaType(Buffer.from('%PDF-1.7')), 'application/pdf');
assert.equal(detectMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xdb])), 'image/jpeg');
assert.equal(detectMediaType(Buffer.from('not a pdf')), null);
const tempDir = await mkdtemp(join(dirname(defaultStoragePath), 'phase1-test-')),
  pdfPath = join(tempDir, 'invoice.pdf'),
  fakePath = join(tempDir, 'fake.pdf');
try {
  await writeFile(pdfPath, '%PDF-1.7\n%%EOF\n');
  await writeFile(fakePath, 'not a pdf');
  const prepared = await prepareDocument({
    id: 'invoice',
    localPath: pdfPath,
    mimeType: 'application/pdf',
    source: 'PDF',
  });
  assert.ok(prepared.sha256);
  await assert.rejects(prepareDocument({ ...prepared, sha256: 'wrong' }), /checksum mismatch/);
  await assert.rejects(
    prepareDocument({
      id: 'fake',
      localPath: fakePath,
      mimeType: 'application/pdf',
      source: 'PDF',
    }),
    /bytes do not match/,
  );
  await assert.rejects(
    prepareDocument({
      id: 'outside-root',
      localPath: process.execPath,
      mimeType: 'application/pdf',
      source: 'PDF',
    }),
    /INVOICE_ROOT/,
  );
  await assert.rejects(prepareDocument({ id: 'source-mismatch', mimeType: 'image/png', source: 'PDF' }), /conflicts/);
  const previousLimit = process.env.INVOICE_MAX_BYTES;
  try {
    process.env.INVOICE_MAX_BYTES = '4';
    await assert.rejects(
      prepareDocument({
        id: 'large',
        localPath: pdfPath,
        mimeType: 'application/pdf',
        source: 'PDF',
      }),
      /exceeds/,
    );
  } finally {
    if (previousLimit === undefined) delete process.env.INVOICE_MAX_BYTES;
    else process.env.INVOICE_MAX_BYTES = previousLimit;
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
await assert.rejects(
  invoiceReader.read({ ...invoiceFixtures[0]!.document, sha256: 'spoofed' }),
  /does not match fixture/,
);
assert.equal((await stat(defaultStoragePath)).mode & 0o777, 0o600);
assert.equal((await stat(dirname(defaultStoragePath))).mode & 0o777, 0o700);

const readerWorkflow = mastra.getWorkflow('invoiceReaderWorkflow');
const originalSource = invoiceFixtures[0]!.draft.source;
invoiceFixtures[0]!.draft.source = 'image';
const sourceRun = await readerWorkflow.createRun(),
  sourceResult = await sourceRun.start({ inputData: invoiceFixtures[0]!.document });
invoiceFixtures[0]!.draft.source = originalSource;
assert.equal(sourceResult.status, 'success');
if (sourceResult.status === 'success') assert.equal(sourceResult.result.extractedResult.source, 'PDF');

const reviewRun = await readerWorkflow.createRun(),
  firstReview = await reviewRun.start({ inputData: invoiceFixtures[1]!.document });
assert.equal(firstReview.status, 'suspended');
const requestContext = new RequestContext<{ reviewerId?: string }>([['reviewerId', 'reviewer']]);
const forgedContext = new RequestContext<{ reviewerId?: string }>([['reviewerId', 'forged']]);
setAuthenticatedReviewer(forgedContext, { id: 'viewer', name: 'Viewer', role: 'viewer' });
assert.equal(forgedContext.get('reviewerId'), undefined);
setAuthenticatedReviewer(forgedContext, {
  id: 'verified-approver',
  name: 'Approver',
  role: 'ap_approver',
});
assert.equal(forgedContext.get('reviewerId'), 'verified-approver');
const badCorrection = { ...invoiceFixtures[1]!.groundTruth, total: 61, source: 'PDF' as const };
const secondReview = await reviewRun.resume({
  step: 'verify-invoice',
  resumeData: { extracted: badCorrection },
  requestContext,
});
assert.equal(secondReview.status, 'suspended');
if (secondReview.status === 'suspended') assert.equal(secondReview.suspendPayload['verify-invoice'].draft.total, 61);
const completedReview = await reviewRun.resume({
  step: 'verify-invoice',
  resumeData: { extracted: { ...invoiceFixtures[1]!.groundTruth, source: 'PDF' } },
  requestContext,
});
assert.equal(completedReview.status, 'success');
if (completedReview.status === 'success') {
  assert.equal(completedReview.result.extractedResult.source, 'image');
  assert.equal(completedReview.result.reviewerId, 'reviewer');
}

const composedWorkflow = mastra.getWorkflow('apInvoiceWorkflow'),
  composedRun = await composedWorkflow.createRun();
const composedStart = await composedRun.start({ inputData: invoiceFixtures[1]!.document });
assert.equal(composedStart.status, 'suspended');
const composedResult = await composedRun.resume({
  resumeData: { extracted: invoiceFixtures[1]!.groundTruth },
  requestContext,
});
assert.equal(composedResult.status, 'success');

const unauthorizedRun = await readerWorkflow.createRun(),
  unauthorizedStart = await unauthorizedRun.start({ inputData: invoiceFixtures[1]!.document });
assert.equal(unauthorizedStart.status, 'suspended');
const originalConsoleError = console.error;
console.error = () => undefined;
const unauthorizedResume = await unauthorizedRun
  .resume({ step: 'verify-invoice', resumeData: { extracted: invoiceFixtures[1]!.groundTruth } })
  .finally(() => {
    console.error = originalConsoleError;
  });
assert.equal(unauthorizedResume.status, 'failed');
console.log('reader workflow and control tests passed');
assert.equal(toMinorUnits(10.5, 'USD'), 1050);
assert.equal(toMinorUnits(10.5, 'JPY'), 11);
assert.equal(toMinorUnits(10.5, 'BHD'), 10_500);
const clean = invoiceFixtures[0]!,
  normalized = normalizePhase1Output({
    rawDocumentRef: clean.document,
    extractedResult: clean.groundTruth,
    vendorId: 'vendor_acme',
    poId: 'po_1001',
  });
assert.deepEqual(normalized.fixtureHints, { vendorId: 'vendor_acme', poId: 'po_1001' });
assert.equal(normalized.totalMinor, 10_800);

await runProviderConformance(fixtureProvider, fixtureConformanceCases);
assert.throws(() => providerRegistry.create('connector'), NotImplementedError);

const qboRows: Record<string, unknown[]> = {
  Vendor: [
    {
      Id: 'qbo_vendor_acme',
      DisplayName: 'Acme Supplies',
      Active: true,
      TaxIdentifier: 'US-12-3456789',
    },
  ],
  PurchaseOrder: [
    {
      Id: 'qbo_po_1001',
      DocNumber: 'PO-1001',
      VendorRef: { value: 'qbo_vendor_acme' },
      CurrencyRef: { value: 'USD' },
      TotalAmt: 108,
      Line: [
        {
          Amount: 100,
          Description: 'Blue pens',
          ItemBasedExpenseLineDetail: { ItemRef: { value: 'PEN-01' }, Qty: 10, UnitPrice: 10 },
        },
      ],
    },
  ],
  Bill: [
    {
      Id: 'qbo_prior',
      DocNumber: 'ACME-0999',
      VendorRef: { value: 'qbo_vendor_acme' },
      CurrencyRef: { value: 'USD' },
      TotalAmt: 108,
      TxnDate: '2026-07-01',
    },
  ],
};
const qboClient: QboClient = { query: async <T>(entity: string) => (qboRows[entity] ?? []) as T[] };
const quickbooks = makeQuickBooksProvider(qboClient);
const billPages: Record<number, unknown[]> = {
  1: [
    {
      Id: 'bill_1',
      DocNumber: 'B-1',
      VendorRef: { value: 'qbo_vendor_acme' },
      TotalAmt: 1,
      TxnDate: '2026-01-01',
    },
    {
      Id: 'bill_2',
      DocNumber: 'B-2',
      VendorRef: { value: 'qbo_vendor_acme' },
      TotalAmt: 2,
      TxnDate: '2026-01-02',
    },
  ],
  3: [
    {
      Id: 'bill_3',
      DocNumber: 'B-3',
      VendorRef: { value: 'qbo_vendor_acme' },
      TotalAmt: 3,
      TxnDate: '2026-01-03',
    },
  ],
};
const pageStarts: number[] = [],
  pagingClient: QboClient = {
    query: async <T>(_entity: string, query: string) => {
      const start = Number(query.match(/startposition (\d+)/i)?.[1]);
      pageStarts.push(start);
      return (billPages[start] ?? []) as T[];
    },
  };
assert.equal((await new QuickBooksAdapter(pagingClient, 2).billHistorySeed()).length, 3);
assert.deepEqual(pageStarts, [1, 3]);
const noDocNumberClient: QboClient = {
  query: async <T>() =>
    [
      {
        Id: 'qbo_unlabeled',
        VendorRef: { value: 'qbo_vendor_acme' },
        TotalAmt: 50,
        TxnDate: '2026-01-01',
      },
    ] as T[],
};
assert.equal((await new QuickBooksAdapter(noDocNumberClient).billHistorySeed())[0]!.invoiceNumber, null);

const mcpCalls: Array<{ tool: string; input: unknown }> = [];
const mcpResult = (...values: unknown[]) => ({
  content: [
    { type: 'text', text: `Found ${values.length} records:` },
    ...values.map(value => ({ type: 'text', text: JSON.stringify(value) })),
  ],
});
const qboMcpClient: McpToolClient = {
  listToolNames: async () => new Set(['search_vendors', 'search_purchase_orders', 'search_bills']),
  call: async (tool, input) => {
    mcpCalls.push({ tool, input });
    if (tool === 'search_vendors') return mcpResult(qboRows.Vendor![0]);
    if (tool === 'search_purchase_orders') return mcpResult(qboRows.PurchaseOrder);
    return mcpResult(qboRows.Bill![0]);
  },
  disconnect: async () => undefined,
};
const qboMcp = makeQuickBooksMcpProvider(qboMcpClient);
assert.equal((await qboMcp.vendors!.find({ name: 'Acme Supplies' }))[0]!.id, 'qbo_vendor_acme');
assert.equal((await qboMcp.purchaseOrders!.findByNumber('PO-1001'))[0]!.id, 'qbo_po_1001');
assert.equal((await qboMcp.billHistorySeed!())[0]!.id, 'qbo_prior');
const noDocNumberMcp: McpToolClient = {
  listToolNames: qboMcpClient.listToolNames,
  call: async () =>
    mcpResult({
      Id: 'qbo_unlabeled',
      VendorRef: { value: 'qbo_vendor_acme' },
      TotalAmt: 50,
      TxnDate: '2026-01-01',
    }),
  disconnect: async () => undefined,
};
assert.equal((await makeQuickBooksMcpProvider(noDocNumberMcp).billHistorySeed!())[0]!.invoiceNumber, null);
assert.deepEqual(
  mcpCalls.map(call => call.tool),
  ['search_vendors', 'search_purchase_orders', 'search_bills'],
);
const incompleteMcp: McpToolClient = {
  listToolNames: async () => new Set(['search_vendors']),
  call: async () => mcpResult(),
  disconnect: async () => undefined,
};
await assert.rejects(
  makeQuickBooksMcpProvider(incompleteMcp).vendors!.find({ name: 'Acme Supplies' }),
  ProviderUnavailableError,
);
const writableMcp: McpToolClient = {
  listToolNames: async () => new Set(['search_vendors', 'search_purchase_orders', 'search_bills', 'create-bill']),
  call: qboMcpClient.call,
  disconnect: async () => undefined,
};
await assert.rejects(
  makeQuickBooksMcpProvider(writableMcp).vendors!.find({ name: 'Acme Supplies' }),
  ProviderUnavailableError,
);
let discoveries = 0;
const recoveringMcp: McpToolClient = {
  listToolNames: async () => (++discoveries === 1 ? new Set() : qboMcpClient.listToolNames()),
  call: qboMcpClient.call,
  disconnect: async () => undefined,
};
const recoveringProvider = makeQuickBooksMcpProvider(recoveringMcp);
await assert.rejects(recoveringProvider.vendors!.find({ name: 'Acme Supplies' }), ProviderUnavailableError);
assert.equal((await recoveringProvider.vendors!.find({ name: 'Acme Supplies' }))[0]!.id, 'qbo_vendor_acme');
const failingMcp: McpToolClient = {
  listToolNames: qboMcpClient.listToolNames,
  call: async () => ({ content: [{ type: 'text', text: 'Error searching vendors: unavailable' }] }),
  disconnect: async () => undefined,
};
await assert.rejects(
  makeQuickBooksMcpProvider(failingMcp).vendors!.find({ name: 'Acme Supplies' }),
  ProviderUnavailableError,
);
const truncatedMcp: McpToolClient = {
  listToolNames: qboMcpClient.listToolNames,
  call: async () => mcpResult([{ DocNumber: 'OTHER' }]),
  disconnect: async () => undefined,
};
await assert.rejects(new QuickBooksMcpAdapter(truncatedMcp, 1).findByNumber('PO-MISSING'), ProviderUnavailableError);

let createdBill: Record<string, unknown> | undefined;
const postingMcp: McpToolClient = {
  listToolNames: async () => new Set(['search_vendors', 'search_purchase_orders', 'search_bills', 'create-bill']),
  call: async (tool, input) => {
    if (tool === 'search_bills') return createdBill ? mcpResult(createdBill) : mcpResult();
    if (tool === 'create-bill') {
      createdBill = { Id: 'qbo_bill_new', ...(input as { params: { bill: object } }).params.bill };
      return mcpResult(createdBill);
    }
    return mcpResult();
  },
  disconnect: async () => undefined,
};
const priorPostingFlag = process.env.QBO_MCP_ENABLE_POSTING,
  priorExpenseAccount = process.env.QBO_MCP_EXPENSE_ACCOUNT_ID,
  priorSingleWriter = process.env.QBO_MCP_SINGLE_WRITER;
try {
  process.env.QBO_MCP_ENABLE_POSTING = 'true';
  delete process.env.QBO_MCP_EXPENSE_ACCOUNT_ID;
  delete process.env.QBO_MCP_SINGLE_WRITER;
  assert.throws(() => makeQuickBooksMcpProvider(postingMcp), /QBO_MCP_EXPENSE_ACCOUNT_ID/);
  process.env.QBO_MCP_EXPENSE_ACCOUNT_ID = 'expense-1';
  assert.throws(() => makeQuickBooksMcpProvider(postingMcp), /QBO_MCP_SINGLE_WRITER/);
  process.env.QBO_MCP_SINGLE_WRITER = 'true';
  assert.equal(makeQuickBooksMcpProvider(postingMcp).capabilities.posting, true);
} finally {
  if (priorPostingFlag === undefined) delete process.env.QBO_MCP_ENABLE_POSTING;
  else process.env.QBO_MCP_ENABLE_POSTING = priorPostingFlag;
  if (priorExpenseAccount === undefined) delete process.env.QBO_MCP_EXPENSE_ACCOUNT_ID;
  else process.env.QBO_MCP_EXPENSE_ACCOUNT_ID = priorExpenseAccount;
  if (priorSingleWriter === undefined) delete process.env.QBO_MCP_SINGLE_WRITER;
  else process.env.QBO_MCP_SINGLE_WRITER = priorSingleWriter;
}
const postingAdapter = new QuickBooksMcpAdapter(postingMcp, 1000, {
  expenseAccountId: 'expense-1',
  taxAccountId: 'tax-1',
});
const testDigest = '1'.repeat(64);
const postingRequest = {
  idempotencyKey: `ap-${testDigest}`,
  invoice: normalized,
  vendor: fixtureProvider.vendors
    ? (await fixtureProvider.vendors.find({ name: normalized.vendorName }))[0]!
    : undefined!,
  purchaseOrder: fixtureProvider.purchaseOrders
    ? (await fixtureProvider.purchaseOrders.findByNumber(normalized.poNumber!))[0]!
    : null,
  approval: {
    status: 'not_required' as const,
    reviewerId: null,
    decidedAt: '2026-08-13T00:00:00.000Z',
    invoiceDigest: testDigest,
    comment: null,
  },
};
assert.equal((await postingAdapter.postBill(postingRequest)).status, 'posted');
assert.equal((await postingAdapter.postBill(postingRequest)).status, 'already_posted');
const billPayload = createdBill as {
  Line: Array<{ Amount: number }>;
  LinkedTxn: Array<{ TxnId: string }>;
  PrivateNote: string;
};
assert.deepEqual(
  billPayload.Line.map(line => line.Amount),
  [100, 8],
);
assert.equal(billPayload.LinkedTxn[0]!.TxnId, 'po_1001');
assert.ok(billPayload.PrivateNote.includes(testDigest));
createdBill = { ...createdBill, PrivateNote: 'unrelated bill' };
await assert.rejects(postingAdapter.postBill(postingRequest), /conflicting bill/);
await assert.rejects(
  new QuickBooksMcpAdapter(
    {
      ...postingMcp,
      listToolNames: async () => new Set([...(await postingMcp.listToolNames()), 'update_bill']),
    },
    1000,
    { expenseAccountId: 'expense-1' },
  ).postBill(postingRequest),
  ProviderUnavailableError,
);
createdBill = undefined;
await assert.rejects(
  new QuickBooksMcpAdapter(postingMcp, 1000, { expenseAccountId: 'expense-1' }).postBill({
    ...postingRequest,
    invoice: { ...normalized, invoiceNumber: 'TAX-MISSING' },
  }),
  /QBO_MCP_TAX_ACCOUNT_ID/,
);
const postingLockRoot = await mkdtemp(join(dirname(defaultStoragePath), 'qbo-lock-test-'));
try {
  createdBill = undefined;
  let createCalls = 0;
  const concurrentMcp: McpToolClient = {
    ...postingMcp,
    call: async (tool, input) => {
      if (tool === 'create-bill') createCalls++;
      return postingMcp.call(tool, input);
    },
  };
  const config = {
    expenseAccountId: 'expense-1',
    taxAccountId: 'tax-1',
    lockDirectory: postingLockRoot,
  };
  const receipts = await Promise.all([
    new QuickBooksMcpAdapter(concurrentMcp, 1000, config).postBill(postingRequest),
    new QuickBooksMcpAdapter(concurrentMcp, 1000, config).postBill(postingRequest),
  ]);
  assert.equal(createCalls, 1);
  assert.deepEqual(receipts.map(receipt => receipt.status).sort(), ['already_posted', 'posted']);
  createdBill = undefined;
  createCalls = 0;
  const otherDigest = '2'.repeat(64);
  const distinctKeyRequest = {
    ...postingRequest,
    idempotencyKey: `ap-${otherDigest}`,
    approval: { ...postingRequest.approval, invoiceDigest: otherDigest },
  };
  const distinctResults = await Promise.allSettled([
    new QuickBooksMcpAdapter(concurrentMcp, 1000, config).postBill(postingRequest),
    new QuickBooksMcpAdapter(concurrentMcp, 1000, config).postBill(distinctKeyRequest),
  ]);
  assert.equal(createCalls, 1);
  assert.equal(distinctResults.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(distinctResults.filter(result => result.status === 'rejected').length, 1);
} finally {
  await rm(postingLockRoot, { recursive: true, force: true });
}

assert.throws(() => createPhase2Runtime({ provider: quickbooks }), /sanctions/);
const qboRuntime = createPhase2Runtime({
  provider: quickbooks,
  history: new InMemoryInvoiceHistoryRepository(),
  policy: new FixturePolicyProvider(),
  sanctionsFallback: new FixtureSanctionsScreener(),
});
let qboState = await makeVendorValidation(qboRuntime)(normalized);
assert.ok(qboState.decisions[0]!.signals.includes('payment_details_unverifiable'));
qboState = await makeInvoiceMatch(qboRuntime)(qboState);
assert.equal(qboState.matchMode, 'two_way');
assert.ok(qboState.decisions.at(-1)!.adaptations.some(a => a.code === 'GOODS_RECEIPTS_UNAVAILABLE'));

assert.throws(
  () =>
    makeCompositeProvider({
      id: 'unsafe-vendor-po',
      displayName: 'Unsafe vendor/PO',
      vendors: fixtureProvider,
      purchaseOrders: quickbooks,
    }),
  /vendor ID crosswalk/,
);
assert.throws(
  () =>
    makeCompositeProvider({
      id: 'unsafe-vendor-history',
      displayName: 'Unsafe vendor/history',
      vendors: fixtureProvider,
      billHistory: quickbooks,
    }),
  /vendor ID crosswalk/,
);
assert.throws(
  () =>
    makeCompositeProvider({
      id: 'unsafe-posting',
      displayName: 'Unsafe posting',
      vendors: quickbooks,
      purchaseOrders: quickbooks,
      posting: fixtureProvider,
    }),
  /vendor\/posting/,
);
const splitProvider = makeCompositeProvider({
  id: 'fixture-qbo',
  displayName: 'Fixture vendors + QuickBooks POs',
  vendors: fixtureProvider,
  purchaseOrders: quickbooks,
  sanctions: fixtureProvider,
  billHistory: quickbooks,
  identity: {
    crosswalk: { mapVendorId: async ({ id }) => (id === 'qbo_vendor_acme' ? 'vendor_acme' : null) },
  },
});
assert.equal((await splitProvider.billHistorySeed!())[0]!.vendorId, 'vendor_acme');
const splitRuntime = createPhase2Runtime({
  provider: splitProvider,
  history: new InMemoryInvoiceHistoryRepository(),
  policy: new FixturePolicyProvider(),
});
let splitState = await makeVendorValidation(splitRuntime)(normalized);
splitState = await makeInvoiceMatch(splitRuntime)(splitState);
assert.equal(splitState.decisions.at(-1)!.outcome, 'pass');

const receiving = assertProvider({
  id: 'receiving',
  displayName: 'Receiving system',
  capabilities: {
    vendors: false,
    vendorBankDetails: false,
    vendorStatusRichness: 'none',
    purchaseOrders: false,
    goodsReceipts: true,
    billHistory: false,
    sanctions: false,
    invoiceChannel: false,
    posting: false,
  },
  goodsReceipts: {
    findByPurchaseOrderId: async id =>
      id === 'receiving_po_1001'
        ? [
            {
              id: 'receipt_1001',
              purchaseOrderId: id,
              receivedAt: '2026-07-30',
              lines: [{ sku: 'PEN-01', qty: 10 }],
            },
          ]
        : [],
  },
  identityNamespaces: { goodsReceipts: 'receiving' },
});
assert.throws(
  () =>
    makeCompositeProvider({
      id: 'unsafe',
      displayName: 'Unsafe composition',
      purchaseOrders: quickbooks,
      goodsReceipts: receiving,
    }),
  /crosswalk/,
);
const composite = makeCompositeProvider({
  id: 'qbo-receiving',
  displayName: 'QuickBooks + receiving',
  vendors: quickbooks,
  purchaseOrders: quickbooks,
  goodsReceipts: receiving,
  sanctions: fixtureProvider,
  billHistory: quickbooks,
  identity: {
    crosswalk: {
      mapPurchaseOrderId: async ({ id }) => (id === 'qbo_po_1001' ? 'receiving_po_1001' : null),
    },
  },
});
const compositeRuntime = createPhase2Runtime({
  provider: composite,
  history: new InMemoryInvoiceHistoryRepository(),
  policy: new FixturePolicyProvider(),
});
let compositeState = await makeVendorValidation(compositeRuntime)(normalized);
compositeState = await makeInvoiceMatch(compositeRuntime)(compositeState);
assert.equal(compositeState.matchMode, 'three_way');
assert.equal(compositeState.decisions.at(-1)!.sources.goodsReceipts, 'receiving');

const fixtureRuntime = createPhase2Runtime({
  provider: fixtureProvider,
  history: new InMemoryInvoiceHistoryRepository(),
  policy: new FixturePolicyProvider(),
});
const lowConfidenceState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  confidence: [{ field: 'invoiceNumber', confidence: 0.2 }],
});
assert.equal(lowConfidenceState.decisions[0]!.outcome, 'verify_extraction');
assert.equal(lowConfidenceState.decisions[0]!.reasons[0]!.code, 'LOW_EXTRACTION_CONFIDENCE');
const lowOverallState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  overallConfidence: 0.2,
});
assert.equal(lowOverallState.decisions[0]!.outcome, 'verify_extraction');
const incompleteConfidenceState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  confidence: normalized.confidence.filter(item => item.field !== 'tax'),
});
assert.equal(incompleteConfidenceState.decisions[0]!.outcome, 'verify_extraction');
const indexedLineConfidence = normalized.confidence
  .filter(item => item.field !== 'lines')
  .concat([
    { field: 'lines[0].sku', confidence: 0.99 },
    { field: 'lines[0].description', confidence: 0.99 },
    { field: 'lines[0].qty', confidence: 0.99 },
    { field: 'lines[0].unitPrice', confidence: 0.99 },
    { field: 'lines[0].lineTotal', confidence: 0.99 },
  ]);
const indexedLineConfidenceState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  confidence: indexedLineConfidence,
});
assert.equal(indexedLineConfidenceState.decisions[0]!.outcome, 'pass');
const flatSingleLineConfidence = indexedLineConfidence.map(item => ({
  ...item,
  field: item.field.replace(/^lines\[0\]\./, ''),
}));
const flatSingleLineConfidenceState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  confidence: flatSingleLineConfidence,
});
assert.equal(flatSingleLineConfidenceState.decisions[0]!.outcome, 'pass');
const missingLineConfidenceState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  confidence: indexedLineConfidence.filter(item => item.field !== 'lines[0].qty'),
});
assert.equal(missingLineConfidenceState.decisions[0]!.outcome, 'verify_extraction');
assert.deepEqual(missingLineConfidenceState.decisions[0]!.reasons[0]!.evidence?.missingConfidence, ['lines.0.qty']);
const conflictingLineConfidenceState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  confidence: [...indexedLineConfidence, { field: 'lines.0.qty', confidence: 0.1 }],
});
assert.equal(conflictingLineConfidenceState.decisions[0]!.outcome, 'verify_extraction');
assert.deepEqual(conflictingLineConfidenceState.decisions[0]!.reasons[0]!.evidence?.uncertainFields, ['lines.0.qty']);
const optionalLowConfidenceState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  confidence: [...indexedLineConfidence, { field: 'vendorTaxId', confidence: 0.1 }],
});
assert.equal(optionalLowConfidenceState.decisions[0]!.outcome, 'pass');
const unknownVendorState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  vendorName: 'Not A Sandbox Vendor LLC',
  vendorTaxId: null,
  confidence: flatSingleLineConfidence,
});
assert.equal(unknownVendorState.decisions[0]!.reviewType, 'unknown_vendor');
let quantityVarianceState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  subtotalMinor: 11_000,
  totalMinor: 11_000,
  lines: [{ ...normalized.lines[0]!, qty: 11, lineTotalMinor: 11_000 }],
  confidence: indexedLineConfidence,
});
quantityVarianceState = await makeInvoiceMatch(fixtureRuntime)(quantityVarianceState);
assert.equal(quantityVarianceState.decisions.at(-1)!.reviewType, 'review_quantity_variance');
assert.ok(quantityVarianceState.decisions.at(-1)!.reasons.some(reason => reason.code === 'QUANTITY_VARIANCE'));
let lineMismatchState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  lines: [{ ...normalized.lines[0]!, qty: 5, unitPriceMinor: 2000 }],
});
lineMismatchState = await makeInvoiceMatch(fixtureRuntime)(lineMismatchState);
assert.equal(lineMismatchState.decisions.at(-1)!.reviewType, 'review_price_variance');
assert.ok(
  (lineMismatchState.decisions.at(-1)!.reasons[0]!.evidence?.mismatches as string[]).some(value =>
    value.endsWith('.qty'),
  ),
);
assert.ok(lineMismatchState.decisions.at(-1)!.reasons.some(reason => reason.code === 'PRICE_VARIANCE'));
assert.ok(lineMismatchState.decisions.at(-1)!.reasons.some(reason => reason.code === 'QUANTITY_VARIANCE'));
assert.equal((await makePolicyRouting(fixtureRuntime)(lineMismatchState)).disposition, 'review');

let identityMismatchState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  vendorTaxId: 'US-99-9999999',
});
identityMismatchState = await makeInvoiceMatch(fixtureRuntime)(identityMismatchState);
identityMismatchState = await makeDuplicateDetection(fixtureRuntime)(identityMismatchState);
assert.equal((await makePolicyRouting(fixtureRuntime)(identityMismatchState)).disposition, 'review');
assert.equal(identityMismatchState.decisions[0]!.reasons[0]!.code, 'VENDOR_TAX_ID_MISMATCH');

for (const vendor of [
  {
    id: 'blocked_vendor',
    name: 'Acme Supplies',
    taxId: 'US-12-3456789',
    status: 'blocked' as const,
    bankDetailsFingerprint: null,
  },
  {
    id: 'sanctioned_vendor',
    name: 'Sanctioned Supplies',
    taxId: 'US-12-3456789',
    status: 'approved' as const,
    bankDetailsFingerprint: null,
  },
]) {
  const priorityProvider = assertProvider({
    ...fixtureProvider,
    id: vendor.id,
    vendors: { find: async () => [vendor] },
  });
  const priorityRuntime = createPhase2Runtime({
    provider: priorityProvider,
    history: new InMemoryInvoiceHistoryRepository(),
    policy: new FixturePolicyProvider(),
  });
  const priorityState = await makeVendorValidation(priorityRuntime)({
    ...normalized,
    vendorTaxId: 'US-99-9999999',
  });
  assert.equal(priorityState.decisions[0]!.outcome, 'blocked');
  assert.ok(priorityState.decisions[0]!.reasons.some(reason => reason.code === 'VENDOR_TAX_ID_MISMATCH'));
  assert.equal((await makePolicyRouting(priorityRuntime)(priorityState)).disposition, 'blocked');
}

let duplicateState = await makeVendorValidation(fixtureRuntime)({
  ...normalized,
  invoiceNumber: 'ACME-0999',
});
duplicateState = await makeInvoiceMatch(fixtureRuntime)(duplicateState);
duplicateState = await makeDuplicateDetection(fixtureRuntime)(duplicateState);
assert.equal(duplicateState.decisions.at(-1)!.reviewType, 'possible_duplicate');
assert.equal((await makePolicyRouting(fixtureRuntime)(duplicateState)).disposition, 'review');
const unlabeledHistory = new InMemoryInvoiceHistoryRepository();
await unlabeledHistory.seed([
  {
    id: 'unlabeled',
    vendorId: 'vendor_acme',
    invoiceNumber: null,
    invoiceDate: normalized.invoiceDate,
    currency: normalized.currency,
    totalMinor: normalized.totalMinor,
    channel: null,
  },
]);
const unlabeledRuntime = createPhase2Runtime({
  provider: fixtureProvider,
  history: unlabeledHistory,
  policy: new FixturePolicyProvider(),
});
let unlabeledState = await makeVendorValidation(unlabeledRuntime)({
  ...normalized,
  invoiceNumber: 'NEW-NUMBER',
});
unlabeledState = await makeInvoiceMatch(unlabeledRuntime)(unlabeledState);
unlabeledState = await makeDuplicateDetection(unlabeledRuntime)(unlabeledState);
assert.ok(unlabeledState.duplicateIds.includes('unlabeled'));
const currencyHistory = new InMemoryInvoiceHistoryRepository();
await currencyHistory.seed([
  {
    id: 'eur_same_amount',
    vendorId: 'vendor_acme',
    invoiceNumber: 'EUR-OTHER',
    invoiceDate: normalized.invoiceDate,
    currency: 'EUR',
    totalMinor: normalized.totalMinor,
    channel: null,
  },
]);
const currencyRuntime = createPhase2Runtime({
  provider: fixtureProvider,
  history: currencyHistory,
  policy: new FixturePolicyProvider(),
});
let currencyState = await makeVendorValidation(currencyRuntime)({
  ...normalized,
  invoiceNumber: 'ACME-NEW',
});
currencyState = await makeInvoiceMatch(currencyRuntime)(currencyState);
currencyState = await makeDuplicateDetection(currencyRuntime)(currencyState);
assert.ok(!currencyState.duplicateIds.includes('eur_same_amount'));
assert.equal(currencyState.decisions.at(-1)!.outcome, 'pass');

let refreshCalls = 0,
  providerHistory = [
    {
      id: 'refresh_1',
      vendorId: 'vendor_acme',
      invoiceNumber: 'R-1',
      invoiceDate: '2026-01-01',
      currency: 'USD',
      totalMinor: 100,
      channel: null,
    },
  ];
const refreshProvider = assertProvider({
  ...fixtureProvider,
  id: 'refreshing',
  billHistorySeed: async () => {
    if (++refreshCalls === 1) throw new ProviderUnavailableError('refreshing', 'bill history');
    return providerHistory;
  },
});
const refreshHistory = new InMemoryInvoiceHistoryRepository(),
  refreshRuntime = createPhase2Runtime({ provider: refreshProvider, history: refreshHistory });
await assert.rejects(refreshRuntime.seedHistory(), ProviderUnavailableError);
await refreshRuntime.seedHistory();
providerHistory = [
  ...providerHistory,
  {
    id: 'refresh_2',
    vendorId: 'vendor_acme',
    invoiceNumber: 'R-2',
    invoiceDate: '2026-01-02',
    currency: 'USD',
    totalMinor: 200,
    channel: null,
  },
];
await refreshRuntime.seedHistory();
assert.equal(refreshCalls, 3);
assert.equal(
  (
    await refreshHistory.findPotentialDuplicates({
      vendorId: 'vendor_acme',
      invoiceNumber: 'R-2',
      currency: 'USD',
      totalMinor: 200,
    })
  ).length,
  1,
);

const approved = await makePolicyRouting(fixtureRuntime)({
  ...compositeState,
  invoice: { ...compositeState.invoice, totalMinor: 100_001 },
});
assert.equal(approved.disposition, 'approval_required');

const approvalRun = await apExecutionWorkflow.createRun(),
  approvalStart = await approvalRun.start({ inputData: approved });
assert.equal(approvalStart.status, 'suspended');
if (approvalStart.status === 'suspended') {
  const approvalSummary = buildSuspendedApprovalResult(approvalStart, approvalRun.runId);
  assert.equal(approvalSummary.disposition, 'approval_required');
  assert.ok(approvalSummary.reasonDetails.some(reason => reason.code === 'APPROVAL_THRESHOLD_EXCEEDED'));
}
const extractionReviewSummary = buildExtractionReviewResult(['invoiceNumber is required']);
assert.equal(extractionReviewSummary.disposition, 'verify_extraction');
assert.deepEqual(extractionReviewSummary.reviewTypes, ['verify_extraction']);
assert.equal(extractionReviewSummary.reasonDetails[0]!.message, 'invoiceNumber is required');
const freshApprovalHandle = await apExecutionWorkflow.createRun({ runId: approvalRun.runId });
const approvedExecution = await freshApprovalHandle.resume({
  step: 'approve-invoice',
  resumeData: { approved: true, comment: 'Reviewed' },
  requestContext,
});
assert.equal(approvedExecution.status, 'success');
if (approvedExecution.status === 'success') {
  assert.equal(approvedExecution.result.executionStatus, 'posted');
  assert.equal(approvedExecution.result.approval.reviewerId, 'reviewer');
}
const rejectedRun = await apExecutionWorkflow.createRun(),
  rejectedStart = await rejectedRun.start({ inputData: approved });
assert.equal(rejectedStart.status, 'suspended');
const rejectedExecution = await rejectedRun.resume({
  step: 'approve-invoice',
  resumeData: { approved: false },
  requestContext,
});
assert.equal(rejectedExecution.status, 'success');
if (rejectedExecution.status === 'success') assert.equal(rejectedExecution.result.executionStatus, 'rejected');
const unauthenticatedApproval = await apExecutionWorkflow.createRun(),
  unauthenticatedStart = await unauthenticatedApproval.start({ inputData: approved });
assert.equal(unauthenticatedStart.status, 'suspended');
console.error = () => undefined;
const unauthenticatedResult = await unauthenticatedApproval
  .resume({ step: 'approve-invoice', resumeData: { approved: true } })
  .finally(() => {
    console.error = originalConsoleError;
  });
assert.equal(unauthenticatedResult.status, 'failed');
const forgedExecution = await apExecutionWorkflow.createRun();
console.error = () => undefined;
const forgedResult = await forgedExecution
  .start({ inputData: { ...approved, assessmentSignature: '0'.repeat(64) } })
  .finally(() => {
    console.error = originalConsoleError;
  });
assert.equal(forgedResult.status, 'failed');
const priorAssessmentKey = process.env.AP_ASSESSMENT_SIGNING_KEY,
  priorAuthToken = process.env.MASTRA_AUTH_TOKEN,
  priorSigningPosting = process.env.QBO_MCP_ENABLE_POSTING;
try {
  delete process.env.AP_ASSESSMENT_SIGNING_KEY;
  process.env.MASTRA_AUTH_TOKEN = 'known-studio-token';
  process.env.QBO_MCP_ENABLE_POSTING = 'true';
  assert.throws(() => signAssessment({ disposition: 'auto_post' }), /server-only AP_ASSESSMENT_SIGNING_KEY/);
  process.env.AP_ASSESSMENT_SIGNING_KEY = 'replace-with-a-long-random-secret';
  assert.throws(() => signAssessment({ disposition: 'auto_post' }), /server-only AP_ASSESSMENT_SIGNING_KEY/);
  process.env.AP_ASSESSMENT_SIGNING_KEY = 'local-development-assessment-key';
  assert.throws(() => signAssessment({ disposition: 'auto_post' }), /server-only AP_ASSESSMENT_SIGNING_KEY/);
} finally {
  if (priorAssessmentKey === undefined) delete process.env.AP_ASSESSMENT_SIGNING_KEY;
  else process.env.AP_ASSESSMENT_SIGNING_KEY = priorAssessmentKey;
  if (priorAuthToken === undefined) delete process.env.MASTRA_AUTH_TOKEN;
  else process.env.MASTRA_AUTH_TOKEN = priorAuthToken;
  if (priorSigningPosting === undefined) delete process.env.QBO_MCP_ENABLE_POSTING;
  else process.env.QBO_MCP_ENABLE_POSTING = priorSigningPosting;
}

const kpiBase: ApKpiEvent = {
  runId: 'approval-run',
  recordedAt: '2026-08-14T00:00:00.000Z',
  executionStatus: null,
  disposition: 'approval_required',
  reasons: ['VENDOR_VALID'],
  reviewTypes: [],
  signals: [],
  adaptations: [],
  postingStatus: null,
  integrationFailure: false,
  approvalPending: true,
  approvalState: 'pending',
};
const kpiReport = buildApKpiReport([
  kpiBase,
  {
    ...kpiBase,
    recordedAt: '2026-08-14T00:00:05.000Z',
    executionStatus: 'posted',
    postingStatus: 'posted',
    approvalPending: false,
    approvalState: 'approved',
  },
  {
    ...kpiBase,
    runId: 'stp-run',
    recordedAt: '2026-08-14T00:00:01.000Z',
    disposition: 'auto_post',
    executionStatus: 'posted',
    postingStatus: 'posted',
    approvalPending: false,
    approvalState: 'not_applicable',
  },
  {
    ...kpiBase,
    runId: 'failed-run',
    recordedAt: '2026-08-14T00:00:02.000Z',
    disposition: null,
    reasons: ['DECISION_WORKFLOW_FAILED'],
    integrationFailure: true,
    approvalPending: false,
    approvalState: 'not_applicable',
  },
  { ...kpiBase, runId: 'failed-resume', recordedAt: '2026-08-14T00:00:03.000Z' },
  {
    ...kpiBase,
    runId: 'failed-resume',
    recordedAt: '2026-08-14T00:00:04.000Z',
    integrationFailure: true,
    approvalState: 'resume_failed',
  },
  {
    ...kpiBase,
    runId: 'failed-resume',
    recordedAt: '2026-08-14T00:00:08.000Z',
    executionStatus: 'posted',
    postingStatus: 'posted',
    approvalPending: false,
    approvalState: 'approved',
  },
  { ...kpiBase, runId: 'still-pending', recordedAt: '2026-08-14T00:00:06.000Z' },
]);
assert.equal(kpiReport.runs, 5);
assert.equal(kpiReport.straightThroughProcessingRate, 1 / 4);
assert.deepEqual(kpiReport.approvalTimeMs, { count: 2, average: 5000 });
assert.equal(kpiReport.integrationFailures, 2);
assert.equal(kpiReport.pendingApprovals, 1);
const badKpiTarget = await mkdtemp(join(dirname(defaultStoragePath), 'kpi-failure-test-'));
const priorKpiPath = process.env.AP_KPI_LOG_PATH;
try {
  process.env.AP_KPI_LOG_PATH = badKpiTarget;
  console.error = () => undefined;
  assert.equal(await recordApKpi(kpiBase), false);
} finally {
  console.error = originalConsoleError;
  if (priorKpiPath === undefined) delete process.env.AP_KPI_LOG_PATH;
  else process.env.AP_KPI_LOG_PATH = priorKpiPath;
  await rm(badKpiTarget, { recursive: true, force: true });
}

const unavailableProvider = assertProvider({
  ...fixtureProvider,
  id: 'unavailable',
  vendors: {
    find: async () => {
      throw new ProviderUnavailableError('unavailable', 'find vendor');
    },
  },
});
const unavailableState = await makeVendorValidation(createPhase2Runtime({ provider: unavailableProvider }))(normalized);
assert.equal(unavailableState.decisions[0]!.outcome, 'unknown_retry');

const workflow = mastra.getWorkflow('apInvoiceWorkflow'),
  run = await workflow.createRun(),
  result = await run.start({ inputData: clean.document });
assert.equal(result.status, 'success');
assert.equal((result as { result: FinalAssessment }).result.disposition, 'auto_post');
if (result.status === 'success') assert.equal(result.result.executionStatus, 'posted');
console.log('reader, provider, and Phase 2 workflow tests passed');
