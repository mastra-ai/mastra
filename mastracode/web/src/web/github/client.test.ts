import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { normalizePrivateKey } from './client.js';

// Real RSA key so we can prove Node's PEM decoder accepts the normalized
// output (the failure mode is `error:1E08010C:DECODER routines::unsupported`).
const { privateKey: pem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

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
