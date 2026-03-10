import { createTool } from '@mastra/core/tools';
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from 'plaid';
import { z } from 'zod';

const accessTokenSchema = z
  .string({ required_error: 'A Plaid access token is required.' })
  .min(1, 'A Plaid access token is required.')
  .describe('Plaid access token for the connected account.');

const dateSchema = z
  .string({ required_error: 'A date in YYYY-MM-DD format is required.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
  .describe('Date in YYYY-MM-DD format.');

export const getAccountBalanceInputSchema = z.object({
  access_token: accessTokenSchema,
});

export const getTransactionsInputSchema = z.object({
  access_token: accessTokenSchema,
  start_date: dateSchema.describe('Start date for the transaction query in YYYY-MM-DD format.'),
  end_date: dateSchema.describe('End date for the transaction query in YYYY-MM-DD format.'),
});

export const createSandboxTokenInputSchema = z
  .object({})
  .describe('No input is required. Generates a Plaid sandbox access token.');

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

export const fetchAccountBalance = async (input: z.infer<typeof getAccountBalanceInputSchema>) => {
  const { access_token } = getAccountBalanceInputSchema.parse(input);

  try {
    const client = createPlaidClient();
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

export const fetchTransactions = async (input: z.infer<typeof getTransactionsInputSchema>) => {
  const { access_token, start_date, end_date } = getTransactionsInputSchema.parse(input);

  try {
    const client = createPlaidClient();
    const response = await client.transactionsGet({
      access_token,
      start_date,
      end_date,
    });

    const transactions = response.data.transactions.map(transaction => ({
      name: transaction.name,
      amount: transaction.amount,
      date: transaction.date,
      category: transaction.category ?? [],
      currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code ?? null,
    }));

    return {
      transactions,
      total: transactions.length,
    };
  } catch (error) {
    throw new Error(
      `Failed to fetch transactions from Plaid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

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
      access_token: exchangeResponse.data.access_token,
    };
  } catch (error) {
    throw new Error(
      `Failed to create a Plaid sandbox access token: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const getAccountBalance = createTool({
  id: 'getAccountBalance',
  description: 'Fetch account balances for a Plaid access token.',
  inputSchema: getAccountBalanceInputSchema,
  execute: async input => {
    return fetchAccountBalance(input);
  },
});

export const getTransactions = createTool({
  id: 'getTransactions',
  description: 'Fetch transaction history for a Plaid access token and date range.',
  inputSchema: getTransactionsInputSchema,
  execute: async input => {
    return fetchTransactions(input);
  },
});

export const createSandboxToken = createTool({
  id: 'createSandboxToken',
  description: 'Create and exchange a Plaid sandbox public token into an access token.',
  inputSchema: createSandboxTokenInputSchema,
  execute: async () => {
    return createSandboxAccessToken();
  },
});
