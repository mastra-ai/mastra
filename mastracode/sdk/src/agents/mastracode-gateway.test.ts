/**
 * Scenario tests for MastraCodeGateway auth resolution and model claiming.
 *
 * The gateway uses a module-level AuthStorage that reads auth.json from the app
 * data dir. We point MASTRA_APP_DATA_DIR at a temp dir, write credentials, and
 * call reloadAuthStorage() so the module instance picks them up.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The gateway constructs a module-level AuthStorage at import time, binding its
// auth.json path from MASTRA_APP_DATA_DIR. Set the env var (in a hoisted block
// that runs before the import below) so that instance reads from a temp dir we
// control, isolating the test from the developer's real credentials.
const { appDataDir } = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? '/tmp'}/mastracode-gateway-appdata-${process.pid}-${Date.now()}`;
  process.env.MASTRA_APP_DATA_DIR = dir;
  return { appDataDir: dir };
});

// Spy on the AI SDK factories so custom-provider routing (chat vs responses,
// bearer vs SigV4) is observable without live network calls. Each returns a
// tagged object identifying which factory/method produced the model.
const { createOpenAIMock, createOpenAICompatibleMock } = vi.hoisted(() => {
  const createOpenAIMock = vi.fn((opts: Record<string, unknown>) => ({
    responses: (modelId: string) => ({ __kind: 'openai.responses', modelId, opts }),
    chat: (modelId: string) => ({ __kind: 'openai.chat', modelId, opts }),
  }));
  const createOpenAICompatibleMock = vi.fn((opts: Record<string, unknown>) => ({
    chatModel: (modelId: string) => ({ __kind: 'compatible.chatModel', modelId, opts }),
  }));
  return { createOpenAIMock, createOpenAICompatibleMock };
});

vi.mock('@ai-sdk/openai', () => ({ createOpenAI: createOpenAIMock }));
vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: createOpenAICompatibleMock }));
vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: () => async () => ({ accessKeyId: 'AKIA', secretAccessKey: 'secret', sessionToken: 'token' }),
}));

import type { MastraCodeCustomProvider } from './mastracode-gateway.js';
import { MastraCodeGateway, reloadAuthStorage } from './mastracode-gateway.js';

mkdirSync(appDataDir, { recursive: true });

function writeAuthJson(data: Record<string, unknown>): void {
  writeFileSync(join(appDataDir, 'auth.json'), JSON.stringify(data), 'utf8');
  reloadAuthStorage();
}

function createGateway(customProviders: MastraCodeCustomProvider[] = []): MastraCodeGateway {
  return new MastraCodeGateway({
    mastraGatewayBaseUrl: 'https://gateway.example.com',
    routeThroughMastraGateway: false,
    customProviders,
    settingsPath: join(tmpdir(), 'nonexistent-settings.json'),
  });
}

const BEDROCK_URL = 'https://bedrock-mantle.us-east-1.api.aws/openai/v1';

function resolveCustomModel(provider: MastraCodeCustomProvider, modelId: string, apiKey = ''): any {
  return createGateway([provider]).resolveLanguageModel({
    providerId: 'bedrock-mantle',
    modelId,
    apiKey,
  });
}

describe('MastraCodeGateway', () => {
  const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const prevOpenAIKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    writeAuthJson({});
  });

  afterEach(() => {
    if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
    if (prevOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevOpenAIKey;
  });

  afterAll(() => {
    rmSync(appDataDir, { recursive: true, force: true });
  });

  describe('handlesModel', () => {
    it('claims a bare anthropic model id when logged in via OAuth', () => {
      writeAuthJson({
        anthropic: { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 1_000_000 },
      });

      expect(createGateway().handlesModel('anthropic/claude-opus-4-8')).toBe(true);
    });

    it('claims a prefixed mastracode/anthropic id via OAuth', () => {
      writeAuthJson({
        anthropic: { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 1_000_000 },
      });

      expect(createGateway().handlesModel('mastracode/anthropic/claude-opus-4-8')).toBe(true);
    });

    it('claims a bare openai model id when the openai-codex OAuth slot is set', () => {
      writeAuthJson({
        'openai-codex': { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 1_000_000 },
      });

      expect(createGateway().handlesModel('openai/gpt-5.5')).toBe(true);
    });

    it('claims a model when a stored api key exists', () => {
      writeAuthJson({
        'apikey:anthropic': { type: 'api_key', key: 'sk-test' },
      });

      expect(createGateway().handlesModel('anthropic/claude-opus-4-8')).toBe(true);
    });

    it('does not claim a model with no credentials', () => {
      writeAuthJson({});

      expect(createGateway().handlesModel('anthropic/claude-opus-4-8')).toBe(false);
    });

    it('does not claim an id without a provider and model', () => {
      writeAuthJson({
        anthropic: { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 1_000_000 },
      });

      expect(createGateway().handlesModel('anthropic')).toBe(false);
    });
  });

  describe('resolveProviderAuth', () => {
    it('returns an oauth bearer token for an OAuth-logged-in provider', () => {
      writeAuthJson({
        anthropic: { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 1_000_000 },
      });

      const auth = MastraCodeGateway.resolveProviderAuth({
        gatewayId: 'mastracode',
        providerId: 'anthropic',
        modelId: 'claude-opus-4-8',
        routerId: 'anthropic/claude-opus-4-8',
      });
      expect(auth?.bearerToken).toBe('oauth');
    });

    it('returns undefined when the provider has no credentials', () => {
      writeAuthJson({});

      const auth = MastraCodeGateway.resolveProviderAuth({
        gatewayId: 'mastracode',
        providerId: 'anthropic',
        modelId: 'claude-opus-4-8',
        routerId: 'anthropic/claude-opus-4-8',
      });
      expect(auth).toBeUndefined();
    });
  });

  describe('gateway API key accessors', () => {
    it('keeps the previous accessor as a compatibility alias', () => {
      writeAuthJson({
        'apikey:mastra-gateway': { type: 'api_key', key: 'msk-test' },
      });

      expect(MastraCodeGateway.getMastraGatewayApiKey()).toBe('msk-test');
      expect(MastraCodeGateway.getMemoryGatewayApiKey()).toBe('msk-test');

      const getMemoryGatewayApiKey = MastraCodeGateway.getMemoryGatewayApiKey;
      expect(getMemoryGatewayApiKey()).toBe('msk-test');
    });
  });

  describe('custom provider resolveAuth', () => {
    it('reports a synthetic AWS credential for a SigV4 provider (so the catalog marks it usable)', () => {
      const auth = createGateway([{ name: 'bedrock-mantle', url: BEDROCK_URL, auth: 'aws-sigv4' }]).resolveAuth({
        gatewayId: 'mastracode',
        providerId: 'bedrock-mantle',
        modelId: 'openai.gpt-5.6-terra',
        routerId: 'mastracode/bedrock-mantle/openai.gpt-5.6-terra',
      });
      expect(auth).toEqual({ apiKey: 'aws-credential-chain', source: 'gateway' });
    });

    it('returns the configured bearer key for a non-SigV4 provider', () => {
      const auth = createGateway([{ name: 'my-llm', url: 'https://api.example.com/v1', apiKey: 'sk-abc' }]).resolveAuth(
        {
          gatewayId: 'mastracode',
          providerId: 'my-llm',
          modelId: 'some-model',
          routerId: 'mastracode/my-llm/some-model',
        },
      );
      expect(auth).toEqual({ apiKey: 'sk-abc', source: 'gateway' });
    });
  });

  describe('custom provider resolveLanguageModel', () => {
    beforeEach(() => {
      createOpenAIMock.mockClear();
      createOpenAICompatibleMock.mockClear();
    });

    it('uses createOpenAICompatible().chatModel for a default (bearer + chat) provider', () => {
      const model = resolveCustomModel(
        { name: 'bedrock-mantle', url: 'https://api.example.com/v1' },
        'some-model',
        'sk',
      );
      expect(model.__kind).toBe('compatible.chatModel');
      expect(createOpenAICompatibleMock).toHaveBeenCalledTimes(1);
      expect(createOpenAIMock).not.toHaveBeenCalled();
    });

    it('uses openai.responses with a SigV4 fetch for auth:aws-sigv4 + api:responses', () => {
      const model = resolveCustomModel(
        { name: 'bedrock-mantle', url: BEDROCK_URL, auth: 'aws-sigv4', api: 'responses' },
        'openai.gpt-5.6-terra',
      );
      // wrapped by store:false middleware, so unwrap to find the tagged model.
      expect(createOpenAIMock).toHaveBeenCalledTimes(1);
      const opts = createOpenAIMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(opts.baseURL).toBe(BEDROCK_URL);
      expect(typeof opts.fetch).toBe('function');
      expect(createOpenAICompatibleMock).not.toHaveBeenCalled();
      expect(model).toBeDefined();
    });

    it('does not pass a fetch for a bearer + responses provider', () => {
      resolveCustomModel(
        { name: 'bedrock-mantle', url: 'https://api.example.com/v1', api: 'responses', store: false },
        'some-model',
        'sk',
      );
      const opts = createOpenAIMock.mock.calls[0]![0] as Record<string, unknown>;
      expect(opts.fetch).toBeUndefined();
    });
  });
});
