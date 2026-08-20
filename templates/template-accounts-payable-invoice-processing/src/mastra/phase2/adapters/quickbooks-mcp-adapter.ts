import { z } from 'zod';
import Decimal from 'decimal.js';
import { createHash } from 'node:crypto';
import { mkdir, rmdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  PostingConflictError,
  ProviderUnavailableError,
  type PostingAdapter,
  type PurchaseOrderRepository,
  type VendorLookup,
  type VendorRepository,
} from '../ports.ts';
import { PostingReceiptSchema, PostingRequestSchema, type PostingRequest } from '../schemas.ts';
import {
  mapQboBill,
  mapQboPurchaseOrder,
  mapQboVendor,
  type QboBill,
  type QboPurchaseOrder,
  type QboVendor,
} from './quickbooks-adapter.ts';
import type { McpToolClient } from './mcp-tool-client.ts';

const requiredTools = ['search_vendors', 'search_purchase_orders', 'search_bills'] as const;
const postingTool = 'create-bill' as const;
const ToolResultSchema = z
  .object({
    isError: z.boolean().optional(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()),
  })
  .passthrough();
const records = (result: unknown) => {
  const parsed = ToolResultSchema.parse(result),
    texts = parsed.content.flatMap(item => (item.type === 'text' && item.text ? [item.text] : []));
  if (parsed.isError || texts.some(text => text.startsWith('Error ')))
    throw new Error(texts.join('\n') || 'MCP tool returned an error');
  return texts
    .flatMap(text => {
      try {
        const value: unknown = JSON.parse(text);
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    })
    .filter(
      (value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    );
};

export interface QuickBooksMcpPostingConfig {
  expenseAccountId: string;
  taxAccountId?: string;
  apAccountId?: string;
  lockDirectory?: string;
}
const exponent = (currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
const major = (minor: number, currency: string) =>
  new Decimal(minor).div(new Decimal(10).pow(exponent(currency))).toNumber();

export class QuickBooksMcpAdapter implements VendorRepository, PurchaseOrderRepository, PostingAdapter {
  private verification?: Promise<void>;
  private readonly posting = new Map<string, Promise<ReturnType<typeof PostingReceiptSchema.parse>>>();
  constructor(
    private readonly client: McpToolClient,
    private readonly poLimit = 1000,
    private readonly postingConfig?: QuickBooksMcpPostingConfig,
  ) {
    if (!Number.isInteger(poLimit) || poLimit < 1 || poLimit > 1000)
      throw new Error('QuickBooks MCP PO limit must be an integer from 1 to 1000');
  }
  async verifyTools() {
    const tools = await this.client.listToolNames(),
      expected = [...requiredTools, ...(this.postingConfig ? [postingTool] : [])],
      missing = expected.filter(tool => !tools.has(tool));
    const mutations = [...tools].filter(tool =>
      this.postingConfig ? /^(update|delete)[_-]/.test(tool) : /^(create|update|delete)[_-]/.test(tool),
    );
    if (missing.length) throw new Error(`QuickBooks MCP is missing required tools: ${missing.join(', ')}`);
    if (mutations.length)
      throw new Error(`QuickBooks MCP provider refuses unsupported mutation tools: ${mutations.join(', ')}`);
  }
  private async ensureVerified() {
    const verification = (this.verification ??= this.verifyTools());
    try {
      await verification;
    } catch (error) {
      if (this.verification === verification) this.verification = undefined;
      throw error;
    }
  }
  private async call(tool: (typeof requiredTools)[number] | typeof postingTool, params: unknown) {
    try {
      await this.ensureVerified();
      return records(await this.client.call(tool, { params }));
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      throw new ProviderUnavailableError('quickbooks-mcp', tool, { cause: error });
    }
  }
  async find(input: VendorLookup) {
    const rows = await this.call('search_vendors', {
      criteria: [{ field: 'DisplayName', value: input.name, operator: '=' }],
      fetchAll: true,
    });
    return rows.map(row => mapQboVendor(row as QboVendor));
  }
  async findByNumber(poNumber: string) {
    const rows = await this.call('search_purchase_orders', { limit: this.poLimit }),
      matches = rows.filter(row => row.DocNumber === poNumber);
    if (!matches.length && rows.length === this.poLimit)
      throw new ProviderUnavailableError('quickbooks-mcp', 'search_purchase_orders result window exhausted');
    return matches.map(row => mapQboPurchaseOrder(row as QboPurchaseOrder));
  }
  async billHistorySeed() {
    return (await this.call('search_bills', { fetchAll: true })).map(row => mapQboBill(row as QboBill));
  }
  async postBill(input: PostingRequest) {
    if (!this.postingConfig) throw new Error('QuickBooks MCP posting is disabled');
    input = PostingRequestSchema.parse(input);
    const pending = this.posting.get(input.idempotencyKey) ?? this.withPostingLock(input);
    this.posting.set(input.idempotencyKey, pending);
    try {
      return await pending;
    } finally {
      if (this.posting.get(input.idempotencyKey) === pending) this.posting.delete(input.idempotencyKey);
    }
  }
  private async withPostingLock(input: PostingRequest) {
    const root = this.postingConfig?.lockDirectory ?? resolve('data/qbo-posting-locks');
    const conflictIdentity = input.invoice.invoiceNumber.trim().toLowerCase();
    const lock = resolve(root, createHash('sha256').update(conflictIdentity).digest('hex'));
    await mkdir(root, { recursive: true, mode: 0o700 });
    const deadline = Date.now() + 15_000;
    while (true) {
      try {
        await mkdir(lock, { mode: 0o700 });
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (Date.now() >= deadline)
          throw new ProviderUnavailableError(
            'quickbooks-mcp',
            'posting idempotency lock is held; reconcile the invoice before retrying',
          );
        await new Promise(resolveWait => setTimeout(resolveWait, 100));
      }
    }
    try {
      return await this.post(input);
    } finally {
      await rmdir(lock).catch(() => undefined);
    }
  }
  private async post(input: PostingRequest) {
    const config = this.postingConfig;
    if (!config) throw new Error('QuickBooks MCP posting is disabled');
    if (input.invoice.invoiceNumber.length > 21)
      throw new PostingConflictError('QuickBooks bill DocNumber cannot exceed 21 characters');
    const marker = `AP workflow idempotency: ${input.idempotencyKey}`;
    const prior = await this.call('search_bills', {
      criteria: [{ field: 'DocNumber', value: input.invoice.invoiceNumber, operator: '=' }],
      fetchAll: true,
    });
    if (prior.length) {
      const exact = prior.find(
        row =>
          row.PrivateNote === marker &&
          row.TxnDate === input.invoice.invoiceDate &&
          row.VendorRef &&
          (row.VendorRef as { value?: string }).value === input.vendor.id &&
          row.TotalAmt === major(input.invoice.totalMinor, input.invoice.currency) &&
          ((row.CurrencyRef as { value?: string } | undefined)?.value ?? input.invoice.currency) ===
            input.invoice.currency,
      );
      if (!exact?.Id)
        throw new PostingConflictError(
          `QuickBooks already has a conflicting bill numbered ${input.invoice.invoiceNumber}`,
        );
      return PostingReceiptSchema.parse({
        status: 'already_posted',
        providerId: 'quickbooks-mcp',
        externalBillId: exact.Id,
        postedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      });
    }
    const tax = input.invoice.taxMinor ?? 0;
    if (tax && !config.taxAccountId)
      throw new PostingConflictError('QBO_MCP_TAX_ACCOUNT_ID is required to post an invoice with tax');
    const amounts = input.invoice.lines.map(
      line =>
        line.lineTotalMinor ??
        new Decimal(line.unitPriceMinor).mul(line.qty).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    );
    const expectedSubtotal = input.invoice.subtotalMinor ?? input.invoice.totalMinor - tax;
    if (amounts.reduce((sum, amount) => sum + amount, 0) !== expectedSubtotal)
      throw new PostingConflictError('Invoice lines do not reconcile to the posting subtotal');
    const line = input.invoice.lines.map((item, index) => ({
      Amount: major(amounts[index]!, input.invoice.currency),
      DetailType: 'AccountBasedExpenseLineDetail',
      Description: item.description,
      AccountBasedExpenseLineDetail: { AccountRef: { value: config.expenseAccountId } },
    }));
    if (tax)
      line.push({
        Amount: major(tax, input.invoice.currency),
        DetailType: 'AccountBasedExpenseLineDetail',
        Description: 'Invoice tax',
        AccountBasedExpenseLineDetail: { AccountRef: { value: config.taxAccountId! } },
      });
    const bill = {
      VendorRef: { value: input.vendor.id },
      DocNumber: input.invoice.invoiceNumber,
      TxnDate: input.invoice.invoiceDate,
      CurrencyRef: { value: input.invoice.currency },
      TotalAmt: major(input.invoice.totalMinor, input.invoice.currency),
      Line: line,
      PrivateNote: marker,
      ...(config.apAccountId && { APAccountRef: { value: config.apAccountId } }),
      ...(input.purchaseOrder && {
        LinkedTxn: [{ TxnId: input.purchaseOrder.id, TxnType: 'PurchaseOrder' }],
      }),
    };
    const created = (await this.call(postingTool, { bill }))[0];
    if (!created?.Id) throw new ProviderUnavailableError('quickbooks-mcp', 'create-bill returned no Bill.Id');
    return PostingReceiptSchema.parse({
      status: 'posted',
      providerId: 'quickbooks-mcp',
      externalBillId: created.Id,
      postedAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
    });
  }
  disconnect() {
    return this.client.disconnect();
  }
}
