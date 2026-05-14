import * as crypto from 'node:crypto';
import type { AgentCard, AgentCardSignature } from '@mastra/core/a2a';
import type { A2AAgentCardSigningConfig } from '@mastra/core/server';
import canonicalize from 'canonicalize';

const SUPPORTED_JWS_ALGORITHMS = new Set<string>([
  'ES256',
  'ES384',
  'ES512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
]);

function stripAgentCardSignatures(agentCard: AgentCard): AgentCard {
  const unsignedCard = structuredClone(agentCard) as AgentCard & { signatures?: AgentCardSignature[] };
  delete unsignedCard.signatures;
  return unsignedCard;
}

function importSigningKey(signing: A2AAgentCardSigningConfig) {
  const { privateKey } = signing;

  if (typeof privateKey === 'string') {
    return crypto.createPrivateKey(privateKey);
  }

  return crypto.createPrivateKey({
    key: privateKey,
    format: 'jwk',
  });
}

function getProtectedHeader(signing: A2AAgentCardSigningConfig): Record<string, unknown> {
  const { alg, ...rest } = signing.protectedHeader;

  if (!SUPPORTED_JWS_ALGORITHMS.has(alg)) {
    throw new Error(`Unsupported JWS algorithm for A2A Agent Card signing: ${alg}`);
  }

  return {
    ...rest,
    alg,
  };
}

type SignatureOptions = Pick<crypto.SignKeyObjectInput, 'dsaEncoding' | 'padding' | 'saltLength'>;

function getSignatureOptions(algorithm: string): SignatureOptions {
  if (algorithm.startsWith('ES')) {
    return { dsaEncoding: 'ieee-p1363' as const };
  }

  if (algorithm.startsWith('PS')) {
    return {
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    };
  }

  return {};
}

function getDigestAlgorithm(algorithm: string): string {
  if (algorithm.endsWith('256')) return 'sha256';
  if (algorithm.endsWith('384')) return 'sha384';
  if (algorithm.endsWith('512')) return 'sha512';
  throw new Error(`Unsupported JWS algorithm for A2A Agent Card signing: ${algorithm}`);
}

export async function signAgentCard({
  agentCard,
  signing,
}: {
  agentCard: AgentCard;
  signing: A2AAgentCardSigningConfig;
}): Promise<AgentCard> {
  const canonicalPayload = canonicalize(stripAgentCardSignatures(agentCard));

  if (!canonicalPayload) {
    throw new Error('Failed to canonicalize A2A Agent Card for signing');
  }

  const key = importSigningKey(signing);
  const protectedHeader = getProtectedHeader(signing);
  const encodedHeader = Buffer.from(JSON.stringify(protectedHeader), 'utf8').toString('base64url');
  const encodedPayload = Buffer.from(canonicalPayload, 'utf8').toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBuffer = crypto.sign(
    getDigestAlgorithm(String(protectedHeader.alg)),
    Buffer.from(signingInput, 'utf8'),
    {
      key,
      ...getSignatureOptions(String(protectedHeader.alg)),
    },
  );
  const signatureValue = signatureBuffer.toString('base64url');

  if (!encodedHeader || !signatureValue) {
    throw new Error('Failed to create compact JWS for A2A Agent Card');
  }

  const signature: AgentCardSignature = {
    protected: encodedHeader,
    signature: signatureValue,
    header: signing.header,
  };

  return {
    ...agentCard,
    signatures: [...(agentCard.signatures ?? []), signature],
  };
}
