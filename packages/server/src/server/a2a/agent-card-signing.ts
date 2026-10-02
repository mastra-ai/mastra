import type { AgentCardSignature } from '@mastra/core/a2a';
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

function stripAgentCardSignatures<T extends { signatures?: AgentCardSignature[] }>(agentCard: T): T {
  const unsignedCard = structuredClone(agentCard);
  delete unsignedCard.signatures;
  return unsignedCard;
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

function getDigestAlgorithm(algorithm: string): string {
  if (algorithm.endsWith('256')) return 'sha256';
  if (algorithm.endsWith('384')) return 'sha384';
  if (algorithm.endsWith('512')) return 'sha512';
  throw new Error(`Unsupported JWS algorithm for A2A Agent Card signing: ${algorithm}`);
}

export async function signAgentCard<T extends { signatures?: AgentCardSignature[] }>({
  agentCard,
  signing,
}: {
  agentCard: T;
  signing: A2AAgentCardSigningConfig;
}): Promise<T & { signatures: AgentCardSignature[] }> {
  const canonicalPayload = canonicalize(stripAgentCardSignatures(agentCard));

  if (!canonicalPayload) {
    throw new Error('Failed to canonicalize A2A Agent Card for signing');
  }

  const protectedHeader = getProtectedHeader(signing);
  const algorithm = String(protectedHeader.alg);
  const encodedHeader = Buffer.from(JSON.stringify(protectedHeader), 'utf8').toString('base64url');
  const encodedPayload = Buffer.from(canonicalPayload, 'utf8').toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKey = signing.privateKey;
  let signatureBuffer: Buffer;

  if (typeof privateKey !== 'string' || privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    const hash = getDigestAlgorithm(algorithm).replace('sha', 'SHA-');
    const keyAlgorithm = algorithm.startsWith('ES')
      ? { name: 'ECDSA', namedCurve: algorithm === 'ES512' ? 'P-521' : `P-${algorithm.slice(2)}` }
      : { name: algorithm.startsWith('PS') ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5', hash };
    const key =
      typeof privateKey === 'string'
        ? await globalThis.crypto.subtle.importKey(
            'pkcs8',
            Buffer.from(privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ''), 'base64'),
            keyAlgorithm,
            false,
            ['sign'],
          )
        : await globalThis.crypto.subtle.importKey('jwk', privateKey, keyAlgorithm, false, ['sign']);
    const signAlgorithm = algorithm.startsWith('ES')
      ? { name: 'ECDSA', hash }
      : algorithm.startsWith('PS')
        ? { name: 'RSA-PSS', saltLength: Number(algorithm.slice(2)) / 8 }
        : { name: 'RSASSA-PKCS1-v1_5' };
    signatureBuffer = Buffer.from(
      await globalThis.crypto.subtle.sign(signAlgorithm, key, new TextEncoder().encode(signingInput)),
    );
  } else {
    // Node's signer also accepts PKCS#1 and SEC1 PEM; Web Crypto only imports PKCS#8.
    const crypto = await import('node:crypto');
    const key = crypto.createPrivateKey(privateKey);
    signatureBuffer = crypto.sign(getDigestAlgorithm(algorithm), Buffer.from(signingInput, 'utf8'), {
      key,
      ...(algorithm.startsWith('ES') ? { dsaEncoding: 'ieee-p1363' as const } : {}),
      ...(algorithm.startsWith('PS')
        ? { padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST }
        : {}),
    });
  }
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
