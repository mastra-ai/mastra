import { randomBytes } from 'node:crypto';

import type { Actor } from '../domain/context.js';
import type { DemoPersona, DemoSession } from '../contracts/http/public-api.js';
import { publicSchemaVersion } from '../contracts/http/public-api.js';

export const demoSessionCookieName = 'kyc_demo_session';
export const demoSessionLifetimeMs = 8 * 60 * 60 * 1_000;

export type DemoSessionRecord = Readonly<{
  sessionId: string;
  tenantId: string;
  persona: DemoPersona;
  actor: Actor;
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
}>;

const actorFor = (persona: DemoPersona): Actor => {
  switch (persona) {
    case 'applicant':
      return { type: 'applicant', id: 'demo-applicant', roles: ['applicant'] };
    case 'reviewer':
      return { type: 'reviewer', id: 'demo-reviewer', roles: ['reviewer'] };
    case 'senior-reviewer':
      return { type: 'reviewer', id: 'demo-senior-reviewer', roles: ['senior-reviewer'] };
  }
};

const opaqueToken = (): string => randomBytes(32).toString('base64url');

export class DemoSessionStore {
  readonly #sessions = new Map<string, DemoSessionRecord>();

  constructor(private readonly tenantId: string) {}

  create(persona: DemoPersona, now: Date): DemoSessionRecord {
    const sessionId = opaqueToken();
    const record = Object.freeze({
      sessionId,
      tenantId: this.tenantId,
      persona,
      actor: actorFor(persona),
      csrfToken: opaqueToken(),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + demoSessionLifetimeMs).toISOString(),
    });
    this.#sessions.set(sessionId, record);
    return record;
  }

  get(sessionId: string | undefined, now: Date): DemoSessionRecord | undefined {
    if (sessionId === undefined) return undefined;
    const record = this.#sessions.get(sessionId);
    if (record === undefined) return undefined;
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      this.#sessions.delete(sessionId);
      return undefined;
    }
    return record;
  }

  delete(sessionId: string | undefined): void {
    if (sessionId !== undefined) this.#sessions.delete(sessionId);
  }

  toPublic(record: DemoSessionRecord): DemoSession {
    return {
      schemaVersion: publicSchemaVersion,
      persona: record.persona,
      csrfToken: record.csrfToken,
      expiresAt: record.expiresAt,
    };
  }
}
