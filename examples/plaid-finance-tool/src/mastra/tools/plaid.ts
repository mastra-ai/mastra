import { createTool } from '@mastra/core/tools';
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from 'plaid';
import { z } from 'zod';

const sandboxSessionStore = new Map<string, string>();

const sessionHandleSchema = z
  .string({ required_error: 'A Plaid session handle is required.' })
  .min(1, 'A Plaid session handle is required.')
  .describe('Opaque server-side handle for a stored Plaid sandbox access token.');

const dateSchema = z
  .string({ required_error: 'A date in YYYY-MM-DD format is required.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
  .describe('Date in YYYY-MM-DD format.');

export const getAccountBalanceInputSchema = z.object({
  session_handle: sessionHandleSchema,
});

export const getTransactionsInputSchema = z.object({
  session_handle: sessionHandleSchema,
  start_date: dateSchema.describe('Start date for the transaction query in YYYY-MM-DD format.'),
  end_date: dateSchema.describe('End date for the transaction query in YYYY-MM-DD format.'),
});

export const createSandboxTokenInputSchema = z
  .object({})
  .describe('No input is required. Generates a sandbox-only Plaid session handle.');

const getPlaidCredentials = () => {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    throw new Error(
      'Missing Plaid credentials. Set PLAID_CLIENT_ID and PLAID_SECRET in your environment before using Plaid tools.',
    );
  }

  return { clientId, secret };
};

/** Creates a Plaid client configured for the sandbox environment. */
export const createPlaidClient = () => {
  const { clientId, secret } = getPlaidCredentials();

  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    }),
  );
};

const createSandboxSessionHandle = (accessToken: string) => {
  const sessionHandle = `plaid-sandbox-${crypto.randomUUID()}`;
  sandboxSessionStore.set(sessionHandle, accessToken);
  return sessionHandle;
};

const resolveAccessToken = (sessionHandle: string) => {
  const accessToken = sandboxSessionStore.get(sessionHandle);

  if (!accessToken) {
    throw new Error(
      `Unknown Plaid session handle "${sessionHandle}". Create a sandbox token first before requesting balances or transactions.`,
    );
  }

  return accessToken;
};

/** Fetches account balances using a stored sandbox session handle. */
export const fetchAccountBalance = async (input: z.infer<typeof getAccountBalanceInputSchema>) => {
  const { session_handle } = getAccountBalanceInputSchema.parse(input);

  try {
    const client = createPlaidClient();
    const access_token = resolveAccessToken(session_handle);
    const response = await client.accountsBalanceGet({ access_token });

    return response.data.accounts.map(account => ({
      name: account.name,
      type: account.type,
      available: account.balances.available,
      current: account.balances.current,
      currency: account.balances.iso_currency_code ?? account.balances.unofficial_currency_code ?? null,
    }));
  } catch (error) {
    throw new Error(
      `Failed to fetch account balances from Plaid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/** Fetches all transactions for a date range using Plaid pagination. */
export const fetchTransactions = async (input: z.infer<typeof getTransactionsInputSchema>) => {
  const { session_handle, start_date, end_date } = getTransactionsInputSchema.parse(input);

  try {
    const client = createPlaidClient();
    const access_token = resolveAccessToken(session_handle);
    const count = 500;
    let offset = 0;
    let totalTransactions = 0;
    const transactions: Array<{
      name: string;
      amount: number;
      date: string;
      category: string[];
      currency: string | null;
    }> = [];

    do {
      const response = await client.transactionsGet({
        access_token,
        start_date,
        end_date,
        options: {
          count,
          offset,
        },
      });

      totalTransactions = response.data.total_transactions;
      transactions.push(
        ...response.data.transactions.map(transaction => ({
          name: transaction.name,
          amount: transaction.amount,
          date: transaction.date,
          category: transaction.category ?? [],
          currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code ?? null,
        })),
      );
      offset += count;
    } while (transactions.length < totalTransactions);

    return {
      transactions,
      total: totalTransactions,
    };
  } catch (error) {
    throw new Error(
      `Failed to fetch transactions from Plaid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/** Creates a sandbox-only session handle and keeps the Plaid access token server-side. */
export const createSandboxAccessToken = async () => {
  try {
    const client = createPlaidClient();
    const publicTokenResponse = await client.sandboxPublicTokenCreate({
      institution_id: 'ins_109508',
      initial_products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
    });

    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token: publicTokenResponse.data.public_token,
    });

    return {
      session_handle: createSandboxSessionHandle(exchangeResponse.data.access_token),
    };
  } catch (error) {
    throw new Error(
      `Failed to create a Plaid sandbox access token: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const getAccountBalance = createTool({
  id: 'getAccountBalance',
  description: 'Fetch account balances for a stored Plaid sandbox session handle.',
  inputSchema: getAccountBalanceInputSchema,
  execute: async input => {
    return fetchAccountBalance(input);
  },
});

export const getTransactions = createTool({
  id: 'getTransactions',
  description: 'Fetch transaction history for a stored Plaid sandbox session handle and date range.',
  inputSchema: getTransactionsInputSchema,
  execute: async input => {
    return fetchTransactions(input);
  },
});

export const createSandboxToken = createTool({
  id: 'createSandboxToken',
  description: 'Create a sandbox-only Plaid session handle backed by a server-side access token.',
  inputSchema: createSandboxTokenInputSchema,
  execute: async () => {
    return createSandboxAccessToken();
  },
});
