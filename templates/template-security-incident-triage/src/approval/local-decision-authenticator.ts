import { createHmac, timingSafeEqual } from 'node:crypto';

import { AuthenticatedDecisionContextSchema } from '../schemas/approval.js';
import { WEBHOOK_TOLERANCE_MS } from '../app/webhooks/signature.js';
import {
  DecisionAuthenticationError,
  type DecisionAuthenticationInput,
  type DecisionAuthenticator,
} from './decision-authenticator.js';

const noncePattern = /^[A-Za-z0-9_-]{16,128}$/u;

export class LocalDecisionAuthenticator implements DecisionAuthenticator {
  private readonly usedNonces = new Map<string, number>();

  constructor(
    private readonly options: Readonly<{
      mode: 'local' | 'staging' | 'production';
      enabled: boolean;
      secret: string;
      nowMs?: () => number;
    }>,
  ) {}

  async authenticate(input: DecisionAuthenticationInput) {
    if (this.options.mode !== 'local' || !this.options.enabled) {
      throw new DecisionAuthenticationError('AUTHENTICATION_MODE_DENIED');
    }
    if (!input.signature || !input.nonce || !input.tenantId) {
      throw new DecisionAuthenticationError('AUTHENTICATION_REQUIRED');
    }
    if (!noncePattern.test(input.nonce)) {
      throw new DecisionAuthenticationError('AUTHENTICATION_INVALID');
    }
    const parsed = parseSignature(input.signature);
    const now = this.options.nowMs?.() ?? Date.now();
    if (Math.abs(now - parsed.timestamp) > WEBHOOK_TOLERANCE_MS) {
      throw new DecisionAuthenticationError('AUTHENTICATION_EXPIRED');
    }
    this.prune(now);
    if (this.usedNonces.has(input.nonce)) {
      throw new DecisionAuthenticationError('AUTHENTICATION_REPLAYED');
    }
    const expected = createHmac('sha256', this.options.secret)
      .update(`${parsed.timestamp}.${input.nonce}.${input.method.toUpperCase()}.${input.path}.`)
      .update(`${input.tenantId}.`)
      .update(input.rawBody)
      .digest();
    if (!timingSafeEqual(expected, parsed.signature)) {
      throw new DecisionAuthenticationError('AUTHENTICATION_INVALID');
    }
    this.usedNonces.set(input.nonce, now);
    return AuthenticatedDecisionContextSchema.parse({
      actorId: 'studio-soc-manager',
      tenantId: input.tenantId,
      role: 'soc_manager',
      local: true,
    });
  }

  private prune(now: number): void {
    for (const [nonce, usedAt] of this.usedNonces) {
      if (now - usedAt > WEBHOOK_TOLERANCE_MS) this.usedNonces.delete(nonce);
    }
  }
}

function parseSignature(value: string): Readonly<{
  timestamp: number;
  signature: Buffer;
}> {
  const match = /^t=([0-9]{13}),v1=([a-fA-F0-9]{64})$/u.exec(value);
  if (!match) throw new DecisionAuthenticationError('AUTHENTICATION_INVALID');
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp)) {
    throw new DecisionAuthenticationError('AUTHENTICATION_INVALID');
  }
  return { timestamp, signature: Buffer.from(match[2]!, 'hex') };
}
