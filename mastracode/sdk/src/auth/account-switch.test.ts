import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_SWITCH_PART_TYPE,
  accountSwitchNoticeText,
  isAccountSwitchReason,
  isModelFallbackReason,
  MODEL_FALLBACK_PART_TYPE,
  MODEL_FALLBACK_STATE_KEY,
  modelFallbackNoticeText,
  PROVIDER_DISPLAY_NAMES,
} from './account-switch.js';

/**
 * The browser-safe guarantee is "no imports at all": with none, nothing
 * node-only can arrive transitively either.
 */
describe('account-switch module is browser-safe', () => {
  for (const file of ['account-switch.ts', 'account-registry.ts']) {
    it(`${file} has no imports or requires`, () => {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/^\s*(import|export)\s[^;]*\sfrom\s/m);
      expect(source).not.toMatch(/\bimport\s*\(/);
      expect(source).not.toMatch(/\brequire\s*\(/);
      expect(source).not.toMatch(/\bnode:/);
    });
  }
});

describe('account-switch notices', () => {
  it('keeps the persisted part types and session key stable', () => {
    expect(ACCOUNT_SWITCH_PART_TYPE).toBe('data-mastracode-account-switch');
    expect(MODEL_FALLBACK_PART_TYPE).toBe('data-mastracode-model-fallback');
    expect(MODEL_FALLBACK_STATE_KEY).toBe('mastracodePendingModelFallback');
    expect(PROVIDER_DISPLAY_NAMES['openai-codex']).toBe('Codex');
  });

  it('formats switch, exhaustion and pinned notices', () => {
    const base = { provider: 'anthropic', at: '2026-10-29T00:00:00.000Z' };
    expect(
      accountSwitchNoticeText({
        ...base,
        from: { id: 'a', label: 'Work' },
        to: { id: 'b', label: 'Home' },
        reason: 'rate-limit',
      }),
    ).toBe('Switched Anthropic account: Work → Home (rate limit)');
    expect(accountSwitchNoticeText({ ...base, from: null, to: null, reason: 'pool-exhausted' })).toBe(
      'All Anthropic accounts unavailable (pool exhausted)',
    );
    expect(accountSwitchNoticeText({ ...base, from: null, to: null, reason: 'auth-failed', exclusive: true })).toBe(
      'Pinned Anthropic account unavailable (auth failed)',
    );
    expect(
      modelFallbackNoticeText({
        from: { entryId: 'e1', label: 'Claude' },
        to: { entryId: 'e2', label: 'GPT' },
        reason: 'persistent-outage',
        at: base.at,
      }),
    ).toBe('Switched model route: Claude → GPT (persistent outage)');
  });

  it('rejects unknown and prototype-inherited reasons', () => {
    expect(isAccountSwitchReason('rate-limit')).toBe(true);
    expect(isAccountSwitchReason('toString')).toBe(false);
    expect(isModelFallbackReason('pool-exhausted')).toBe(true);
    expect(isModelFallbackReason('rate-limit')).toBe(false);
  });
});
