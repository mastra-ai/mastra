import { describe, expect, it } from 'vitest';

import {
  TaskmarketAuthorizationError,
  TaskmarketValidationError,
  authorizeTaskCreation,
  buildConfirmationCode,
  buildCreatePreview,
  usdcToBaseUnits,
  validateCreateConfig,
} from '../create.js';

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    description: 'Write a one-page summary of the Base agentic economy in 2026.',
    rewardUsdc: '25',
    durationHours: 72,
    mode: 'bounty' as const,
    taskVisibility: 'public' as const,
    submissionVisibility: 'public' as const,
    maxSpendUsdc: '25',
    tags: ['research'],
    ...overrides,
  };
}

describe('validateCreateConfig', () => {
  it('accepts a valid bounty configuration and builds CLI args', () => {
    const { config, args } = validateCreateConfig(baseConfig());

    expect(config.description).toContain('Base agentic economy');
    expect(args).toContain('--description');
    expect(args).toContain('--reward');
    expect(args).toContain('25');
    expect(args).toContain('--duration');
    expect(args).toContain('72');
    expect(args).toContain('--mode');
    expect(args).toContain('bounty');
    expect(args).toContain('--task-visibility');
    expect(args).toContain('--submission-visibility');
    expect(args).not.toContain('--max-spend');
  });

  it('rejects a description that is too short', () => {
    expect(() => validateCreateConfig(baseConfig({ description: 'short' }))).toThrow(
      TaskmarketValidationError,
    );
    expect(() => validateCreateConfig(baseConfig({ description: 'short' }))).toThrow(
      /description/,
    );
  });

  it('rejects a non-numeric reward', () => {
    expect(() => validateCreateConfig(baseConfig({ rewardUsdc: 'abc' }))).toThrow(
      /reward must be a USDC amount/,
    );
  });

  it('rejects a zero reward', () => {
    expect(() => validateCreateConfig(baseConfig({ rewardUsdc: '0' }))).toThrow(
      /reward must be greater than zero/,
    );
  });

  it('rejects a reward with more than 6 decimal places', () => {
    expect(() => validateCreateConfig(baseConfig({ rewardUsdc: '1.0000001' }))).toThrow(
      /reward must be a USDC amount/,
    );
  });

  it('rejects a non-positive duration', () => {
    expect(() => validateCreateConfig(baseConfig({ durationHours: -1 }))).toThrow(
      /duration must be a positive number/,
    );
  });

  it('rejects an unknown mode', () => {
    expect(() => validateCreateConfig(baseConfig({ mode: 'weird' }))).toThrow(/mode must be one of/);
  });

  it('rejects an unknown task visibility', () => {
    expect(() =>
      validateCreateConfig(baseConfig({ taskVisibility: 'secret' })),
    ).toThrow(/taskVisibility must be one of/);
  });

  it('rejects an unknown submission visibility', () => {
    expect(() =>
      validateCreateConfig(baseConfig({ submissionVisibility: 'later' })),
    ).toThrow(/submissionVisibility must be one of/);
  });

  it('rejects a max spend below the reward', () => {
    expect(() => validateCreateConfig(baseConfig({ maxSpendUsdc: '10' }))).toThrow(
      /maxSpend .* must be at least the reward/,
    );
  });

  it('accepts a max spend above the reward', () => {
    const { config } = validateCreateConfig(baseConfig({ maxSpendUsdc: '30' }));
    expect(config.maxSpendUsdc).toBe('30');
  });

  it('rejects auction-only fields on a bounty task', () => {
    expect(() =>
      validateCreateConfig(baseConfig({ auctionType: 'dutch' as const })),
    ).toThrow(/auction-only fields require mode "auction"/);
  });

  it('rejects an auction without a type', () => {
    expect(() => validateCreateConfig(baseConfig({ mode: 'auction' as const }))).toThrow(
      /auction mode requires an auctionType/,
    );
  });

  it('rejects an auction whose max price differs from the reward', () => {
    expect(() =>
      validateCreateConfig(
        baseConfig({
          mode: 'auction' as const,
          auctionType: 'english' as const,
          maxPriceUsdc: '30',
        }),
      ),
    ).toThrow(/maxPrice .* must equal reward/);
  });

  it('accepts a valid english auction', () => {
    const { args } = validateCreateConfig(
      baseConfig({
        mode: 'auction' as const,
        auctionType: 'english' as const,
        maxPriceUsdc: '25',
        bidDeadlineHours: 24,
      }),
    );
    expect(args).toContain('--auction-type');
    expect(args).toContain('--max-price');
    expect(args).toContain('--bid-deadline');
  });

  it('requires a floor price for dutch auctions', () => {
    expect(() =>
      validateCreateConfig(
        baseConfig({
          mode: 'auction' as const,
          auctionType: 'dutch' as const,
          maxPriceUsdc: '25',
        }),
      ),
    ).toThrow(/dutch auctions require auctionFloorPrice/);
  });

  it('rejects a dutch floor price above the reward', () => {
    expect(() =>
      validateCreateConfig(
        baseConfig({
          mode: 'auction' as const,
          auctionType: 'dutch' as const,
          maxPriceUsdc: '25',
          auctionFloorPriceUsdc: '30',
        }),
      ),
    ).toThrow(/auctionFloorPrice .* must not exceed reward/);
  });

  it('requires a start price for reverse_dutch auctions', () => {
    expect(() =>
      validateCreateConfig(
        baseConfig({
          mode: 'auction' as const,
          auctionType: 'reverse_dutch' as const,
          maxPriceUsdc: '25',
        }),
      ),
    ).toThrow(/reverse_dutch auctions require auctionStartPrice/);
  });

  it('rejects a reverse_dutch start price above the reward', () => {
    expect(() =>
      validateCreateConfig(
        baseConfig({
          mode: 'auction' as const,
          auctionType: 'reverse_dutch' as const,
          maxPriceUsdc: '25',
          auctionStartPriceUsdc: '26',
        }),
      ),
    ).toThrow(/auctionStartPrice .* must not exceed reward/);
  });

  it('rejects a private task without viewers or a password', () => {
    expect(() =>
      validateCreateConfig(baseConfig({ taskVisibility: 'private' as const })),
    ).toThrow(/requires at least one allowedViewers address or a privateAccessPassword/);
  });

  it('accepts a private task with an allowed viewer', () => {
    const { config } = validateCreateConfig(
      baseConfig({
        taskVisibility: 'private' as const,
        allowedViewers: ['0x93710f148a88d80B344BB1fEbB91DCBA9f80019F'],
      }),
    );
    expect(config.allowedViewers).toHaveLength(1);
  });

  it('rejects an invalid viewer address', () => {
    expect(() =>
      validateCreateConfig(
        baseConfig({
          taskVisibility: 'private' as const,
          allowedViewers: ['not-an-address'],
        }),
      ),
    ).toThrow(/invalid Ethereum address/);
  });

  it('rejects a short private access password', () => {
    expect(() =>
      validateCreateConfig(
        baseConfig({
          taskVisibility: 'private' as const,
          privateAccessPassword: 'short',
        }),
      ),
    ).toThrow(/privateAccessPassword must be at least 8 characters/);
  });

  it('rejects a password on a non-private task', () => {
    expect(() =>
      validateCreateConfig(baseConfig({ privateAccessPassword: 'longenough' })),
    ).toThrow(/only valid with taskVisibility "private"/);
  });

  it('trims the description and normalizes tags', () => {
    const { config, args } = validateCreateConfig(
      baseConfig({ description: '  Trimmed description for the test.  ', tags: [' a ', '', 'b '] }),
    );
    expect(config.description).toBe('Trimmed description for the test.');
    expect(config.tags).toEqual(['a', 'b']);
    expect(args).toContain('a,b');
  });
});

describe('usdcToBaseUnits', () => {
  it('converts whole USDC', () => {
    expect(usdcToBaseUnits('5')).toBe(5_000_000n);
  });

  it('converts fractional USDC with padding', () => {
    expect(usdcToBaseUnits('1.5')).toBe(1_500_000n);
    expect(usdcToBaseUnits('0.000001')).toBe(1n);
  });

  it('rejects invalid amounts', () => {
    expect(() => usdcToBaseUnits('abc')).toThrow(/Invalid USDC amount/);
    expect(() => usdcToBaseUnits('1.1234567')).toThrow(/Invalid USDC amount/);
  });
});

describe('buildConfirmationCode and authorizeTaskCreation', () => {
  it('binds the confirmation code to the exact configuration', () => {
    const first = buildCreatePreview(validateCreateConfig(baseConfig()).config);
    const second = buildCreatePreview(validateCreateConfig(baseConfig()).config);
    const changed = buildCreatePreview(
      validateCreateConfig(baseConfig({ rewardUsdc: '30', maxSpendUsdc: '30' })).config,
    );

    expect(first.confirmationCode).toBe(second.confirmationCode);
    expect(first.confirmationCode).not.toBe(changed.confirmationCode);
  });

  it('accepts the correct confirmation code', () => {
    const preview = buildCreatePreview(validateCreateConfig(baseConfig()).config);
    expect(() =>
      authorizeTaskCreation(preview, preview.confirmationCode, preview.confirmationCode),
    ).not.toThrow();
  });

  it('refuses a missing or wrong confirmation code', () => {
    const preview = buildCreatePreview(validateCreateConfig(baseConfig()).config);
    expect(() => authorizeTaskCreation(preview, 'wrong-code', preview.confirmationCode)).toThrow(
      TaskmarketAuthorizationError,
    );
    expect(() => authorizeTaskCreation(preview, 'wrong-code', preview.confirmationCode)).toThrow(
      /exact confirmation code/,
    );
    expect(() => authorizeTaskCreation(preview, '', preview.confirmationCode)).toThrow(
      TaskmarketAuthorizationError,
    );
  });

  it('refuses a max spend below the reward even with a valid code', () => {
    const preview = buildCreatePreview(validateCreateConfig(baseConfig()).config);
    const lyingPreview = { ...preview, maxSpendUsdc: '10' };
    expect(() =>
      authorizeTaskCreation(lyingPreview, lyingPreview.confirmationCode, lyingPreview.confirmationCode),
    ).toThrow(TaskmarketAuthorizationError);
  });

  it('includes the reward, network, and max spend in the preview', () => {
    const preview = buildCreatePreview(validateCreateConfig(baseConfig()).config);
    expect(preview.network).toBe('Base Mainnet');
    expect(preview.chainId).toBe(8453);
    expect(preview.usdcContract).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(preview.rewardUsdc).toBe('25');
    expect(preview.maxSpendUsdc).toBe('25');
    expect(preview.durationHours).toBe(72);
    expect(preview.mode).toBe('bounty');
  });
});
