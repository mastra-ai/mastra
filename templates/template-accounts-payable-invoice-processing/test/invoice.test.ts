import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InvoiceRuntime } from "../src/mastra/accounting/providers.ts";
import { makeDuplicateDetection } from "../src/mastra/invoice/controls/duplicates.ts";
import { makeInvoiceMatch } from "../src/mastra/invoice/controls/matching.ts";
import { makePolicyRouting } from "../src/mastra/invoice/controls/policy.ts";
import { makeVendorValidation } from "../src/mastra/invoice/controls/vendor.ts";
import { normalizeInvoice, toMajorUnits, toMinorUnits } from "../src/mastra/invoice/money.ts";
import type { ExtractedInvoice } from "../src/mastra/invoice/schema.ts";
import { validateExtraction } from "../src/mastra/invoice/validation.ts";

const confidence = [
  "invoiceNumber",
  "vendorName",
  "poNumber",
  "invoiceDate",
  "currency",
  "subtotal",
  "tax",
  "total",
  "lines[0].sku",
  "lines[0].description",
  "lines[0].qty",
  "lines[0].unitPrice",
  "lines[0].lineTotal",
].map((field) => ({ field, confidence: 0.99 }));

const invoice: ExtractedInvoice = {
  invoiceNumber: "INV-1001",
  vendorName: "Test Vendor",
  vendorTaxId: "US-12-3456789",
  poNumber: "PO-1001",
  invoiceDate: "2026-08-01",
  currency: "USD",
  subtotal: 100,
  tax: 8,
  total: 108,
  lines: [{ sku: "PEN-01", description: "Pens", qty: 10, unitPrice: 10, lineTotal: 100 }],
  confidence,
  overallConfidence: 0.99,
  source: "image",
};

const runtime: InvoiceRuntime = {
  provider: {
    id: "test-accounting",
    async findVendors() {
      return [{ id: "vendor-1", name: "Test Vendor", taxId: "US-12-3456789", status: "approved" }];
    },
    async findPurchaseOrders() {
      return [{
        id: "po-1",
        poNumber: "PO-1001",
        vendorId: "vendor-1",
        currency: "USD",
        totalMinor: 10_800,
        lines: [{ sku: "PEN-01", qty: 10, unitPriceMinor: 1_000, lineTotalMinor: 10_000 }],
      }];
    },
    async findReceipts() {
      return [{ id: "receipt-1", purchaseOrderId: "po-1", lines: [{ sku: "PEN-01", qty: 10 }] }];
    },
    async screenVendor() {
      return { matched: false, list: null, reference: null };
    },
  },
  history: {
    async findPotentialDuplicates() { return []; },
    async seed() {},
    async save() {},
  },
  policy: {
    approvalThresholdMinor: 100_000,
    amountToleranceMinor: 1,
    lowConfidenceThreshold: 0.8,
    allowUnscreenedVendors: false,
  },
  async seedHistory() {},
};

const normalized = normalizeInvoice({
  rawDocumentRef: { id: "invoice", mimeType: "image/jpeg", source: "image" },
  extractedResult: invoice,
  submissionSignature: "0".repeat(64),
});

describe("invoice validation and money", () => {
  it("validates reconciliation, dates, and ISO currency precision", () => {
    assert.deepEqual(validateExtraction(invoice), { extracted: invoice, issues: [] });
    assert.equal(validateExtraction({ ...invoice, vendorTaxId: undefined }).extracted?.vendorTaxId, null);
    assert.ok(validateExtraction({ ...invoice, invoiceDate: "2026-02-30" }).issues.length);
    assert.ok(validateExtraction({ ...invoice, currency: "usd" }).issues.length);
    assert.ok(validateExtraction({ ...invoice, total: 108.001 }).issues.length);
    assert.ok(validateExtraction({ ...invoice, subtotal: 99 }).issues.length);
  });

  it("converts currencies using their ISO minor units", () => {
    assert.equal(toMinorUnits(10.5, "USD"), 1050);
    assert.equal(toMinorUnits(10.5, "JPY"), 11);
    assert.equal(toMinorUnits(10.5, "BHD"), 10_500);
    assert.equal(toMajorUnits(10_500, "BHD"), 10.5);
    assert.throws(() => toMinorUnits(1, "XAU"), /no supported ISO 4217 minor unit/);
  });
});

describe("provider-independent invoice controls", () => {
  it("validates the vendor, matches accounting records, and checks duplicates", async () => {
    const vendorState = await makeVendorValidation(runtime)(normalized);
    const matchState = await makeInvoiceMatch(runtime)(vendorState);
    const duplicateState = await makeDuplicateDetection(runtime)(matchState);
    const assessment = await makePolicyRouting(runtime)(duplicateState);

    assert.equal(assessment.disposition, "auto_post");
    assert.deepEqual(
      assessment.decisions.flatMap(({ reasons }) => reasons.map(({ code }) => code)),
      ["VENDOR_VALID", "THREE_WAY_MATCH", "NO_DUPLICATE"],
    );
  });

  it("routes high-value invoices using provider-neutral policy", async () => {
    const policyRuntime = {
      ...runtime,
      policy: { ...runtime.policy, approvalThresholdMinor: 10_000 },
    };
    const state = await makeVendorValidation(policyRuntime)(normalized);
    const matched = await makeInvoiceMatch(policyRuntime)(state);
    const checked = await makeDuplicateDetection(policyRuntime)(matched);
    assert.equal((await makePolicyRouting(policyRuntime)(checked)).disposition, "approval_required");
  });

  it("fails closed when vendor screening is unavailable", async () => {
    const { screenVendor: _, ...providerWithoutScreening } = runtime.provider;
    const state = await makeVendorValidation({ ...runtime, provider: providerWithoutScreening })(normalized);
    assert.equal(state.decisions[0]?.reasons[0]?.code, "VENDOR_SCREENING_UNAVAILABLE");
    assert.equal(state.decisions[0]?.outcome, "review");
  });

  it("allows an explicit sandbox-only screening bypass", async () => {
    const { screenVendor: _, ...providerWithoutScreening } = runtime.provider;
    const bypassRuntime = {
      ...runtime,
      provider: providerWithoutScreening,
      policy: { ...runtime.policy, allowUnscreenedVendors: true },
    };
    const state = await makeVendorValidation(bypassRuntime)(normalized);
    assert.equal(state.decisions[0]?.reasons[0]?.code, "VENDOR_SCREENING_BYPASSED");
    assert.equal(state.decisions[0]?.outcome, "pass");
  });

  it("blocks a vendor that matches a screening list", async () => {
    const screeningRuntime = {
      ...runtime,
      provider: {
        ...runtime.provider,
        async screenVendor() {
          return { matched: true, list: "test-list", reference: "match-1" };
        },
      },
    };
    const state = await makeVendorValidation(screeningRuntime)(normalized);
    assert.equal(state.decisions[0]?.reasons[0]?.code, "VENDOR_SCREENING_MATCH");
    assert.equal(state.decisions[0]?.outcome, "blocked");
  });
});
