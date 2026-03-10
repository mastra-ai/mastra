import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('getAccountBalance returns correctly shaped account data', async () => {
    const { fetchAccountBalance } = await import('./plaid');

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

    await expect(fetchAccountBalance({ access_token: 'access-sandbox-123' })).resolves.toEqual([
      {
        name: 'Plaid Checking',
        type: 'depository',
        available: 1200.5,
        current: 1250.5,
        currency: 'USD',
      },
    ]);
  });

  it('getTransactions returns correctly shaped transaction data', async () => {
    const { fetchTransactions } = await import('./plaid');

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
      },
    });

    await expect(
      fetchTransactions({
        access_token: 'access-sandbox-123',
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

  it('getAccountBalance throws descriptive error when API fails', async () => {
    const { fetchAccountBalance } = await import('./plaid');

    mockAccountsBalanceGet.mockRejectedValue(new Error('plaid upstream unavailable'));

    await expect(fetchAccountBalance({ access_token: 'access-sandbox-123' })).rejects.toThrow(
      'Failed to fetch account balances from Plaid: plaid upstream unavailable',
    );
  });

  it('getTransactions throws for missing required inputs', async () => {
    const { fetchTransactions } = await import('./plaid');

    await expect(
      fetchTransactions({
        access_token: '',
        start_date: '2026-03-01',
        end_date: '2026-03-10',
      }),
    ).rejects.toThrow('A Plaid access token is required.');
  });

  it('createSandboxToken successfully returns access_token', async () => {
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
      access_token: 'access-sandbox-token',
    });
  });
});
