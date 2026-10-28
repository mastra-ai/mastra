import { beforeEach, describe, expect, it, vi } from 'vitest';

const CANCEL = Symbol('cancel');

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === CANCEL),
  log: { info: vi.fn() },
}));

vi.mock('../auth/credentials.js', () => ({
  openBrowser: vi.fn(),
}));

vi.mock('./api.js', () => ({
  creditsPageUrl: (orgId: string) => `https://projects.test/orgs/${orgId}/settings/credits`,
}));

const prompts = await import('@clack/prompts');
const credentials = await import('../auth/credentials.js');
const { offerGatewayCredits } = await import('./credits');

const credits = (remaining: number, unlimited = false) => ({ remaining, unlimited });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('offerGatewayCredits', () => {
  it('does not ask when there are credits already', async () => {
    await expect(offerGatewayCredits({ orgId: 'o', credits: credits(5) })).resolves.toBe(false);
    expect(prompts.select).not.toHaveBeenCalled();
  });

  it('does not ask with an unlimited balance', async () => {
    await expect(offerGatewayCredits({ orgId: 'o', credits: credits(0, true) })).resolves.toBe(false);
    expect(prompts.select).not.toHaveBeenCalled();
  });

  it('asks at $0, says calls are paid per token, and opens nothing on skip', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('skip');

    await expect(offerGatewayCredits({ orgId: 'o', credits: credits(0) })).resolves.toBe(false);

    expect(prompts.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Your Gateway balance is $0.00. Model calls are paid per token from credits.',
        options: [
          { value: 'buy', label: 'Add credits', hint: 'opens the Mastra dashboard' },
          { value: 'skip', label: 'Skip for now' },
        ],
      }),
    );
    expect(credentials.openBrowser).not.toHaveBeenCalled();
  });

  it('opens the dashboard and returns right away', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('buy');

    await expect(offerGatewayCredits({ orgId: 'o', credits: credits(0) })).resolves.toBe(true);

    expect(credentials.openBrowser).toHaveBeenCalledWith('https://projects.test/orgs/o/settings/credits');
    expect(prompts.log.info).toHaveBeenCalledWith(
      expect.stringContaining('https://projects.test/orgs/o/settings/credits'),
    );
  });
});
