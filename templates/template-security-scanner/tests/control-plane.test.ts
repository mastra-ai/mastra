import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { profileSchema, targetSchema, urlSchema } from '../src/core/contracts.js';
import { loadSettings } from '../src/config/settings.js';
import { CredentialVault } from '../src/core/credentials.js';

const limits = { maxRequests: 100, maxDurationSeconds: 60, maxResponseBytes: 8192, maxConcurrency: 2 };
const target = {
  name: 'Account portal',
  entryUrl: 'https://portal.example/app',
  approvedOrigins: ['https://portal.example'],
  allowedPaths: ['/app'],
  excludedPaths: ['/app/admin'],
  permittedMethods: ['GET'],
  environment: 'staging',
  authorizationEvidenceRef: 'approval:portal-2026',
  authorizationConfirmed: true,
  policyId: randomUUID(),
  policyRevision: 1,
  schedule: { enabled: false, timezone: 'America/Sao_Paulo' },
  scanLimits: limits,
};
describe('scope and identity contracts', () => {
  it.each(['0', '3601', 'Infinity'])('rejects nonfinite or unsupported local session lifetime %s', value => {
    expect(() => loadSettings({ CONTROL_SESSION_TTL_SECONDS: value })).toThrow('Check supported values');
  });
  it.each([
    'javascript:alert(1)',
    'ftp://portal.example/app',
    'https://operator:private@portal.example/app',
    'https://portal.example/app%2fadmin',
    'https://portal.example/app/../admin',
    'https://portal.example/app/./child',
    'https://portal.example/app?token=private',
    'https://portal.example/app#fragment',
    'https://portal.example\\@elsewhere.example/app',
    'https://PORTAL.example/app',
    'https://portal.example:443/app',
    ' https://portal.example/app',
  ])('rejects ambiguous or secret-bearing URL %s', entryUrl => {
    expect(urlSchema.safeParse(entryUrl).success).toBe(false);
    expect(targetSchema.safeParse({ ...target, entryUrl }).success).toBe(false);
  });
  it.each([
    { entryUrl: 'https://elsewhere.example/app' },
    { entryUrl: 'https://portal.example/app/admin' },
    { entryUrl: 'https://portal.example/application' },
    { scanLimits: { ...limits, maxRequests: 0 } },
    { scanLimits: { ...limits, maxConcurrency: 9 } },
    { approvedOrigins: ['https://portal.example/path'] },
    { schedule: { enabled: true, timezone: 'UTC' } },
    { schedule: { enabled: false, timezone: 'unknown/timezone' } },
    { authorizationConfirmed: false },
    { owner: 'client-chosen-owner' },
    { environment: 'development' },
  ])('rejects scope, authorization and finite-budget violations %j', change => {
    expect(targetSchema.safeParse({ ...target, ...change }).success).toBe(false);
  });
  it('accepts a scoped target and prevents credentials from being attached to public identities', () => {
    expect(targetSchema.parse(target).entryUrl).toBe(target.entryUrl);
    expect(
      profileSchema.safeParse({ kind: 'public', name: 'Visitor', role: 'visitor', credential: { value: 'secret' } })
        .success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        kind: 'header',
        name: 'Reader',
        role: 'reader',
        identityEndpoint: 'https://portal.example/app/identity',
        expectedIdentity: 'reader',
        credential: { name: 'host', value: 'elsewhere.example' },
      }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        kind: 'bearer',
        name: 'Reader',
        role: 'reader',
        identityEndpoint: 'https://portal.example/app/identity',
        expectedIdentity: 'reader',
        credential: { value: 'token\r\ninjected: true' },
      }).success,
    ).toBe(false);
  });
});
describe('authenticated credential envelope', () => {
  const binding = { targetId: randomUUID(), profileId: randomUUID(), role: 'reader', credentialRevision: 1 };
  const vault = new CredentialVault('ab'.repeat(32));
  const credential = { value: 'private-envelope-marker' };
  it('uses random authenticated envelopes, preserving only authorized binding', () => {
    const first = vault.seal(credential, binding);
    expect(first).not.toContain(credential.value);
    expect(vault.seal(credential, binding)).not.toBe(first);
    expect(vault.open(first, binding)).toEqual(credential);
    for (const change of [
      { targetId: randomUUID() },
      { profileId: randomUUID() },
      { role: 'admin' },
      { credentialRevision: 2 },
    ]) {
      expect(() => vault.open(first, { ...binding, ...change })).toThrow('CREDENTIAL_UNAVAILABLE');
    }
    const envelope = JSON.parse(first);
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}${envelope.ciphertext.endsWith('00') ? 'ff' : '00'}`;
    expect(() => vault.open(JSON.stringify(envelope), binding)).toThrow('CREDENTIAL_UNAVAILABLE');
  });
  it('requires re-registration after key loss or replacement and never returns plaintext fallback', () => {
    const envelope = vault.seal(credential, binding);
    expect(() => new CredentialVault().seal(credential, binding)).toThrow('CREDENTIAL_KEY_REQUIRED');
    for (const unavailable of [new CredentialVault(), new CredentialVault('cd'.repeat(32))]) {
      expect(() => unavailable.open(envelope, binding)).toThrow('CREDENTIAL_UNAVAILABLE');
    }
    expect(() => vault.open(JSON.stringify(credential), binding)).toThrow('CREDENTIAL_UNAVAILABLE');
  });
});
