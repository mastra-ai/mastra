import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../auth/storage.js', () => ({
  AuthStorage: class {
    get = authMocks.get;
  },
}));

import {
  createBrowserFromSettings,
  resolveStagehandModel,
  STAGEHAND_CODEX_FALLBACK_MODEL,
  toActiveBrowserSettings,
} from '../settings.js';
import type { BrowserSettings } from '../settings.js';

function stagehandSettings(stagehand: Record<string, unknown>): BrowserSettings {
  return { enabled: true, provider: 'stagehand', headless: true, stagehand } as unknown as BrowserSettings;
}

function configuredModel(browser: unknown): unknown {
  return (browser as { stagehandConfig: { model?: unknown } }).stagehandConfig.model;
}

describe('createBrowserFromSettings — model precedence against Codex OAuth', () => {
  beforeEach(() => {
    authMocks.get.mockReset();
  });

  it('routes Stagehand through Codex when the user has not chosen a model', async () => {
    authMocks.get.mockReturnValue({ type: 'oauth', accountId: 'acct_1' });

    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL' }));

    // Literal on purpose: guards against the constant regressing to a model Codex rejects.
    expect(configuredModel(browser)).toMatchObject({ modelName: 'openai/gpt-5.5' });
  });

  it('prefers the user-configured model over the Codex default', async () => {
    authMocks.get.mockReturnValue({ type: 'oauth', accountId: 'acct_1' });

    const browser = await createBrowserFromSettings(
      stagehandSettings({ env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' }),
    );

    expect(configuredModel(browser)).toBe('anthropic/claude-sonnet-4-5');
  });

  it('uses the configured model when there is no Codex credential at all', async () => {
    authMocks.get.mockReturnValue(undefined);

    const browser = await createBrowserFromSettings(
      stagehandSettings({ env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' }),
    );

    expect(configuredModel(browser)).toBe('anthropic/claude-sonnet-4-5');
  });

  it('leaves the model unset when neither a Codex credential nor a configured model exists', async () => {
    authMocks.get.mockReturnValue(undefined);

    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL' }));

    expect(configuredModel(browser)).toBeUndefined();
  });
});

describe('resolveStagehandModel', () => {
  beforeEach(() => {
    authMocks.get.mockReset();
  });

  it('reports the configured model as coming from settings', () => {
    authMocks.get.mockReturnValue({ type: 'oauth', accountId: 'acct_1' });

    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' }))).toEqual({
      modelName: 'anthropic/claude-sonnet-4-5',
      source: 'settings',
    });
  });

  it('reports the Codex fallback when no model is configured but a Codex login exists', () => {
    authMocks.get.mockReturnValue({ type: 'oauth', accountId: 'acct_1' });

    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }))).toEqual({
      modelName: STAGEHAND_CODEX_FALLBACK_MODEL,
      source: 'codex-oauth',
    });
  });

  it('reports the Stagehand default when nothing is configured', () => {
    authMocks.get.mockReturnValue(undefined);

    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }))).toEqual({
      modelName: undefined,
      source: 'stagehand-default',
    });
  });

  it('ignores Codex for non-Stagehand providers', () => {
    authMocks.get.mockReturnValue({ type: 'oauth', accountId: 'acct_1' });

    expect(resolveStagehandModel({ provider: 'agent-browser' })).toEqual({
      modelName: undefined,
      source: 'stagehand-default',
    });
  });
});

describe('toActiveBrowserSettings', () => {
  it('drops the Browserbase API key but keeps everything drift detection needs', () => {
    const settings: BrowserSettings = {
      enabled: true,
      provider: 'stagehand',
      profile: '/tmp/profile',
      stagehand: { env: 'BROWSERBASE', apiKey: 'bb-key', projectId: 'proj', model: 'openai/gpt-5.5' },
    };

    expect(toActiveBrowserSettings(settings)).toEqual({
      enabled: true,
      provider: 'stagehand',
      profile: '/tmp/profile',
      stagehand: { env: 'BROWSERBASE', projectId: 'proj', model: 'openai/gpt-5.5' },
    });
    expect(settings.stagehand?.apiKey).toBe('bb-key');
  });
});
