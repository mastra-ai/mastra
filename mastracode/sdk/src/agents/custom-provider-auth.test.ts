/**
 * A custom OpenAI-compatible endpoint authenticates with its own key or with
 * none. It is never handed a credential saved for another provider, even when
 * its name collides with a built-in one ("OpenAI" → `openai`).
 *
 * Real pieces only: file-backed AuthStorage and settings.json in a temp app
 * data dir, real model resolution, and local HTTP servers standing in for the
 * endpoints, so the assertions are on what crossed the wire.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// AuthStorage and settings.json resolve their paths from MASTRA_APP_DATA_DIR.
// Point it at a temp dir before the modules below load, so the test never
// reads the developer's real credentials.
const { appDataDir } = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? '/tmp'}/mastracode-custom-provider-auth-${process.pid}-${Date.now()}`;
  process.env.MASTRA_APP_DATA_DIR = dir;
  return { appDataDir: dir };
});

import type { CredentialStore } from '../auth/types.js';
import { setCredentialStoreProvider } from './credential-resolver.js';
import { setCustomProvidersSource } from './custom-provider-source.js';
import { MastraCodeGateway, reloadAuthStorage } from './mastracode-gateway.js';
import type { MastraCodeCustomProvider } from './mastracode-gateway.js';
import { resolveModel } from './model.js';

mkdirSync(appDataDir, { recursive: true });

const CHAT_COMPLETION = {
  id: 'chatcmpl-test',
  object: 'chat.completion',
  created: 0,
  model: 'test',
  choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

interface Endpoint {
  /** Base URL to save on a custom provider. */
  url: string;
  /** Origin, for settings that take a host without the `/v1` path. */
  origin: string;
  /** The `Authorization` header of every request received, in order. */
  authorizations: Array<string | undefined>;
  close(): Promise<void>;
}

const endpoints: Endpoint[] = [];

async function startEndpoint(): Promise<Endpoint> {
  const authorizations: Array<string | undefined> = [];
  const server = createServer((req, res) => {
    authorizations.push(req.headers.authorization);
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(CHAT_COMPLETION));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const endpoint: Endpoint = {
    url: `${origin}/v1`,
    origin,
    authorizations,
    close: () =>
      new Promise(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
  endpoints.push(endpoint);
  return endpoint;
}

function writeAuthJson(data: Record<string, unknown>): void {
  writeFileSync(join(appDataDir, 'auth.json'), JSON.stringify(data), 'utf8');
  reloadAuthStorage();
}

function writeSettings(settings: { customProviders: MastraCodeCustomProvider[] }): void {
  writeFileSync(join(appDataDir, 'settings.json'), JSON.stringify(settings), 'utf8');
}

/** The credentials a signed-in account holds on a deployed server. */
function accountCredentials(apiKeys: Record<string, string>): CredentialStore {
  return {
    allowEnvironmentFallback: false,
    reload() {},
    get: provider => (apiKeys[provider] ? { type: 'api_key', key: apiKeys[provider] } : undefined),
    getStoredApiKey: provider => apiKeys[provider],
    getApiKey: async provider => apiKeys[provider],
  };
}

function signedInRequest(): RequestContext {
  const requestContext = new RequestContext();
  requestContext.set('user', { id: 'user-1', organizationId: 'org-1' });
  return requestContext;
}

async function sendPrompt(modelId: string, requestContext?: RequestContext): Promise<void> {
  const model = resolveModel(modelId, { requestContext });
  await model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] } as never);
}

function createGateway(customProviders: MastraCodeCustomProvider[]): MastraCodeGateway {
  return new MastraCodeGateway({
    mastraGatewayBaseUrl: 'https://gateway.example.com',
    routeThroughMastraGateway: false,
    customProviders,
  });
}

describe('custom provider credentials', () => {
  const savedEnv = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MASTRA_GATEWAY_API_KEY: process.env.MASTRA_GATEWAY_API_KEY,
    MASTRA_GATEWAY_URL: process.env.MASTRA_GATEWAY_URL,
  };

  beforeEach(() => {
    for (const name of Object.keys(savedEnv)) delete process.env[name];
    writeAuthJson({});
    writeSettings({ customProviders: [] });
  });

  afterEach(async () => {
    setCustomProvidersSource(undefined);
    setCredentialStoreProvider(undefined);
    await Promise.all(endpoints.splice(0).map(endpoint => endpoint.close()));
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  afterAll(() => {
    rmSync(appDataDir, { recursive: true, force: true });
  });

  describe('an endpoint named like a built-in provider', () => {
    it('does not receive the OpenAI key saved on this machine', async () => {
      const endpoint = await startEndpoint();
      writeAuthJson({ 'apikey:openai': { type: 'api_key', key: 'sk-saved-openai' } });
      writeSettings({ customProviders: [{ name: 'OpenAI', url: endpoint.url, models: ['gpt-test'] }] });

      await sendPrompt('openai/gpt-test');

      expect(endpoint.authorizations).toEqual([undefined]);
    });

    it('does not receive the OpenAI key saved on a signed-in account', async () => {
      const endpoint = await startEndpoint();
      setCustomProvidersSource(() => [{ name: 'OpenAI', url: endpoint.url, models: ['gpt-test'] }]);
      setCredentialStoreProvider(() => accountCredentials({ openai: 'sk-account-openai' }));

      await sendPrompt('openai/gpt-test', signedInRequest());

      expect(endpoint.authorizations).toEqual([undefined]);
    });

    // The model router asks the gateway for a key directly when `resolveAuth`
    // returns none, so that path must not hand out the saved key either.
    it('gets no key from the model router key lookup', async () => {
      writeAuthJson({ 'apikey:openai': { type: 'api_key', key: 'sk-saved-openai' } });
      const gateway = createGateway([{ name: 'OpenAI', url: 'http://127.0.0.1:9/v1', models: ['gpt-test'] }]);

      expect(await gateway.getApiKey('openai/gpt-test')).toBe('');
      expect(
        gateway.resolveAuth({
          gatewayId: 'mastracode',
          providerId: 'openai',
          modelId: 'gpt-test',
          routerId: 'mastracode/openai/gpt-test',
        })?.apiKey,
      ).toBeUndefined();
    });
  });

  describe('a model routed through the Mastra gateway', () => {
    // `mastra/acme/…` resolves to the Mastra gateway key. A custom provider
    // whose id matches the middle segment must not be sent that key.
    it('goes to the Mastra gateway, not to a custom endpoint with the same id', async () => {
      const customEndpoint = await startEndpoint();
      const mastraGateway = await startEndpoint();
      process.env.MASTRA_GATEWAY_URL = mastraGateway.origin;
      writeAuthJson({ 'apikey:mastra-gateway': { type: 'api_key', key: 'msk-test' } });
      writeSettings({ customProviders: [{ name: 'Acme', url: customEndpoint.url, models: ['model-x'] }] });

      // The stand-in gateway answers with a chat completion, which may not be
      // the shape this route expects. Only where the request went matters.
      await sendPrompt('mastra/acme/model-x').catch(() => {});

      expect(customEndpoint.authorizations).toEqual([]);
      expect(mastraGateway.authorizations.length).toBeGreaterThan(0);
    });

    // With the gateway disconnected, a model saved as `mastra/acme/…` must not
    // quietly start running on whatever custom endpoint is named Acme.
    it('never goes to a custom endpoint with the same id, even without a gateway key', async () => {
      const customEndpoint = await startEndpoint();
      writeSettings({
        customProviders: [{ name: 'Acme', url: customEndpoint.url, apiKey: 'acme-secret', models: ['model-x'] }],
      });

      await sendPrompt('mastra/acme/model-x').catch(() => {});

      expect(customEndpoint.authorizations).toEqual([]);
    });
  });

  describe('the model router key lookup', () => {
    // The router asks with its gateway-qualified id. Reading the gateway id
    // as the provider id would look up the wrong provider's key.
    it('reads the provider from a gateway-qualified model id', async () => {
      writeAuthJson({ 'apikey:openai': { type: 'api_key', key: 'sk-saved-openai' } });
      const gateway = createGateway([
        { name: 'Acme', url: 'http://127.0.0.1:9/v1', apiKey: 'acme-secret', models: ['model-x'] },
        { name: 'MastraCode', url: 'http://127.0.0.1:9/v1', apiKey: 'decoy', models: ['m'] },
      ]);

      expect(await gateway.getApiKey('mastracode/acme/model-x')).toBe('acme-secret');
      expect(await gateway.getApiKey('mastracode/openai/gpt-test')).toBe('sk-saved-openai');
    });
  });

  describe('an endpoint with its own key', () => {
    it('receives that key', async () => {
      const endpoint = await startEndpoint();
      writeAuthJson({ 'apikey:openai': { type: 'api_key', key: 'sk-saved-openai' } });
      writeSettings({
        customProviders: [{ name: 'Acme', url: endpoint.url, apiKey: 'acme-secret', models: ['model-x'] }],
      });

      await sendPrompt('acme/model-x');

      expect(endpoint.authorizations).toEqual(['Bearer acme-secret']);
    });

    it('keeps that key when its name matches a built-in provider', async () => {
      const endpoint = await startEndpoint();
      writeAuthJson({ 'apikey:openai': { type: 'api_key', key: 'sk-saved-openai' } });
      writeSettings({
        customProviders: [{ name: 'OpenAI', url: endpoint.url, apiKey: 'proxy-secret', models: ['gpt-test'] }],
      });

      await sendPrompt('openai/gpt-test');

      expect(endpoint.authorizations).toEqual(['Bearer proxy-secret']);
    });
  });

  describe('an endpoint without a key', () => {
    it('is called without credentials on this machine', async () => {
      const endpoint = await startEndpoint();
      writeSettings({ customProviders: [{ name: 'Local LLM', url: endpoint.url, models: ['llama'] }] });

      await sendPrompt('local-llm/llama');

      expect(endpoint.authorizations).toEqual([undefined]);
    });

    // A signed-in account has no environment fallback, so a missing credential
    // is normally an error. A keyless endpoint needs none.
    it('is called without credentials for a signed-in account', async () => {
      const endpoint = await startEndpoint();
      setCustomProvidersSource(() => [{ name: 'Local LLM', url: endpoint.url, models: ['llama'] }]);
      setCredentialStoreProvider(() => accountCredentials({}));

      await sendPrompt('local-llm/llama', signedInRequest());

      expect(endpoint.authorizations).toEqual([undefined]);
    });

    it('is still claimed by the gateway that defines it', () => {
      const gateway = createGateway([{ name: 'Local LLM', url: 'http://127.0.0.1:9/v1', models: ['llama'] }]);

      expect(gateway.handlesModel('local-llm/llama')).toBe(true);
    });
  });
});
