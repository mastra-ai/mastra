import { describe, it, expect, vi, afterEach } from 'vitest';

import { encrypt, decrypt, verifySlackRequest, parseSlackFormBody } from './crypto';

describe('encrypt / decrypt', () => {
  const key = 'test-encryption-key-32-chars-ok!';

  it('round-trips plaintext', () => {
    const plaintext = 'hello world';
    const ciphertext = encrypt(plaintext, key);
    expect(decrypt(ciphertext, key)).toBe(plaintext);
  });

  it('produces algorithm-prefixed ciphertext', () => {
    const ciphertext = encrypt('test', key);
    expect(ciphertext.startsWith('aes-256-gcm-hkdf:')).toBe(true);
  });

  it('produces non-deterministic output (random salt and IV)', () => {
    const a = encrypt('same', key);
    const b = encrypt('same', key);
    expect(a).not.toBe(b);
    // Both should still decrypt to the same value
    expect(decrypt(a, key)).toBe('same');
    expect(decrypt(b, key)).toBe('same');
  });

  it('handles empty string', () => {
    const ciphertext = encrypt('', key);
    expect(decrypt(ciphertext, key)).toBe('');
  });

  it('handles unicode', () => {
    const plaintext = '日本語テスト 🎉';
    const ciphertext = encrypt(plaintext, key);
    expect(decrypt(ciphertext, key)).toBe(plaintext);
  });

  it('handles long strings', () => {
    const plaintext = 'x'.repeat(10_000);
    const ciphertext = encrypt(plaintext, key);
    expect(decrypt(ciphertext, key)).toBe(plaintext);
  });

  it('fails to decrypt with wrong key', () => {
    const ciphertext = encrypt('secret', key);
    expect(() => decrypt(ciphertext, 'wrong-key-that-is-also-long!!!')).toThrow();
  });

  it('throws on invalid ciphertext format (no colons)', () => {
    expect(() => decrypt('garbage', key)).toThrow('Invalid ciphertext format');
  });

  it('throws on unsupported algorithm prefix', () => {
    expect(() => decrypt('unknown-algo:a:b:c:d', key)).toThrow('Unsupported encryption algorithm');
  });

  it('throws on incomplete payload (missing parts)', () => {
    expect(() => decrypt('aes-256-gcm-hkdf:salt-only', key)).toThrow('Invalid ciphertext payload');
  });

  it('throws on tampered ciphertext', () => {
    const ciphertext = encrypt('secret', key);
    const parts = ciphertext.split(':');
    // Tamper with the encrypted data (last part)
    parts[4] = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(parts.join(':'), key)).toThrow();
  });

  it('throws on tampered auth tag', () => {
    const ciphertext = encrypt('secret', key);
    const parts = ciphertext.split(':');
    // Tamper with the auth tag (4th part)
    parts[3] = Buffer.from('0000000000000000').toString('base64');
    expect(() => decrypt(parts.join(':'), key)).toThrow();
  });
});

describe('verifySlackRequest', () => {
  const signingSecret = 'test-signing-secret';
  const body = 'token=abc&team_id=T123';

  function makeSignature(secret: string, ts: string, b: string): string {
    const { createHmac } = require('crypto');
    const sig = createHmac('sha256', secret).update(`v0:${ts}:${b}`).digest('hex');
    return `v0=${sig}`;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid signature within the time window', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = makeSignature(signingSecret, timestamp, body);

    expect(verifySlackRequest({ signingSecret, timestamp, body, signature })).toBe(true);
  });

  it('rejects an invalid signature', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifySlackRequest({
        signingSecret,
        timestamp,
        body,
        signature: 'v0=0000000000000000000000000000000000000000000000000000000000000000',
      }),
    ).toBe(false);
  });

  it('rejects a timestamp older than 5 minutes', () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 301);
    const signature = makeSignature(signingSecret, oldTimestamp, body);

    expect(verifySlackRequest({ signingSecret, timestamp: oldTimestamp, body, signature })).toBe(false);
  });

  it('accepts a timestamp at exactly 5 minutes (boundary)', () => {
    const ts = String(Math.floor(Date.now() / 1000) - 300);
    const signature = makeSignature(signingSecret, ts, body);

    expect(verifySlackRequest({ signingSecret, timestamp: ts, body, signature })).toBe(true);
  });

  it('rejects a future timestamp beyond 5 minutes', () => {
    const futureTs = String(Math.floor(Date.now() / 1000) + 301);
    const signature = makeSignature(signingSecret, futureTs, body);

    expect(verifySlackRequest({ signingSecret, timestamp: futureTs, body, signature })).toBe(false);
  });

  it('rejects a signature with wrong length', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifySlackRequest({
        signingSecret,
        timestamp,
        body,
        signature: 'v0=short',
      }),
    ).toBe(false);
  });
});

describe('parseSlackFormBody', () => {
  it('parses a basic form body', () => {
    const result = parseSlackFormBody('token=abc&team_id=T123&command=%2Fask');
    expect(result).toEqual({
      token: 'abc',
      team_id: 'T123',
      command: '/ask',
    });
  });

  it('handles + as space', () => {
    const result = parseSlackFormBody('text=hello+world');
    expect(result.text).toBe('hello world');
  });

  it('handles values containing equals signs', () => {
    const result = parseSlackFormBody('text=a%3Db%3Dc');
    expect(result.text).toBe('a=b=c');
  });

  it('handles empty body', () => {
    expect(parseSlackFormBody('')).toEqual({});
  });

  it('handles percent-encoded special characters', () => {
    const result = parseSlackFormBody('text=%E4%B8%96%E7%95%8C');
    expect(result.text).toBe('世界');
  });

  it('preserves last value for duplicate keys', () => {
    const result = parseSlackFormBody('key=first&key=second');
    expect(result.key).toBe('second');
  });
});
