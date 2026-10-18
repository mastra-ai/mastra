import { STAGEHAND_MODEL_PROVIDERS } from '@mastra/stagehand';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../auth/storage.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../auth/storage.js')>()),
  AuthStorage: class {
    get = authMocks.get;
  },
}));

import { PROVIDER_DEFAULT_MODELS } from '../../auth/storage.js';
import {
  createBrowserFromSettings,
  resolveStagehandModel,
  STAGEHAND_PROVIDER_ENV_VARS,
  toActiveBrowserSettings,
} from '../settings.js';
import type { BrowserSettings } from '../settings.js';

const codexOAuth = { type: 'oauth', accountId: 'acct_1' };

function stagehandSettings(stagehand: Record<string, unknown>): BrowserSettings {
  return { enabled: true, provider: 'stagehand', headless: true, stagehand } as unknown as BrowserSettings;
}

function configuredModel(browser: unknown): unknown {
  return (browser as { stagehandConfig: { model?: unknown } }).stagehandConfig.model;
}

const ENV_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY'] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  authMocks.get.mockReset();
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('STAGEHAND_PROVIDER_ENV_VARS', () => {
  it('covers exactly the providers @mastra/stagehand accepts, so a Stagehand upgrade cannot desync the routing check', () => {
    // If this fails, a provider was added to or removed from STAGEHAND_MODEL_PROVIDERS;
    // update the map in settings.ts (see Stagehand's providerEnvVarMap for the env var).
    expect(Object.keys(STAGEHAND_PROVIDER_ENV_VARS).sort()).toEqual([...STAGEHAND_MODEL_PROVIDERS].sort());
  });
});

describe('createBrowserFromSettings — Stagehand model routing', () => {
  it('routes the Codex default model through Codex when nothing else is available', async () => {
    authMocks.get.mockReturnValue(codexOAuth);

    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL' }));

    expect(configuredModel(browser)).toMatchObject({
      modelName: PROVIDER_DEFAULT_MODELS['openai-codex'],
      baseURL: 'https://chatgpt.com/backend-api/codex',
      headers: { 'ChatGPT-Account-ID': 'acct_1' },
    });
  });

  it('routes a configured openai/* model through Codex when the user signed in with Codex OAuth', async () => {
    authMocks.get.mockReturnValue(codexOAuth);

    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL', model: 'openai/gpt-5.5' }));

    // A Codex-only user picking an OpenAI model must not need a separate OPENAI_API_KEY.
    expect(configuredModel(browser)).toMatchObject({
      modelName: 'openai/gpt-5.5',
      baseURL: 'https://chatgpt.com/backend-api/codex',
    });
  });

  it('applies the Codex model remap before sending an openai/* model over Codex', async () => {
    authMocks.get.mockReturnValue(codexOAuth);

    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL', model: 'openai/gpt-5.3' }));

    expect(configuredModel(browser)).toMatchObject({ modelName: 'openai/gpt-5.3-codex' });
  });

  it('passes a configured openai/* model straight to Stagehand when there is no Codex login', async () => {
    authMocks.get.mockReturnValue(undefined);

    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL', model: 'openai/gpt-5.3' }));

    expect(configuredModel(browser)).toBe('openai/gpt-5.3');
  });

  it('passes a configured non-OpenAI model straight to Stagehand even with a Codex login', async () => {
    authMocks.get.mockReturnValue(codexOAuth);

    const browser = await createBrowserFromSettings(
      stagehandSettings({ env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' }),
    );

    expect(configuredModel(browser)).toBe('anthropic/claude-sonnet-4-5');
  });

  it('reuses the launch-time chat model when no model is configured', async () => {
    authMocks.get.mockReturnValue(undefined);
    process.env.ANTHROPIC_API_KEY = 'sk-ant';

    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL' }), {
      chatModelId: 'anthropic/claude-sonnet-4-5',
    });

    expect(configuredModel(browser)).toBe('anthropic/claude-sonnet-4-5');
  });

  it('leaves the model unset when neither a Codex credential nor a configured model exists', async () => {
    authMocks.get.mockReturnValue(undefined);

    const browser = await createBrowserFromSettings(stagehandSettings({ env: 'LOCAL' }));

    expect(configuredModel(browser)).toBeUndefined();
  });
});

describe('resolveStagehandModel', () => {
  it('reports the configured model as coming from settings', () => {
    authMocks.get.mockReturnValue(codexOAuth);

    expect(
      resolveStagehandModel(stagehandSettings({ env: 'LOCAL', model: 'anthropic/claude-sonnet-4-5' }), {
        chatModelId: 'openai/gpt-5.5',
      }),
    ).toEqual({ modelName: 'anthropic/claude-sonnet-4-5', source: 'settings', viaCodexOAuth: false });
  });

  it('marks a configured openai/* model as going through Codex OAuth', () => {
    authMocks.get.mockReturnValue(codexOAuth);

    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL', model: 'openai/gpt-5.5' }))).toEqual({
      modelName: 'openai/gpt-5.5',
      source: 'settings',
      viaCodexOAuth: true,
    });
  });

  it('uses the chat model when it is an openai/* model and the user has a Codex login', () => {
    authMocks.get.mockReturnValue(codexOAuth);

    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }), { chatModelId: 'openai/gpt-5.5' })).toEqual({
      modelName: 'openai/gpt-5.5',
      source: 'chat-model',
      viaCodexOAuth: true,
    });
  });

  it('uses the chat model when its provider has an API key in the environment', () => {
    authMocks.get.mockReturnValue(undefined);
    process.env.GROQ_API_KEY = 'gsk';

    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }), { chatModelId: 'groq/llama-3.3-70b' })).toEqual({
      modelName: 'groq/llama-3.3-70b',
      source: 'chat-model',
      viaCodexOAuth: false,
    });
  });

  it('strips the mastra/ gateway prefix from the chat model before handing it to Stagehand', () => {
    authMocks.get.mockReturnValue(undefined);
    process.env.ANTHROPIC_API_KEY = 'sk-ant';

    expect(
      resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }), { chatModelId: 'mastra/anthropic/claude-sonnet-4-5' }),
    ).toMatchObject({ modelName: 'anthropic/claude-sonnet-4-5', source: 'chat-model' });
  });

  it('normalizes dotted Anthropic ids the way the chat gateway does, for chat and configured models', () => {
    authMocks.get.mockReturnValue(undefined);
    process.env.ANTHROPIC_API_KEY = 'sk-ant';

    expect(
      resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }), { chatModelId: 'anthropic/claude-opus-4.6' }),
    ).toMatchObject({ modelName: 'anthropic/claude-opus-4-6', source: 'chat-model' });
    expect(
      resolveStagehandModel(stagehandSettings({ env: 'LOCAL', model: 'anthropic/claude-opus-4.6' })),
    ).toMatchObject({ modelName: 'anthropic/claude-opus-4-6', source: 'settings' });
    // Only Anthropic ids are dashed; OpenAI ids legitimately contain dots.
    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL', model: 'openai/gpt-5.5' }))).toMatchObject({
      modelName: 'openai/gpt-5.5',
    });
  });

  it('skips a chat model Stagehand cannot route (no key, unknown provider, or not provider/model)', () => {
    authMocks.get.mockReturnValue(undefined);

    for (const chatModelId of ['anthropic/claude-sonnet-4-5', 'github-copilot/gpt-4.1', 'claude-sonnet-4-5']) {
      expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }), { chatModelId })).toEqual({
        modelName: undefined,
        source: 'stagehand-default',
        viaCodexOAuth: false,
      });
    }
  });

  it('skips an openai/* chat model without a Codex login or OPENAI_API_KEY, falling through to Codex rules', () => {
    authMocks.get.mockReturnValue(undefined);

    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }), { chatModelId: 'openai/gpt-5.5' })).toEqual({
      modelName: undefined,
      source: 'stagehand-default',
      viaCodexOAuth: false,
    });
  });

  it("falls back to the Codex login's default model when the chat model cannot be routed", () => {
    authMocks.get.mockReturnValue(codexOAuth);

    expect(
      resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }), { chatModelId: 'anthropic/claude-sonnet-4-5' }),
    ).toEqual({ modelName: PROVIDER_DEFAULT_MODELS['openai-codex'], source: 'codex-oauth', viaCodexOAuth: true });
  });

  it('reports the Stagehand default when nothing is configured', () => {
    authMocks.get.mockReturnValue(undefined);

    expect(resolveStagehandModel(stagehandSettings({ env: 'LOCAL' }))).toEqual({
      modelName: undefined,
      source: 'stagehand-default',
      viaCodexOAuth: false,
    });
  });

  it('ignores Codex for non-Stagehand providers', () => {
    authMocks.get.mockReturnValue(codexOAuth);

    expect(resolveStagehandModel({ provider: 'agent-browser' }, { chatModelId: 'openai/gpt-5.5' })).toEqual({
      modelName: undefined,
      source: 'stagehand-default',
      viaCodexOAuth: false,
    });
  });
});

describe('toActiveBrowserSettings', () => {
  it('drops the Browserbase API key but keeps everything drift detection needs', () => {
    const settings: BrowserSettings = {
      enabled: true,
      provider: 'stagehand',
      headless: true,
      profile: '/tmp/profile',
      stagehand: { env: 'BROWSERBASE', apiKey: 'bb-key', projectId: 'proj', model: 'openai/gpt-5.5' },
    };

    expect(toActiveBrowserSettings(settings)).toEqual({
      enabled: true,
      provider: 'stagehand',
      headless: true,
      profile: '/tmp/profile',
      stagehand: { env: 'BROWSERBASE', projectId: 'proj', model: 'openai/gpt-5.5' },
    });
    expect(settings.stagehand?.apiKey).toBe('bb-key');
  });
});
