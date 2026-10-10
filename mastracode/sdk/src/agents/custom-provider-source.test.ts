import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasCustomProvidersSource,
  resolveCustomProviders,
  setCustomProvidersSource,
} from './custom-provider-source.js';
import { MastraCodeGateway } from './mastracode-gateway.js';

afterEach(() => {
  setCustomProvidersSource(undefined);
});

describe('custom provider source', () => {
  it('resolves to undefined when no source is registered (settings fallback)', () => {
    expect(hasCustomProvidersSource()).toBe(false);
    expect(resolveCustomProviders()).toBeUndefined();
  });

  it('is authoritative once registered: returns the source result, tenant-scoped', () => {
    const source = vi.fn().mockReturnValue([{ name: 'Acme', url: 'https://llm.acme.dev/v1', models: ['fast-1'] }]);
    setCustomProvidersSource(source);

    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });

    expect(hasCustomProvidersSource()).toBe(true);
    expect(resolveCustomProviders(requestContext)).toEqual([
      { name: 'Acme', url: 'https://llm.acme.dev/v1', models: ['fast-1'] },
    ]);
    expect(source).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
  });

  it('passes an undefined tenant for calls without an authenticated request', () => {
    const source = vi.fn().mockReturnValue([]);
    setCustomProvidersSource(source);

    expect(resolveCustomProviders()).toEqual([]);
    expect(source).toHaveBeenCalledWith(undefined);
  });

  it('clears back to settings fallback when unregistered', () => {
    setCustomProvidersSource(() => []);
    setCustomProvidersSource(undefined);
    expect(resolveCustomProviders()).toBeUndefined();
  });
});

describe('gateway consumption', () => {
  it('fetchProviders serves source providers when no explicit constructor list is given', async () => {
    setCustomProvidersSource(() => [
      { name: 'Acme LLM', url: 'https://llm.acme.dev/v1', apiKey: 'sk-acme', models: ['fast-1', 'smart-1'] },
    ]);
    const gateway = new MastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway.example.com',
      routeThroughMastraGateway: false,
      settingsPath: '/nonexistent/settings.json',
    });

    const providers = await gateway.fetchProviders();
    const custom = Object.entries(providers).find(([, config]) => config.name === 'Acme LLM');
    expect(custom).toBeDefined();
    expect(custom![1].models).toEqual(['fast-1', 'smart-1']);
  });

  it('an explicit constructor list wins over the registered source', async () => {
    setCustomProvidersSource(() => [{ name: 'FromSource', url: 'https://source.dev/v1', models: ['m'] }]);
    const gateway = new MastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway.example.com',
      routeThroughMastraGateway: false,
      customProviders: [],
      settingsPath: '/nonexistent/settings.json',
    });

    const providers = await gateway.fetchProviders();
    expect(Object.values(providers).some(config => config.name === 'FromSource')).toBe(false);
  });
});
