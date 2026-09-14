import * as crypto from 'node:crypto';
import { webcrypto } from 'node:crypto';
import {
  canonicalizeV1AgentCard,
  generateV1AgentCardSignature,
  verifyV1AgentCardSignature,
  type AgentCard as V1AgentCard,
} from '@mastra/core/a2a';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderAgentCard } from './agent-card';
import { canonicalizeAgentCardForSigning, signAgentCard } from './agent-card-signing';

/**
 * B3 regression coverage: Mastra-signed v1 Agent Cards must verify under the real
 * `@a2a-js/sdk` v1 verifier, and vice versa. The pre-fix signer used plain JCS, which
 * left `securitySchemes: {}` / `securityRequirements: []` / `capabilities.extensions: []`
 * in the payload — bytes the SDK's `canonicalizeAgentCard` strips via `cleanEmpty`.
 * A Mastra-only sign→verify test can never catch this because both sides shared the same
 * wrong canonicalization; only a cross-SDK round-trip does.
 */

function renderV1Card() {
  return renderAgentCard({
    input: {
      name: 'weather-agent',
      description: 'Weather agent',
      executionUrl: '/a2a/weather-agent',
      provider: { organization: 'Mastra', url: 'https://mastra.ai' },
      version: '1.0.0',
      pushNotifications: true,
      skills: [{ id: 'lookup', name: 'lookup', description: 'Tool: lookup', tags: ['tool'] }],
    },
    requestedVersion: '1.0',
    protocolVersions: ['1.0', '0.3'],
  }) as Record<string, unknown>;
}

function renderV03Card() {
  return renderAgentCard({
    input: {
      name: 'weather-agent',
      description: 'Weather agent',
      executionUrl: '/a2a/weather-agent',
      provider: { organization: 'Mastra', url: 'https://mastra.ai' },
      version: '1.0.0',
      pushNotifications: true,
      skills: [{ id: 'lookup', name: 'lookup', description: 'Tool: lookup', tags: ['tool'] }],
    },
    requestedVersion: '0.3',
    protocolVersions: ['1.0', '0.3'],
  }) as Record<string, unknown>;
}

describe('agent-card signing canonicalization (B3)', () => {
  // The SDK signer/verifier use jose's WebCrypto path (`crypto.subtle`). The shared
  // test-utils setup stubs global `crypto` with a Proxy that unbinds `subtle`'s
  // receiver ("Value of 'this' must be of type Crypto"), so restore the real
  // WebCrypto for this suite only.
  const stubbedCrypto = globalThis.crypto;
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(globalThis, 'crypto', { value: stubbedCrypto, configurable: true });
  });

  it('v1 canonicalization strips SDK-cleaned empties (matches @a2a-js/sdk)', () => {
    const card = renderV1Card();
    const mastraCanon = canonicalizeAgentCardForSigning(card, '1.0');
    const sdkCanon = canonicalizeV1AgentCard(card as unknown as V1AgentCard);

    // The v1 render deliberately emits empties that the SDK removes before hashing.
    expect(card).toMatchObject({ securitySchemes: {}, securityRequirements: [] });
    expect(mastraCanon).toBe(sdkCanon);
    expect(mastraCanon).not.toContain('securitySchemes');
    expect(mastraCanon).not.toContain('securityRequirements');
  });

  it('0.3 canonicalization preserves top-level url/protocolVersion (v1 canon is lossy there)', () => {
    const card = renderV03Card();
    const canon = canonicalizeAgentCardForSigning(card, '0.3')!;
    const parsed = JSON.parse(canon);
    expect(parsed.protocolVersion).toBe('0.3.0'); // top-level version survives
    expect(parsed.url).toBe('/a2a/weather-agent'); // top-level url survives
    // Guard the reason we do NOT route 0.3 through the v1 canonicalizer: the v1
    // canonicalizer drops the top-level 0.3-only fields (url/protocolVersion/
    // preferredTransport). (Nested supportedInterfaces[].protocolVersion still exists,
    // so assert on the parsed top-level keys, not a substring.)
    const lossy = JSON.parse(canonicalizeV1AgentCard(card as unknown as V1AgentCard));
    expect(lossy.protocolVersion).toBeUndefined();
    expect(lossy.url).toBeUndefined();
  });

  it('Mastra-signed v1 card verifies under the @a2a-js/sdk v1 verifier', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateJwk = privateKey.export({ format: 'jwk' });

    const signed = await signAgentCard({
      agentCard: renderV1Card(),
      signing: {
        privateKey: privateJwk,
        // SDK verifier requires kid + typ + alg in the protected header.
        protectedHeader: { alg: 'ES256', kid: 'test-key', typ: 'JWT' },
      },
      protocolVersion: '1.0',
    });

    const publicCryptoKey = publicKey.toCryptoKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    // jose (used inside the SDK verifier) accepts a WebCrypto CryptoKey.
    // Throws if verification fails; resolves (void) on success.
    await expect(
      verifyV1AgentCardSignature(async () => publicCryptoKey as any)(signed as unknown as V1AgentCard),
    ).resolves.toBeUndefined();
  });

  it('SDK-signed v1 card verifies under Mastra canonicalization + crypto', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });

    const card = renderV1Card();
    const privateCryptoKey = privateKey.toCryptoKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    // jose (used inside the SDK signer) accepts a WebCrypto CryptoKey.
    const signed = await generateV1AgentCardSignature(privateCryptoKey as any, {
      alg: 'ES256',
      kid: 'test-key',
      typ: 'JWT',
    })(card as unknown as V1AgentCard);
    const [signature] = signed.signatures!;

    // Reproduce Mastra's verification path: v1 canonicalization + JWS compact input.
    const canonicalPayload = canonicalizeAgentCardForSigning(signed as unknown as Record<string, unknown>, '1.0')!;
    const signingInput = `${signature.protected}.${Buffer.from(canonicalPayload, 'utf8').toString('base64url')}`;
    const verified = crypto.verify(
      'sha256',
      Buffer.from(signingInput, 'utf8'),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature.signature, 'base64url'),
    );
    expect(verified).toBe(true);
  });
});
