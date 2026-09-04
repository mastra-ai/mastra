import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../auth/storage.js', () => ({
  AuthStorage: class {
    get = authMocks.get;
  },
}));

import { createBrowserFromSettings } from '../settings.js';
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

    expect(configuredModel(browser)).toMatchObject({ modelName: 'openai/gpt-5.4-mini' });
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
