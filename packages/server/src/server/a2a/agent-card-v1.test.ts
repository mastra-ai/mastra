import { constants, generateKeyPairSync, sign as nodeSign, verify } from 'node:crypto';
import type { AgentCard } from '@mastra/core/a2a';
import { AgentCard as AgentCardCodec } from '@mastra/core/a2a/v1';
import canonicalize from 'canonicalize';
import { describe, expect, it } from 'vitest';
import { agentCardResponseSchema } from '../schemas/a2a';
import { signAgentCard } from './agent-card-signing';
import { createV1AgentCard } from './agent-card-v1';

const legacyCard: AgentCard = {
  name: 'test-agent',
  description: 'An agent for testing discovery',
  url: 'https://example.com/custom/a2a/test-agent',
  protocolVersion: '0.3.0',
  version: '2.0.0',
  provider: { organization: 'Mastra', url: 'https://mastra.ai' },
  additionalInterfaces: [],
  security: [],
  securitySchemes: {},
  supportsAuthenticatedExtendedCard: false,
  capabilities: {
    streaming: true,
    pushNotifications: true,
    stateTransitionHistory: false,
    extensions: [],
  },
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [{ id: 'weather', name: 'weather', description: 'Get weather', tags: ['tool'] }],
};

describe('createV1AgentCard', () => {
  it('advertises both supported interfaces', () => {
    const card = createV1AgentCard(legacyCard);
    expect(card.supportedInterfaces).toEqual(
      ['0.3', '1.0'].map(protocolVersion => ({
        url: legacyCard.url,
        protocolBinding: 'JSONRPC',
        protocolVersion,
      })),
    );
    expect(card).toMatchObject({
      name: legacyCard.name,
      description: legacyCard.description,
      version: '2.0.0',
      provider: legacyCard.provider,
      skills: legacyCard.skills,
      capabilities: { streaming: true, pushNotifications: true, extendedAgentCard: false },
    });
    expect(card).not.toHaveProperty('url');
    expect(card).not.toHaveProperty('protocolVersion');
    expect(card).not.toHaveProperty('additionalInterfaces');
    expect(card).not.toHaveProperty('security');
    expect(card).not.toHaveProperty('supportsAuthenticatedExtendedCard');
    expect(card.capabilities).not.toHaveProperty('stateTransitionHistory');
    expect(AgentCardCodec.toJSON(AgentCardCodec.fromJSON(card))).toEqual(card);
    expect(agentCardResponseSchema.parse(card)).toEqual(card);
  });

  it('handles empty instructions and tools without reintroducing protobuf defaults', () => {
    const card = createV1AgentCard({ ...legacyCard, description: '', skills: [] });
    expect(card).not.toHaveProperty('description');
    expect(card).not.toHaveProperty('skills');
    expect(AgentCardCodec.toJSON(AgentCardCodec.fromJSON(card))).toEqual(card);
  });

  it('does not reuse a signature of the legacy payload', () => {
    const card = createV1AgentCard({
      ...legacyCard,
      signatures: [{ protected: 'header', signature: 'old-signature' }],
    });
    expect(card).not.toHaveProperty('signatures');
  });

  it('keeps legacy response validation unchanged', () => {
    expect(agentCardResponseSchema.parse(legacyCard)).toEqual(legacyCard);
  });

  it.each(['legacy', 'v1'] as const)('signs the final %s wire representation', async version => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const card = version === 'v1' ? createV1AgentCard(legacyCard) : legacyCard;
    const signed = await signAgentCard({
      agentCard: card,
      signing: {
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        protectedHeader: { alg: 'ES256', kid: 'test-key' },
      },
    });
    const wireCard = agentCardResponseSchema.parse(JSON.parse(JSON.stringify(signed)));
    const { signatures, ...payload } = wireCard;
    const signature = signatures![0]!;
    const encodedPayload = Buffer.from(canonicalize(payload)!, 'utf8').toString('base64url');
    expect(
      verify(
        'sha256',
        Buffer.from(`${signature.protected}.${encodedPayload}`),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature.signature, 'base64url'),
      ),
    ).toBe(true);
    if (version === 'v1') {
      expect(AgentCardCodec.toJSON(AgentCardCodec.fromJSON(wireCard))).toEqual(wireCard);
    }
    expect(card).not.toHaveProperty('signatures');
  });

  it.each([
    { algorithm: 'ES256', keyType: 'sec1' },
    { algorithm: 'RS256', keyType: 'pkcs1' },
  ] as const)('continues to accept $keyType PEM for $algorithm', async ({ algorithm, keyType }) => {
    const { privateKey, publicKey } =
      keyType === 'sec1'
        ? generateKeyPairSync('ec', { namedCurve: 'P-256' })
        : generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signed = await signAgentCard({
      agentCard: legacyCard,
      signing: {
        privateKey: privateKey.export({ type: keyType, format: 'pem' }).toString(),
        protectedHeader: { alg: algorithm },
      },
    });
    const { signatures, ...payload } = signed;
    const signature = signatures[0]!;
    const input = Buffer.from(`${signature.protected}.${Buffer.from(canonicalize(payload)!).toString('base64url')}`);
    expect(
      verify(
        'sha256',
        input,
        keyType === 'sec1' ? { key: publicKey, dsaEncoding: 'ieee-p1363' } : publicKey,
        Buffer.from(signature.signature, 'base64url'),
      ),
    ).toBe(true);
  });

  it.each(['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512'])(
    'signs %s with PKCS#8 PEM and JWK keys in the same JWS format',
    async algorithm => {
      const hash = `sha${algorithm.slice(2)}`;
      const { privateKey, publicKey } = algorithm.startsWith('ES')
        ? generateKeyPairSync('ec', { namedCurve: algorithm === 'ES512' ? 'P-521' : `P-${algorithm.slice(2)}` })
        : generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const jwk = privateKey.export({ format: 'jwk' }) as JsonWebKey;

      for (const key of [pem, jwk]) {
        const signed = await signAgentCard({
          agentCard: legacyCard,
          signing: { privateKey: key, protectedHeader: { alg: algorithm } },
        });
        const { signatures, ...payload } = signed;
        const signature = signatures[0]!;
        const input = Buffer.from(
          `${signature.protected}.${Buffer.from(canonicalize(payload)!).toString('base64url')}`,
        );
        const signatureBytes = Buffer.from(signature.signature, 'base64url');
        const options = algorithm.startsWith('ES')
          ? { key: publicKey, dsaEncoding: 'ieee-p1363' as const }
          : algorithm.startsWith('PS')
            ? { key: publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST }
            : { key: publicKey };
        expect(verify(hash, input, options, signatureBytes)).toBe(true);
        if (algorithm.startsWith('RS')) {
          expect(signatureBytes).toEqual(nodeSign(hash, input, privateKey));
        }
      }
    },
  );
});
