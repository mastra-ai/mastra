import { describe, expect, it } from 'vitest';

import { normalizeAlertWebhook, normalizeWorkOsReal } from '../../src/app/webhooks/normalizers.js';
import { makeAlertWebhook } from '../fixtures/alert-intake.js';

describe('webhook normalizers', () => {
  it('derives server-owned IDs and canonicalizes timestamp and IPv6', () => {
    const body = Buffer.from('fixture');
    const result = normalizeAlertWebhook(
      makeAlertWebhook({
        occurredAt: '2026-08-27T08:59:00-03:00',
        ip: '2001:0db8:0:0:0:0:0:1',
      }),
      body,
      new Set(['security-monitor']),
    );
    expect(result.disposition).toBe('alert');
    if (result.disposition === 'alert') {
      expect(result.alert).toMatchObject({
        occurredAt: '2026-08-27T11:59:00.000Z',
        ip: '2001:db8::1',
      });
      expect(result.alert.alertId).toMatch(/^alert_[a-f0-9]{64}$/u);
      expect(result.alert.idempotencyKey).toMatch(/^[a-f0-9]{64}$/u);
      expect(result.alert.rawPayloadRef).toMatch(/^sha256:[a-f0-9]{64}$/u);
    }
  });

  it.each([
    ['session.created', 'active'],
    ['session.revoked', 'revoked'],
  ] as const)('accepts the official %s envelope when session status is omitted', (event, expectedStatus) => {
    const payload = {
      object: 'event',
      id: `event-${expectedStatus}`,
      event,
      created_at: '2026-09-02T12:00:00.000Z',
      context: { client_id: 'client-staging' },
      data: {
        object: 'session',
        id: 'session-staging',
        user_id: 'user-staging',
        organization_id: 'org-staging',
        ip_address: '200.160.2.3',
        user_agent: 'test-agent',
        created_at: '2026-09-02T12:00:00.000Z',
        updated_at: '2026-09-02T12:00:00.000Z',
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const result = normalizeWorkOsReal(payload, rawBody, {
      organizationId: 'org-staging',
      userIds: new Set(['user-staging']),
      roleSlugs: new Set(['member', 'admin']),
    });

    expect(result.disposition).toBe('alert');
    if (result.disposition === 'alert') {
      expect(result.alert).toMatchObject({
        kind: 'disallowed_country_login',
        sourceEventId: `event-${expectedStatus}`,
        sessionId: 'session-staging',
        changes: {
          workosEventType: event,
          sessionStatus: expectedStatus,
        },
      });
    }
  });

  it('accepts the official membership envelope with object and provider extras', () => {
    const payload = {
      id: 'event_01G69A9MDSW8MM1XW5S0EHBR9F',
      data: {
        id: 'om_01EHWNC0FCBHZ3BJ7EGKYXK0E7',
        role: { slug: 'member' },
        roles: [{ slug: 'member' }],
        object: 'organization_membership',
        status: 'active',
        user_id: 'user_01EHWNC0FCBHZ3BJ7EGKYXK0E6',
        created_at: '2023-11-27T19:07:33.155Z',
        updated_at: '2023-11-27T19:07:33.155Z',
        organization_id: 'org_01EHWNCE74X7JSDV0X3SZ3KJNY',
        custom_attributes: {},
        directory_managed: false,
      },
      event: 'organization_membership.updated',
      object: 'event',
      created_at: '2026-09-02T12:50:43.135Z',
    };
    const result = normalizeWorkOsReal(payload, Buffer.from(JSON.stringify(payload)), {
      organizationId: 'org_01EHWNCE74X7JSDV0X3SZ3KJNY',
      userIds: new Set(['user_01EHWNC0FCBHZ3BJ7EGKYXK0E6']),
      roleSlugs: new Set(['member', 'admin']),
    });

    expect(result.disposition).toBe('alert');
    if (result.disposition === 'alert') {
      expect(result.alert).toMatchObject({
        source: 'workos',
        sourceEventId: 'event_01G69A9MDSW8MM1XW5S0EHBR9F',
        kind: 'unauthorized_privilege_change',
        tenantId: 'org_01EHWNCE74X7JSDV0X3SZ3KJNY',
        subjectId: 'user_01EHWNC0FCBHZ3BJ7EGKYXK0E6',
        target: {
          id: 'om_01EHWNC0FCBHZ3BJ7EGKYXK0E7',
          type: 'membership',
        },
      });
    }
  });
});
