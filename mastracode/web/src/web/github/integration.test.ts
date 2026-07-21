import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createStateSigner } from '../state-signing.js';
import { GithubIntegration, normalizePrivateKey } from './integration.js';

// Real RSA key so we can prove Node's PEM decoder accepts the normalized
// output (the failure mode is `error:1E08010C:DECODER routines::unsupported`).
const { privateKey: pem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function validConfig() {
  return {
    appId: '12345',
    privateKey: pem,
    clientId: 'Iv1.client',
    clientSecret: 'shhh',
    slug: 'test-app',
    webhookSecret: 'hook-secret',
  };
}

describe('normalizePrivateKey', () => {
  it('passes a proper multi-line PEM through unchanged', () => {
    expect(normalizePrivateKey(pem)).toBe(pem);
    expect(() => createPrivateKey(normalizePrivateKey(pem))).not.toThrow();
  });

  it('converts \\n-escaped single-line PEMs', () => {
    const escaped = pem.replace(/\n/g, '\\n');
    expect(() => createPrivateKey(normalizePrivateKey(escaped))).not.toThrow();
  });

  it('rebuilds fully flattened PEMs (newlines stripped by env tooling)', () => {
    const flattened = pem.replace(/\n/g, '');
    expect(flattened).not.toContain('\n');
    const normalized = normalizePrivateKey(flattened);
    expect(() => createPrivateKey(normalized)).not.toThrow();
  });

  it('leaves non-PEM values untouched', () => {
    expect(normalizePrivateKey('not-a-key')).toBe('not-a-key');
  });
});

describe('GithubIntegration constructor', () => {
  it('constructs from a full config', () => {
    const github = new GithubIntegration(validConfig());
    expect(github.id).toBe('github');
    expect(github.requiresStableStateSigner).toBe(true);
    expect(github.slug).toBe('test-app');
    expect(github.webhookSecret).toBe('hook-secret');
  });

  it('throws listing every missing required field', () => {
    expect(() => new GithubIntegration({ ...validConfig(), appId: '', slug: '' })).toThrow(/appId, slug/);
  });

  it('treats an empty webhook secret as unconfigured', () => {
    const github = new GithubIntegration({ ...validConfig(), webhookSecret: '' });
    expect(github.webhookSecret).toBeUndefined();
  });

  it('normalizes an \\n-escaped private key at construction', () => {
    const escaped = pem.replace(/\n/g, '\\n');
    expect(() => new GithubIntegration({ ...validConfig(), privateKey: escaped })).not.toThrow();
  });
});

describe('GithubIntegration FactoryIntegration surface', () => {
  it('routes() returns the GitHub HTTP surface as ApiRoute[]', () => {
    const github = new GithubIntegration(validConfig());
    const routes = github.routes({ stateSigner: createStateSigner('secret') });
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.path).toMatch(/^\/(web|auth)\/github\//);
    }
  });

  it('diagnostics() exposes only non-secret config', () => {
    const github = new GithubIntegration(validConfig());
    expect(github.diagnostics()).toEqual({ slug: 'test-app', webhookSecretConfigured: true });
  });
});
