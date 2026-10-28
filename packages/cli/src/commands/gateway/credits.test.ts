import { beforeEach, describe, expect, it, vi } from 'vitest';

const CANCEL = Symbol('cancel');

const spinnerStop = vi.fn();
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === CANCEL),
  log: { info: vi.fn() },
  spinner: vi.fn(() => ({ start: vi.fn(), stop: spinnerStop })),
}));

vi.mock('../auth/credentials.js', () => ({
  openBrowser: vi.fn(),
  listenForSkipInput: vi.fn(() => () => {}),
}));

vi.mock('./api.js', () => ({
  DEFAULT_CREDITS_PURCHASE: 25,
  getGatewayCredits: vi.fn(),
  startCreditsCheckout: vi.fn(),
}));

const prompts = await import('@clack/prompts');
const credentials = await import('../auth/credentials.js');
const api = await import('./api.js');
const { offerGatewayCredits } = await import('./credits');

const credits = (remaining: number, unlimited = false) => ({
  remaining,
  unlimited,
  featureId: 'gateway_credits',
  topupPlanId: 'gateway_credit_topup',
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.mocked(api.startCreditsCheckout).mockResolvedValue('https://checkout.test/s/1');
});

describe('offerGatewayCredits', () => {
  it('does not ask when there are credits already', async () => {
    await expect(offerGatewayCredits({ token: 't', orgId: 'o', credits: credits(5) })).resolves.toEqual({
      remaining: 5,
    });
    expect(prompts.select).not.toHaveBeenCalled();
  });

  it('asks at $0 and says calls are paid per token', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('skip');

    await expect(offerGatewayCredits({ token: 't', orgId: 'o', credits: credits(0) })).resolves.toEqual({
      remaining: 0,
    });

    expect(prompts.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Your Gateway balance is $0.00. Model calls are paid per token from credits.',
        options: [
          { value: 'buy', label: 'Add $25.00 in credits', hint: 'opens your browser' },
          { value: 'skip', label: 'Skip for now' },
        ],
      }),
    );
    expect(api.startCreditsCheckout).not.toHaveBeenCalled();
  });

  it('opens checkout and waits until the purchase shows up in the balance', async () => {
    vi.useFakeTimers();
    vi.mocked(prompts.select).mockResolvedValueOnce('buy');
    vi.mocked(api.getGatewayCredits).mockResolvedValueOnce(credits(0)).mockResolvedValueOnce(credits(25));

    const result = offerGatewayCredits({ token: 't', orgId: 'o', credits: credits(0) });
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(result).resolves.toEqual({ remaining: 25, added: 25 });
    expect(api.startCreditsCheckout).toHaveBeenCalledWith('t', 'o', credits(0), 25);
    expect(credentials.openBrowser).toHaveBeenCalledWith('https://checkout.test/s/1');
    expect(api.getGatewayCredits).toHaveBeenCalledTimes(2);
  });

  it('stops waiting on any key and keeps the old balance', async () => {
    vi.useFakeTimers();
    vi.mocked(prompts.select).mockResolvedValueOnce('buy');
    vi.mocked(api.getGatewayCredits).mockResolvedValue(credits(0));
    vi.mocked(credentials.listenForSkipInput).mockImplementationOnce(onSkip => {
      setTimeout(onSkip, 1_000);
      return () => {};
    });

    const result = offerGatewayCredits({ token: 't', orgId: 'o', credits: credits(0) });
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(result).resolves.toEqual({ remaining: 0 });
    expect(api.getGatewayCredits).not.toHaveBeenCalled();
  });

  it('stops the spinner and cleans up when the wait is aborted', async () => {
    vi.useFakeTimers();
    vi.mocked(prompts.select).mockResolvedValueOnce('buy');
    vi.mocked(api.getGatewayCredits).mockResolvedValue(credits(0));
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

    const result = offerGatewayCredits({ token: 't', orgId: 'o', credits: credits(0), signal: controller.signal });
    const settled = expect(result).rejects.toThrow('cancelled');
    await vi.advanceTimersByTimeAsync(7_000);
    controller.abort(new Error('cancelled'));
    await settled;

    expect(removeListener).toHaveBeenCalledTimes(2);
    expect(spinnerStop).toHaveBeenCalledWith('Stopped waiting for checkout.');
  });

  it('keeps an unlimited balance', async () => {
    await expect(offerGatewayCredits({ token: 't', orgId: 'o', credits: credits(0, true) })).resolves.toEqual({
      remaining: 0,
      unlimited: true,
    });
    expect(prompts.select).not.toHaveBeenCalled();
  });

  it('offers more credits on request even with a balance', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('skip');

    await offerGatewayCredits({ token: 't', orgId: 'o', credits: credits(12.4), always: true });

    expect(prompts.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Your Gateway balance is $12.40. Model calls are paid per token from credits.',
      }),
    );
  });
});
