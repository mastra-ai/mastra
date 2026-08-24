import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENVELOPE_PREFIX = 'mastra:factory-secret:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

interface SecretEnvelopeV1 {
  keyId: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface DecryptedFactorySecret<T> {
  value: T;
  needsReencryption: boolean;
}

/** Encrypts opaque JSON values before they cross the Factory storage boundary. */
export interface FactorySecretEncryption {
  encrypt<T>(value: T): Promise<string>;
  decrypt<T>(value: unknown): Promise<DecryptedFactorySecret<T>>;
}

export interface FactorySecretEncryptionKey {
  id: string;
  key: Uint8Array;
}

export interface FactorySecretEncryptionConfig {
  primary: FactorySecretEncryptionKey;
  previous?: FactorySecretEncryptionKey[];
}

function validateKey({ id, key }: FactorySecretEncryptionKey): Buffer {
  if (!id) throw new Error('[FactorySecretEncryption] Key id is required.');
  const buffer = Buffer.from(key);
  if (buffer.byteLength !== 32) {
    throw new Error(`[FactorySecretEncryption] Key "${id}" must be exactly 32 bytes.`);
  }
  return buffer;
}

function parseEnvelope(value: string): SecretEnvelopeV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value.slice(ENVELOPE_PREFIX.length), 'base64url').toString('utf8'));
  } catch {
    throw new Error('[FactorySecretEncryption] Invalid encrypted value.');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as SecretEnvelopeV1).keyId !== 'string' ||
    typeof (parsed as SecretEnvelopeV1).iv !== 'string' ||
    typeof (parsed as SecretEnvelopeV1).ciphertext !== 'string' ||
    typeof (parsed as SecretEnvelopeV1).tag !== 'string'
  ) {
    throw new Error('[FactorySecretEncryption] Invalid encrypted value.');
  }
  return parsed as SecretEnvelopeV1;
}

/**
 * Creates a versioned AES-256-GCM encryptor. The primary key is used for new
 * writes; previous keys remain decrypt-only until stored values are rotated.
 */
export function createFactorySecretEncryption(config: FactorySecretEncryptionConfig): FactorySecretEncryption {
  const primaryKey = validateKey(config.primary);
  const keys = new Map<string, Buffer>([[config.primary.id, primaryKey]]);
  for (const previous of config.previous ?? []) {
    if (keys.has(previous.id)) throw new Error(`[FactorySecretEncryption] Duplicate key id "${previous.id}".`);
    keys.set(previous.id, validateKey(previous));
  }

  return {
    async encrypt<T>(value: T): Promise<string> {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, primaryKey, iv);
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      const envelope: SecretEnvelopeV1 = {
        keyId: config.primary.id,
        iv: iv.toString('base64url'),
        ciphertext: ciphertext.toString('base64url'),
        tag: cipher.getAuthTag().toString('base64url'),
      };
      return `${ENVELOPE_PREFIX}${Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url')}`;
    },

    async decrypt<T>(value: unknown): Promise<DecryptedFactorySecret<T>> {
      if (typeof value !== 'string' || !value.startsWith(ENVELOPE_PREFIX)) {
        return { value: structuredClone(value) as T, needsReencryption: true };
      }

      const envelope = parseEnvelope(value);
      const key = keys.get(envelope.keyId);
      if (!key) throw new Error(`[FactorySecretEncryption] Unknown key id "${envelope.keyId}".`);

      try {
        const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, 'base64url'));
        decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
          decipher.final(),
        ]).toString('utf8');
        return {
          value: JSON.parse(plaintext) as T,
          needsReencryption: envelope.keyId !== config.primary.id,
        };
      } catch {
        throw new Error('[FactorySecretEncryption] Unable to decrypt encrypted value.');
      }
    },
  };
}

/** Explicit plaintext compatibility for local, no-auth Factory development. */
export function createPlaintextFactorySecretEncryption(): FactorySecretEncryption {
  return {
    async encrypt<T>(value: T): Promise<string> {
      return JSON.stringify(value);
    },
    async decrypt<T>(value: unknown): Promise<DecryptedFactorySecret<T>> {
      if (typeof value !== 'string') return { value: structuredClone(value) as T, needsReencryption: false };
      try {
        return { value: JSON.parse(value) as T, needsReencryption: false };
      } catch {
        // Pre-encryption rows stored raw secret strings (e.g. a bare
        // `custom_providers.api_key`), not JSON. Treat the raw string as the
        // value and flag it so migration rewrites it in the current format.
        return { value: value as T, needsReencryption: true };
      }
    },
  };
}
