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

import { MastraCodeGateway, reloadAuthStorage } from './mastracode-gateway.js';

mkdirSync(appDataDir, { recursive: true });

function writeAuthJson(data: Record<string, unknown>): void {
  writeFileSync(join(appDataDir, 'auth.json'), JSON.stringify(data), 'utf8');
  reloadAuthStorage();
}

function createGateway(): MastraCodeGateway {
  return new MastraCodeGateway({
    mastraGatewayBaseUrl: 'https://gateway.example.com',
    routeThroughMastraGateway: false,
    customProviders: [],
    settingsPath: join(tmpdir(), 'nonexistent-settings.json'),
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
});
