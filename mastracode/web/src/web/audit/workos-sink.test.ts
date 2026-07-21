import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createEvent = vi.fn(async () => undefined);

vi.mock('../auth', async () => {
  const actual = (await vi.importActual('../auth')) as Record<string, unknown>;
  return {
    ...actual,
    getWorkOSProvider: () => ({ getWorkOS: () => ({ auditLogs: { createEvent } }) }),
  };
});

// Mock the provider class so `isWorkOSAuth()`'s instanceof check matches
// instances seeded below without constructing a real WorkOS client.
vi.mock('@mastra/auth-workos', () => ({
  MastraAuthWorkos: class {},
}));

import { MastraAuthWorkos } from '@mastra/auth-workos';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { __resetRuntimeConfigForTests, seedRuntimeConfig } from '../runtime-config';
import type { AuditEventRow } from '../storage/domains/audit/base';
import { forwardToWorkOS, toWorkOSEvent } from './workos-sink';

function makeRow(overrides: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    orgId: 'org_123',
    actorId: 'user_abc',
    actorType: 'human',
    action: 'factory.work_item.stage_moved',
    targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix login' }],
    metadata: { fromStages: ['intake'], toStages: ['triage'], count: 2, ok: true },
    githubProjectId: '11111111-1111-4111-8111-111111111111',
    context: { location: '10.0.0.1', userAgent: 'vitest' },
    occurredAt: new Date('2026-07-15T12:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  createEvent.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetRuntimeConfigForTests();
  delete process.env.WORKOS_API_KEY;
  delete process.env.WORKOS_CLIENT_ID;
});

describe('toWorkOSEvent', () => {
  it('maps the local row to the WorkOS createEvent payload', () => {
    const event = toWorkOSEvent(makeRow());
    expect(event).toEqual({
      action: 'factory.work_item.stage_moved',
      occurredAt: new Date('2026-07-15T12:00:00Z'),
      actor: { type: 'user', id: 'user_abc' },
      targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix login' }],
      context: { location: '10.0.0.1', userAgent: 'vitest' },
      metadata: { fromStages: '["intake"]', toStages: '["triage"]', count: 2, ok: true },
    });
  });

  it('maps agent rows to an agent actor type', () => {
    const event = toWorkOSEvent(makeRow({ actorId: 'agent:thread-1', actorType: 'agent' }));
    expect(event.actor).toEqual({ type: 'agent', id: 'agent:thread-1' });
  });

  it('falls back to an unknown location and drops null metadata values', () => {
    const event = toWorkOSEvent(makeRow({ context: {}, metadata: { a: null, b: undefined, keep: 'yes' } }));
    expect(event.context).toEqual({ location: 'unknown' });
    expect(event.metadata).toEqual({ keep: 'yes' });
  });
});

describe('forwardToWorkOS', () => {
  it('is a no-op when WorkOS auth is not configured', async () => {
    await forwardToWorkOS(makeRow());
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('is a no-op when auth is enabled but the active provider is not WorkOS (better-auth)', async () => {
    seedRuntimeConfig({ authProvider: { name: 'better-auth' } as IMastraAuthProvider });
    await forwardToWorkOS(makeRow());
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('forwards when the factory seeded a WorkOS provider', async () => {
    seedRuntimeConfig({ authProvider: new MastraAuthWorkos() as unknown as IMastraAuthProvider });
    await forwardToWorkOS(makeRow());
    expect(createEvent).toHaveBeenCalledTimes(1);
  });

  it('forwards the mapped event scoped to the org when configured', async () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    process.env.WORKOS_CLIENT_ID = 'client_test';

    await forwardToWorkOS(makeRow());
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(createEvent).toHaveBeenCalledWith(
      'org_123',
      expect.objectContaining({ action: 'factory.work_item.stage_moved', actor: { type: 'user', id: 'user_abc' } }),
    );
  });

  it('never throws when the WorkOS call rejects (e.g. unregistered action)', async () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    process.env.WORKOS_CLIENT_ID = 'client_test';
    createEvent.mockRejectedValueOnce(new Error('Invalid Audit Log event'));

    await expect(forwardToWorkOS(makeRow())).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[Audit] Failed to forward audit event to WorkOS',
      expect.objectContaining({ action: 'factory.work_item.stage_moved' }),
    );
  });
});
