import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAccountsBalanceGet = vi.fn();
const mockTransactionsGet = vi.fn();
const mockSandboxPublicTokenCreate = vi.fn();
const mockItemPublicTokenExchange = vi.fn();

vi.mock('plaid', () => {
  return {
    Configuration: class Configuration {
      constructor(public options: unknown) {}
    },
    CountryCode: {
      Us: 'US',
    },
    PlaidApi: class PlaidApi {
      accountsBalanceGet = mockAccountsBalanceGet;
      transactionsGet = mockTransactionsGet;
      sandboxPublicTokenCreate = mockSandboxPublicTokenCreate;
      itemPublicTokenExchange = mockItemPublicTokenExchange;
    },
    PlaidEnvironments: {
      sandbox: 'https://sandbox.plaid.com',
    },
    Products: {
      Transactions: 'transactions',
      Auth: 'auth',
    },
  };
});

describe('Plaid tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLAID_CLIENT_ID = 'test-client-id';
    process.env.PLAID_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.PLAID_CLIENT_ID;
    delete process.env.PLAID_SECRET;
    vi.clearAllMocks();
  });

  it('fetchAccountBalance returns correctly shaped account data', async () => {
    const { createSandboxAccessToken, fetchAccountBalance } = await import('./plaid');

    mockSandboxPublicTokenCreate.mockResolvedValue({
      data: {
        public_token: 'public-sandbox-token',
      },
    });
    mockItemPublicTokenExchange.mockResolvedValue({
      data: {
        access_token: 'access-sandbox-token',
      },
    });
    const { session_handle } = await createSandboxAccessToken();

    mockAccountsBalanceGet.mockResolvedValue({
      data: {
        accounts: [
          {
            name: 'Plaid Checking',
            type: 'depository',
            balances: {
              available: 1200.5,
              current: 1250.5,
              iso_currency_code: 'USD',
            },
          },
        ],
      },
    });

    await expect(fetchAccountBalance({ session_handle })).resolves.toEqual([
      {
        name: 'Plaid Checking',
        type: 'depository',
        available: 1200.5,
        current: 1250.5,
        currency: 'USD',
      },
    ]);
  });

  it('fetchTransactions returns correctly shaped transaction data', async () => {
    const { createSandboxAccessToken, fetchTransactions } = await import('./plaid');

    mockSandboxPublicTokenCreate.mockResolvedValue({
      data: {
        public_token: 'public-sandbox-token',
      },
    });
    mockItemPublicTokenExchange.mockResolvedValue({
      data: {
        access_token: 'access-sandbox-token',
      },
    });
    const { session_handle } = await createSandboxAccessToken();

    mockTransactionsGet.mockResolvedValue({
      data: {
        transactions: [
          {
            name: 'Coffee Shop',
            amount: 6.25,
            date: '2026-03-01',
            category: ['Food and Drink', 'Coffee Shop'],
            iso_currency_code: 'USD',
          },
        ],
        total_transactions: 1,
      },
    });

    await expect(
      fetchTransactions({
        session_handle,
        start_date: '2026-03-01',
        end_date: '2026-03-10',
      }),
    ).resolves.toEqual({
      transactions: [
        {
          name: 'Coffee Shop',
          amount: 6.25,
          date: '2026-03-01',
          category: ['Food and Drink', 'Coffee Shop'],
          currency: 'USD',
        },
      ],
      total: 1,
    });
  });

  it('fetchAccountBalance throws descriptive error when API fails', async () => {
    const { createSandboxAccessToken, fetchAccountBalance } = await import('./plaid');

    mockSandboxPublicTokenCreate.mockResolvedValue({
      data: {
        public_token: 'public-sandbox-token',
      },
    });
    mockItemPublicTokenExchange.mockResolvedValue({
      data: {
        access_token: 'access-sandbox-token',
      },
    });
    const { session_handle } = await createSandboxAccessToken();

    mockAccountsBalanceGet.mockRejectedValue(new Error('plaid upstream unavailable'));

    await expect(fetchAccountBalance({ session_handle })).rejects.toThrow(
      'Failed to fetch account balances from Plaid: plaid upstream unavailable',
    );
  });

  it('fetchTransactions throws for missing required inputs', async () => {
    const { fetchTransactions } = await import('./plaid');

    await expect(
      fetchTransactions({
        session_handle: '',
        start_date: '2026-03-01',
        end_date: '2026-03-10',
      }),
    ).rejects.toThrow('A Plaid session handle is required.');
  });

  it('createSandboxAccessToken successfully returns session_handle', async () => {
    const { createSandboxAccessToken } = await import('./plaid');

    mockSandboxPublicTokenCreate.mockResolvedValue({
      data: {
        public_token: 'public-sandbox-token',
      },
    });
    mockItemPublicTokenExchange.mockResolvedValue({
      data: {
        access_token: 'access-sandbox-token',
      },
    });

    await expect(createSandboxAccessToken()).resolves.toEqual({
      session_handle: expect.stringMatching(/^plaid-sandbox-/),
    });
  });
});
