import { makeQuickBooksProvider } from "./quickbooks.ts";
import type { AccountingProvider, InvoiceHistory } from "./types.ts";
import type { PolicyConfig, PriorInvoice } from "../invoice/schema.ts";

class InMemoryInvoiceHistory implements InvoiceHistory {
  private readonly invoices = new Map<string, PriorInvoice>();

  async findPotentialDuplicates(input: {
    vendorId: string;
    invoiceNumber: string;
    currency: string;
    totalMinor: number;
  }) {
    const invoiceNumber = input.invoiceNumber.trim().toLowerCase();
    return [...this.invoices.values()].filter(
      (invoice) =>
        invoice.vendorId === input.vendorId &&
        (invoice.invoiceNumber?.trim().toLowerCase() === invoiceNumber ||
          (invoice.currency === input.currency && invoice.totalMinor === input.totalMinor)),
    );
  }

  async seed(invoices: PriorInvoice[]) {
    for (const invoice of invoices) this.invoices.set(invoice.id, invoice);
  }

  async save(invoice: PriorInvoice) {
    this.invoices.set(invoice.id, invoice);
  }
}

const configuredNumber = (name: string, fallback: number) => {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
  return value;
};
const configuredBoolean = (name: string, fallback: boolean) => {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (!["true", "false"].includes(raw)) throw new Error(`${name} must be true or false`);
  return raw === "true";
};

const policy: PolicyConfig = {
  approvalThresholdMinor: configuredNumber("AP_APPROVAL_THRESHOLD_MINOR", 100_000),
  amountToleranceMinor: configuredNumber("AP_AMOUNT_TOLERANCE_MINOR", 1),
  lowConfidenceThreshold: configuredNumber("AP_LOW_CONFIDENCE_THRESHOLD", 0.8),
  allowUnscreenedVendors: configuredBoolean("AP_ALLOW_UNSCREENED_VENDORS", false),
};
if (!Number.isSafeInteger(policy.approvalThresholdMinor))
  throw new Error("AP_APPROVAL_THRESHOLD_MINOR must be a safe integer");
if (!Number.isSafeInteger(policy.amountToleranceMinor))
  throw new Error("AP_AMOUNT_TOLERANCE_MINOR must be a safe integer");
if (policy.lowConfidenceThreshold > 1)
  throw new Error("AP_LOW_CONFIDENCE_THRESHOLD must be between 0 and 1");

const providerFactories: Record<string, () => AccountingProvider> = {
  "quickbooks-mcp": makeQuickBooksProvider,
};

const loadProvider = () => {
  const providerId = process.env.ACCOUNTING_PROVIDER?.trim() || "quickbooks-mcp";
  const factory = providerFactories[providerId];
  if (factory) return factory();
  throw new Error(`Unsupported accounting provider: ${providerId}`);
};

export interface InvoiceRuntime {
  provider: AccountingProvider;
  history: InvoiceHistory;
  policy: PolicyConfig;
  seedHistory(): Promise<void>;
}

export function createInvoiceRuntime(provider = loadProvider()): InvoiceRuntime {
  const history = new InMemoryInvoiceHistory();
  let historySeed: Promise<void> | undefined;

  return {
    provider,
    history,
    policy,
    async seedHistory() {
      if (!provider.listBills) return;
      try {
        return await (historySeed ??= provider
          .listBills()
          .then((invoices) => history.seed(invoices)));
      } catch (error) {
        historySeed = undefined;
        throw error;
      }
    },
  };
}

export const activeInvoiceRuntime = createInvoiceRuntime();
