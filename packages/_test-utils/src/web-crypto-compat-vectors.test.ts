import { describe, expect, it } from 'vitest';
import { WEB_CRYPTO_COMPAT_VECTORS } from './fixtures/web-crypto-compat-vectors';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesFromBase64(value: string): Uint8Array {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), char => char.charCodeAt(0));
}

function base64FromBytes(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}

function bytesFromPem(pem: string): Uint8Array {
  return bytesFromBase64(pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, ''));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function encoded(value: string): ArrayBuffer {
  return toArrayBuffer(encoder.encode(value));
}

async function deriveHkdfKey(passphrase: string, salt: Uint8Array, info: string): Promise<CryptoKey> {
  const material = await globalThis.crypto.subtle.importKey('raw', encoded(passphrase), 'HKDF', false, ['deriveKey']);
  return globalThis.crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: toArrayBuffer(salt), info: encoded(info) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

describe('pre-migration Web Crypto compatibility vectors', () => {
  it('matches digest, HMAC, and PKCE vectors', async () => {
    const vectors = WEB_CRYPTO_COMPAT_VECTORS;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded(''));

    const hmacKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encoded(vectors.hmac.slackSigningSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign(
      'HMAC',
      hmacKey,
      encoded(`v0:${vectors.hmac.timestamp}:${vectors.hmac.body}`),
    );
    expect([...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('')).toBe(
      vectors.hmac.signature.slice(3),
    );

    const challenge = await globalThis.crypto.subtle.digest('SHA-256', encoded(vectors.pkce.verifier));
    expect(base64FromBytes(new Uint8Array(challenge)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')).toBe(
      vectors.pkce.challenge,
    );
    expect([...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')).toBe(
      vectors.digest.emptySha256,
    );

    const cookieKey = await globalThis.crypto.subtle.importKey(
      'raw',
      encoded(vectors.cookieSession.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const cookieSignature = await globalThis.crypto.subtle.sign('HMAC', cookieKey, encoded(vectors.cookieSession.json));
    expect(
      base64FromBytes(new Uint8Array(cookieSignature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    ).toBe(vectors.cookieSession.signature);
  });

  it('derives the frozen Slack key and decrypts its AES-GCM envelope', async () => {
    const vector = WEB_CRYPTO_COMPAT_VECTORS.hkdfAndAesGcm.slack;
    const salt = bytesFromBase64(vector.salt);
    const key = await deriveHkdfKey(vector.passphrase, salt, 'mastra-slack-encryption');
    const rawDerivedKey = await globalThis.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: toArrayBuffer(salt),
        info: encoded('mastra-slack-encryption'),
      },
      await globalThis.crypto.subtle.importKey('raw', encoded(vector.passphrase), 'HKDF', false, ['deriveBits']),
      256,
    );
    expect(base64FromBytes(new Uint8Array(rawDerivedKey))).toBe(vector.derivedKey);

    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(bytesFromBase64(vector.iv)) },
      key,
      toArrayBuffer(new Uint8Array([...bytesFromBase64(vector.ciphertext), ...bytesFromBase64(vector.authTag)])),
    );
    expect(decoder.decode(plaintext)).toBe(vector.plaintext);
  });

  it('decrypts the frozen Factory AES-GCM ciphertext with its separate tag', async () => {
    const vector = WEB_CRYPTO_COMPAT_VECTORS.hkdfAndAesGcm.factory;
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      toArrayBuffer(bytesFromBase64(vector.key)),
      'AES-GCM',
      false,
      ['decrypt'],
    );
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(bytesFromBase64(vector.iv)) },
      key,
      toArrayBuffer(new Uint8Array([...bytesFromBase64(vector.ciphertext), ...bytesFromBase64(vector.tag)])),
    );
    expect(decoder.decode(plaintext)).toBe(vector.plaintext);
  });

  it('verifies frozen RS256 and JOSE ES256 signatures from PEM keys', async () => {
    const { signingInput, rsa, ecdsa } = WEB_CRYPTO_COMPAT_VECTORS.asymmetric;
    const data = encoded(signingInput);
    const rsaKey = await globalThis.crypto.subtle.importKey(
      'spki',
      toArrayBuffer(bytesFromPem(rsa.publicKeySpkiPem)),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    expect(
      await globalThis.crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        rsaKey,
        toArrayBuffer(bytesFromBase64(rsa.signature)),
        data,
      ),
    ).toBe(true);

    const ecdsaKey = await globalThis.crypto.subtle.importKey(
      'spki',
      toArrayBuffer(bytesFromPem(ecdsa.publicKeySpkiPem)),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    expect(
      await globalThis.crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        ecdsaKey,
        toArrayBuffer(bytesFromBase64(ecdsa.signature)),
        data,
      ),
    ).toBe(true);
  });
});
