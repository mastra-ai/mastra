import { z } from "zod";
import Decimal from "decimal.js";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, rmdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { createObservabilityContext } from "@mastra/core/observability";
import { RequestContext } from "@mastra/core/request-context";
import { noopObserve } from "@mastra/core/tools";
import { MCPClient } from "@mastra/mcp";
import { ProviderUnavailableError, type AccountingProvider, type VendorLookup } from "./types.ts";
import {
  PostingRequestSchema,
  PriorInvoiceSchema,
  PurchaseOrderSchema,
  VendorRecordSchema,
  type PostingReceipt,
  type PostingRequest,
} from "../invoice/schema.ts";
import { toMajorUnits, toMinorUnits } from "../invoice/money.ts";
export interface McpToolClient {
  listToolNames(): Promise<Set<string>>;
  call(toolName: string, input: unknown): Promise<unknown>;
}

const requiredPath = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value || !isAbsolute(value) || !existsSync(value) || !statSync(value).isFile())
    throw new Error(`${name} must be an existing absolute file path`);
  return value;
};

function createQuickBooksMcpToolClient(options: { enablePosting?: boolean } = {}): McpToolClient {
  const serverPath = requiredPath("QBO_MCP_SERVER_PATH"),
    tokenStorePath = requiredPath("QBO_MCP_TOKEN_STORE_PATH");
  const allowedTools = new Set([
    "search_vendors",
    "search_purchase_orders",
    "search_bills",
    ...(options.enablePosting ? ["create-bill"] : []),
  ]);
  const client = new MCPClient({
    id: "quickbooks-accounting",
    timeout: 30_000,
    servers: {
      quickbooks: {
        command: process.execPath,
        args: [serverPath],
        env: {
          QUICKBOOKS_TOKEN_STORE_PATH: tokenStorePath,
          QUICKBOOKS_DISABLE_WRITE: options.enablePosting ? "false" : "true",
          QUICKBOOKS_DISABLE_UPDATE: "true",
          QUICKBOOKS_DISABLE_DELETE: "true",
        },
      },
    },
  });
  const getTools = () => client.listTools();
  return {
    async listToolNames() {
      return new Set(Object.keys(await getTools()).map((name) => name.replace(/^quickbooks_/, "")));
    },
    async call(toolName, input) {
      if (!allowedTools.has(toolName)) throw new Error(`MCP tool not allowed: ${toolName}`);
      const tool = (await getTools())[`quickbooks_${toolName}`];
      if (!tool?.execute) throw new Error(`MCP tool unavailable: ${toolName}`);
      return tool.execute(input, {
        ...createObservabilityContext(),
        observe: noopObserve,
        requestContext: new RequestContext(),
      });
    },
  };
}

type QuickBooksReference = { value?: string; name?: string };
type QuickBooksLine = {
  Amount?: number; Description?: string;
  ItemBasedExpenseLineDetail?: {
    ItemRef?: QuickBooksReference;
    Qty?: number;
    UnitPrice?: number;
  };
};
type QuickBooksVendor = {
  Id?: string;
  DisplayName?: string;
  Active?: boolean;
  TaxIdentifier?: string;
};
type QuickBooksPurchaseOrder = {
  Id?: string;
  DocNumber?: string;
  VendorRef?: QuickBooksReference;
  CurrencyRef?: QuickBooksReference;
  TotalAmt?: number;
  Line?: QuickBooksLine[];
};
type QuickBooksBill = {
  Id?: string;
  DocNumber?: string;
  VendorRef?: QuickBooksReference;
  CurrencyRef?: QuickBooksReference;
  TotalAmt?: number;
  TxnDate?: string;
};

const required = (value: string | undefined, field: string) => {
  if (!value) throw new Error(`QuickBooks ${field} missing`);
  return value;
};

const mapVendor = (vendor: QuickBooksVendor) =>
  VendorRecordSchema.parse({
    id: required(vendor.Id, "Vendor.Id"),
    name: required(vendor.DisplayName, "Vendor.DisplayName"),
    taxId: vendor.TaxIdentifier ?? null,
    status: vendor.Active === false ? "inactive" : "approved",
  });

const mapPurchaseOrder = (order: QuickBooksPurchaseOrder) => {
  const currency = order.CurrencyRef?.value ?? "USD";

  return PurchaseOrderSchema.parse({
    id: required(order.Id, "PurchaseOrder.Id"),
    poNumber: required(order.DocNumber, "PurchaseOrder.DocNumber"),
    vendorId: required(order.VendorRef?.value, "PurchaseOrder.VendorRef"),
    currency,
    totalMinor: toMinorUnits(order.TotalAmt ?? 0, currency),
    lines: (order.Line ?? [])
      .filter((line) => line.ItemBasedExpenseLineDetail)
      .map((line) => {
        const detail = line.ItemBasedExpenseLineDetail!;
        const quantity = detail.Qty ?? 0, amount = line.Amount ?? 0;

        return {
          sku: detail.ItemRef?.value ?? detail.ItemRef?.name ?? null,
          description: line.Description ?? detail.ItemRef?.name ?? null,
          qty: quantity,
          unitPriceMinor: toMinorUnits(
            detail.UnitPrice ?? (quantity ? amount / quantity : 0),
            currency,
          ),
          lineTotalMinor: toMinorUnits(amount, currency),
        };
      }),
  });
};

const mapBill = (bill: QuickBooksBill) => {
  const currency = bill.CurrencyRef?.value ?? "USD";

  return PriorInvoiceSchema.parse({
    id: required(bill.Id, "Bill.Id"),
    vendorId: required(bill.VendorRef?.value, "Bill.VendorRef"),
    invoiceNumber: bill.DocNumber?.trim() || null,
    invoiceDate: required(bill.TxnDate, "Bill.TxnDate"),
    currency,
    totalMinor: toMinorUnits(bill.TotalAmt ?? 0, currency),
  });
};

const requiredTools = ["search_vendors", "search_purchase_orders", "search_bills"] as const;
const postingTool = "create-bill" as const;
const ToolResultSchema = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});
const isResultSummary = (text: string) =>
  /^Found \d+ .+:$/i.test(text.trim()) || /^Count:\s*\d+$/i.test(text.trim());

export const parseQuickBooksRecords = (result: unknown) => {
  const parsed = ToolResultSchema.parse(result),
    texts = parsed.content.flatMap((item) =>
      item.type === "text" && item.text ? [item.text] : [],
    );
  if (parsed.isError) throw new Error(texts.join("\n") || "MCP tool returned an error");
  return texts
    .flatMap((text) => {
      try {
        const value: unknown = JSON.parse(text);
        return Array.isArray(value) ? value : [value];
      } catch {
        // Intuit search tools prefix JSON with a human-readable, tool-specific count.
        if (isResultSummary(text)) return [];
        throw new Error(`MCP tool returned non-JSON output: ${text}`);
      }
    })
    .filter(
      (value): value is Record<string, unknown> =>
        Boolean(value) && typeof value === "object" && !Array.isArray(value),
    );
};

interface QuickBooksMcpPostingConfig {
  expenseAccountId: string;
  taxAccountId?: string;
  apAccountId?: string;
  lockDirectory?: string;
}

const createQuickBooksConnector = (client: McpToolClient, postingConfig?: QuickBooksMcpPostingConfig) => {
  let verified: Promise<void> | undefined;
  const verifyTools = async () => {
    const available = await client.listToolNames();
    const expected = [...requiredTools, ...(postingConfig ? [postingTool] : [])];
    const missing = expected.filter((tool) => !available.has(tool));
    if (missing.length)
      throw new Error(`QuickBooks MCP is missing required tools: ${missing.join(", ")}`);
  };

  const ensureTools = async () => {
    try {
      await (verified ??= verifyTools());
    } catch (error) {
      verified = undefined;
      throw error;
    }
  };

  const call = async (tool: (typeof requiredTools)[number] | typeof postingTool, params: unknown) => {
    try {
      await ensureTools();
      return parseQuickBooksRecords(await client.call(tool, { params }));
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      throw new ProviderUnavailableError("quickbooks-mcp", tool, { cause: error });
    }
  };
  const findVendors = async (input: VendorLookup) => {
    const rows = await call("search_vendors", {
      criteria: [{ field: "DisplayName", value: input.name, operator: "=" }],
      fetchAll: true,
    });
    return rows.map((row) => mapVendor(row as QuickBooksVendor));
  };
  const findPurchaseOrders = async (poNumber: string) => {
    const rows = await call("search_purchase_orders", { limit: 1000 }),
      matches = rows.filter((row) => row.DocNumber === poNumber);
    if (!matches.length && rows.length === 1000)
      throw new ProviderUnavailableError(
        "quickbooks-mcp",
        "search_purchase_orders result window exhausted",
      );
    return matches.map((row) => mapPurchaseOrder(row as QuickBooksPurchaseOrder));
  };
  const listBills = async () =>
    (await call("search_bills", { fetchAll: true })).map((row) =>
      mapBill(row as QuickBooksBill),
    );

  const post = async (input: PostingRequest, config: QuickBooksMcpPostingConfig): Promise<PostingReceipt> => {
    if (input.invoice.invoiceNumber.length > 21)
      throw new Error("QuickBooks bill DocNumber cannot exceed 21 characters");
    const marker = `AP workflow idempotency: ${input.idempotencyKey}`;
    const prior = await call("search_bills", {
      criteria: [{ field: "DocNumber", value: input.invoice.invoiceNumber, operator: "=" }],
      fetchAll: true,
    });
    const sameVendor = prior.filter(
      (row) => row.VendorRef && (row.VendorRef as { value?: string }).value === input.vendor.id,
    );
    if (sameVendor.length) {
      const exact = sameVendor.find(
        (row) =>
          row.PrivateNote === marker &&
          row.TxnDate === input.invoice.invoiceDate &&
          row.TotalAmt === toMajorUnits(input.invoice.totalMinor, input.invoice.currency) &&
          ((row.CurrencyRef as { value?: string } | undefined)?.value ?? input.invoice.currency) ===
            input.invoice.currency,
      );
      if (!exact?.Id)
        throw new Error(
          `QuickBooks already has a conflicting bill numbered ${input.invoice.invoiceNumber}`,
        );
      return {
        status: "already_posted",
        providerId: "quickbooks-mcp",
        externalBillId: required(exact.Id as string | undefined, "Bill.Id"),
        postedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      };
    }
    const tax = input.invoice.taxMinor ?? 0;
    if (tax && !config.taxAccountId)
      throw new Error("QBO_MCP_TAX_ACCOUNT_ID is required to post an invoice with tax");
    if (
      input.invoice.subtotalMinor !== null &&
      input.invoice.subtotalMinor + tax !== input.invoice.totalMinor
    )
      throw new Error("Invoice subtotal and tax do not reconcile to the approved total");
    const amounts = input.invoice.lines.map(
      (line) =>
        line.lineTotalMinor ??
        new Decimal(line.unitPriceMinor)
          .mul(line.qty)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber(),
    );
    const expectedSubtotal = input.invoice.subtotalMinor ?? input.invoice.totalMinor - tax;
    if (amounts.reduce((sum, amount) => sum + amount, 0) !== expectedSubtotal)
      throw new Error("Invoice lines do not reconcile to the posting subtotal");
    const line = input.invoice.lines.map((item, index) => ({
      Amount: toMajorUnits(amounts[index]!, input.invoice.currency),
      DetailType: "AccountBasedExpenseLineDetail",
      Description: item.description,
      AccountBasedExpenseLineDetail: { AccountRef: { value: config.expenseAccountId } },
    }));
    if (tax)
      line.push({
        Amount: toMajorUnits(tax, input.invoice.currency),
        DetailType: "AccountBasedExpenseLineDetail",
        Description: "Invoice tax",
        AccountBasedExpenseLineDetail: { AccountRef: { value: config.taxAccountId! } },
      });
    const bill = {
      VendorRef: { value: input.vendor.id },
      DocNumber: input.invoice.invoiceNumber,
      TxnDate: input.invoice.invoiceDate,
      CurrencyRef: { value: input.invoice.currency },
      TotalAmt: toMajorUnits(input.invoice.totalMinor, input.invoice.currency),
      Line: line,
      PrivateNote: marker,
      ...(config.apAccountId && { APAccountRef: { value: config.apAccountId } }),
      ...(input.purchaseOrder && {
        LinkedTxn: [{ TxnId: input.purchaseOrder.id, TxnType: "PurchaseOrder" }],
      }),
    };
    const created = (await call(postingTool, { bill }))[0];
    if (!created?.Id)
      throw new ProviderUnavailableError("quickbooks-mcp", "create-bill returned no Bill.Id");
    return {
      status: "posted",
      providerId: "quickbooks-mcp",
      externalBillId: required(created.Id as string | undefined, "Bill.Id"),
      postedAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
    };
  };

  const withPostingLock = async (input: PostingRequest, config: QuickBooksMcpPostingConfig) => {
    const root = config.lockDirectory ?? resolve("data/qbo-posting-locks");
    const invoiceKey = input.invoice.invoiceNumber.trim().toLowerCase();
    const lock = resolve(root, createHash("sha256").update(invoiceKey).digest("hex"));
    await mkdir(root, { recursive: true, mode: 0o700 });
    const deadline = Date.now() + 15_000;
    while (true) {
      try {
        await mkdir(lock, { mode: 0o700 });
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (Date.now() >= deadline)
          throw new ProviderUnavailableError(
            "quickbooks-mcp",
            "posting idempotency lock is held; reconcile the invoice before retrying",
          );
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
    }
    try {
      return await post(input, config);
    } finally {
      await rmdir(lock).catch(() => undefined);
    }
  };

  const postBill = (input: PostingRequest) => {
    if (!postingConfig) throw new Error("QuickBooks MCP posting is disabled");
    return withPostingLock(PostingRequestSchema.parse(input), postingConfig);
  };
  return { findVendors, findPurchaseOrders, listBills, postBill };
};

function resolveQuickBooksMcpConfiguration(): QuickBooksMcpPostingConfig | undefined {
  const postingValue = process.env.QBO_MCP_ENABLE_POSTING?.trim().toLowerCase();
  if (postingValue && !["true", "false"].includes(postingValue))
    throw new Error("QBO_MCP_ENABLE_POSTING must be true or false");
  if (postingValue !== "true") return;

  const expenseAccountId = process.env.QBO_MCP_EXPENSE_ACCOUNT_ID?.trim();
  if (!expenseAccountId)
    throw new Error(
      "QBO_MCP_EXPENSE_ACCOUNT_ID is required when QuickBooks MCP posting is enabled",
    );
  if (process.env.QBO_MCP_SINGLE_WRITER?.trim().toLowerCase() !== "true")
    throw new Error(
      "QBO_MCP_SINGLE_WRITER=true is required when QuickBooks MCP posting is enabled",
    );
  return {
    expenseAccountId,
    taxAccountId: process.env.QBO_MCP_TAX_ACCOUNT_ID?.trim(),
    apAccountId: process.env.QBO_MCP_AP_ACCOUNT_ID?.trim(),
    lockDirectory: process.env.QBO_MCP_POSTING_LOCK_DIR?.trim() || undefined,
  };
}

export function makeQuickBooksProvider(client?: McpToolClient): AccountingProvider {
  const postingConfig = resolveQuickBooksMcpConfiguration();
  const postingEnabled = Boolean(postingConfig);
  const resolvedClient = client ?? createQuickBooksMcpToolClient({ enablePosting: postingEnabled });
  const connector = createQuickBooksConnector(resolvedClient, postingConfig);
  return {
    id: "quickbooks-mcp",
    findVendors: connector.findVendors,
    findPurchaseOrders: connector.findPurchaseOrders,
    listBills: connector.listBills,
    ...(postingEnabled && { postBill: connector.postBill }),
  };
}
