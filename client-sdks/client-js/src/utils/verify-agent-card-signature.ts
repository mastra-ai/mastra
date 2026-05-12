import type { AgentCard, AgentCardSignature } from '@mastra/core/a2a';
import canonicalize from 'canonicalize';
import { base64url, compactVerify, decodeProtectedHeader, importJWK, importSPKI, importX509 } from 'jose';
import type { CryptoKey, JWK, ProtectedHeaderParameters } from 'jose';
import { MastraClientError } from '../types';

const DEFAULT_AGENT_CARD_SIGNATURE_ALGORITHMS = [
  'ES256',
  'ES384',
  'ES512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
] as const;

export type AgentCardVerificationKey = CryptoKey | JWK | string | Uint8Array | ArrayBuffer;

export type AgentCardSignatureKeyProviderInput = {
  agentCard: AgentCard;
  signature: AgentCardSignature;
  protectedHeader: ProtectedHeaderParameters;
  alg?: string;
  kid?: string;
  jku?: string;
  index: number;
};

/**
 * @experimental Agent Card verification may evolve as A2A JS signing support settles.
 */
export type VerifyAgentCardSignatureOptions = {
  keyProvider: (
    input: AgentCardSignatureKeyProviderInput,
  ) => Promise<AgentCardVerificationKey | null | undefined> | AgentCardVerificationKey | null | undefined;
  algorithms?: string[];
};

function stripAgentCardSignatures(agentCard: AgentCard): AgentCard {
  const unsignedCard = structuredClone(agentCard) as AgentCard & { signatures?: AgentCardSignature[] };
  delete unsignedCard.signatures;
  return unsignedCard;
}

function isCryptoKey(value: unknown): value is CryptoKey {
  const cryptoKeyConstructor = (globalThis as { CryptoKey?: new (...args: any[]) => unknown }).CryptoKey;
  return typeof cryptoKeyConstructor !== 'undefined' && value instanceof cryptoKeyConstructor;
}

function isPem(value: string): boolean {
  return value.includes('-----BEGIN ');
}

function isCertificate(value: string): boolean {
  return value.includes('-----BEGIN CERTIFICATE-----');
}

async function importVerificationKey(
  key: AgentCardVerificationKey,
  algorithm: string,
): Promise<CryptoKey | Uint8Array> {
  if (isCryptoKey(key) || key instanceof Uint8Array) {
    return key;
  }

  if (key instanceof ArrayBuffer) {
    return new Uint8Array(key);
  }

  if (typeof key === 'string') {
    if (algorithm.startsWith('HS')) {
      return new TextEncoder().encode(key);
    }

    if (!isPem(key)) {
      throw new Error('Expected a PEM-encoded public key or certificate string for Agent Card verification');
    }

    if (isCertificate(key)) {
      return importX509(key, algorithm);
    }

    return importSPKI(key, algorithm);
  }

  return importJWK(key as JWK, algorithm);
}

export async function verifyAgentCardSignatureIfPresent(
  agentCard: AgentCard,
  options: VerifyAgentCardSignatureOptions,
): Promise<AgentCard> {
  const signatures = agentCard.signatures ?? [];
  if (signatures.length === 0) {
    return agentCard;
  }

  const canonicalPayload = canonicalize(stripAgentCardSignatures(agentCard));
  if (!canonicalPayload) {
    throw new MastraClientError(200, 'OK', 'Failed to canonicalize A2A Agent Card for signature verification');
  }

  const allowedAlgorithms = options.algorithms ?? [...DEFAULT_AGENT_CARD_SIGNATURE_ALGORITHMS];
  const encodedPayload = base64url.encode(canonicalPayload);
  const verificationErrors: string[] = [];

  for (const [index, signature] of signatures.entries()) {
    try {
      const compactJws = `${signature.protected}.${encodedPayload}.${signature.signature}`;
      const protectedHeader = decodeProtectedHeader(compactJws);

      if (typeof protectedHeader.alg !== 'string') {
        throw new Error('Agent Card signature is missing a protected "alg" header');
      }

      if (!allowedAlgorithms.includes(protectedHeader.alg)) {
        throw new Error(`Agent Card signature algorithm "${protectedHeader.alg}" is not allowed`);
      }

      const verificationKey = await options.keyProvider({
        agentCard,
        signature,
        protectedHeader,
        alg: protectedHeader.alg,
        kid: typeof protectedHeader.kid === 'string' ? protectedHeader.kid : undefined,
        jku: typeof protectedHeader.jku === 'string' ? protectedHeader.jku : undefined,
        index,
      });

      if (!verificationKey) {
        throw new Error('No verification key was provided for Agent Card signature verification');
      }

      const importedKey = await importVerificationKey(verificationKey, protectedHeader.alg);
      await compactVerify(compactJws, importedKey, {
        algorithms: allowedAlgorithms,
      });

      return agentCard;
    } catch (error) {
      verificationErrors.push(error instanceof Error ? error.message : 'Unknown verification failure');
    }
  }

  throw new MastraClientError(
    200,
    'OK',
    `A2A Agent Card signature verification failed: ${verificationErrors.join('; ')}`,
  );
}
