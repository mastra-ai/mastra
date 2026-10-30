import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eventsCapabilityEntry, getEventsCapability } from './capability';
import { EVENTS_EXTENSION_ID, EVENTS_SUBSCRIPTION_ID_META_KEY } from './constants';
import {
  EventActiveNotificationParamsSchema,
  EventErrorNotificationParamsSchema,
  EventHeartbeatNotificationParamsSchema,
  EventNotificationParamsSchema,
  EventTerminatedNotificationParamsSchema,
  ListEventsResultSchema,
  PollEventsRequestParamsSchema,
  PollEventsResultSchema,
  StreamEventsRequestParamsSchema,
  StreamEventsResultSchema,
  SubscribeEventsRequestParamsSchema,
  SubscribeEventsResultSchema,
  UnsubscribeEventsRequestParamsSchema,
  WebhookSecretSchema,
  parseWebhookBody,
} from './schemas';

const meta = { [EVENTS_SUBSCRIPTION_ID_META_KEY]: 1 };
const secret = `whsec_${randomBytes(32).toString('base64')}`;

// Examples below are taken verbatim from SEP-3415 (comments stripped).
describe('events/list', () => {
  it('parses the SEP example result', () => {
    const result = ListEventsResultSchema.parse({
      resultType: 'complete',
      events: [
        {
          name: 'email.received',
          description: 'Fires when a new email arrives in the inbox',
          delivery: ['poll'],
          inputSchema: { type: 'object', properties: { from: { type: 'string' } } },
          payloadSchema: { type: 'object', properties: { messageId: { type: 'string' } } },
        },
        {
          name: 'incident.created',
          description: 'Fires when a new PagerDuty incident is created',
          delivery: ['webhook', 'push', 'poll'],
          inputSchema: { type: 'object' },
          payloadSchema: { '...': '...' },
          _meta: { '...': '...' },
        },
      ],
      nextCursor: '...',
    });
    expect(result.events.map(e => e.delivery)).toEqual([['poll'], ['webhook', 'push', 'poll']]);
    expect(result.nextCursor).toBe('...');
  });

  it('tolerates unknown fields, unknown delivery modes and a missing resultType', () => {
    const result = ListEventsResultSchema.parse({
      events: [{ name: 'x', delivery: ['poll', 'carrier-pigeon'], futureField: 1 }],
      futureTopLevel: true,
    });
    expect(result.events[0]).toMatchObject({ name: 'x', futureField: 1 });
    expect(result).toMatchObject({ futureTopLevel: true });
  });

  it('rejects an empty delivery list', () => {
    expect(ListEventsResultSchema.safeParse({ events: [{ name: 'x', delivery: [] }] }).success).toBe(false);
  });
});

describe('events/poll', () => {
  it('parses the SEP example request and result', () => {
    expect(
      PollEventsRequestParamsSchema.parse({
        name: 'email.received',
        arguments: { from: '*@anthropic.com', redact_pii: true },
        cursor: null,
        maxAgeMs: 300000,
        maxEvents: 50,
      }),
    ).toMatchObject({ cursor: null, maxEvents: 50 });

    const result = PollEventsResultSchema.parse({
      resultType: 'complete',
      events: [
        {
          eventId: 'evt_001',
          name: 'email.received',
          timestamp: '2026-02-19T15:30:00Z',
          data: { messageId: 'msg_xyz', from: 'dsp@anthropic.com', subject: 'MCP spec review' },
        },
      ],
      cursor: 'historyId_99842',
      truncated: false,
      hasMore: false,
      nextPollMs: 30000,
    });
    expect(result.events[0]!.eventId).toBe('evt_001');
    expect(result.cursor).toBe('historyId_99842');
  });

  it('accepts a null result cursor for non-replayable event types', () => {
    expect(PollEventsResultSchema.parse({ events: [], cursor: null }).cursor).toBeNull();
  });

  it('requires a result cursor field', () => {
    expect(PollEventsResultSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it('rejects occurrences missing required fields', () => {
    expect(
      PollEventsResultSchema.safeParse({ events: [{ eventId: 'e', name: 'n', data: {} }], cursor: null }).success,
    ).toBe(false);
  });
});

describe('events/stream', () => {
  it('parses the SEP example request', () => {
    expect(
      StreamEventsRequestParamsSchema.parse({
        name: 'email.received',
        arguments: { from: '*@anthropic.com', redact_pii: true },
        cursor: null,
        maxAgeMs: 300000,
      }).name,
    ).toBe('email.received');
  });

  it('parses every SEP push notification example', () => {
    expect(
      EventActiveNotificationParamsSchema.parse({ cursor: 'historyId_99840', truncated: false, _meta: meta }),
    ).toMatchObject({ cursor: 'historyId_99840' });
    expect(
      EventNotificationParamsSchema.parse({
        eventId: 'evt_001',
        name: 'email.received',
        timestamp: '2026-02-19T15:30:00Z',
        data: { messageId: 'msg_xyz' },
        cursor: 'historyId_99842',
        _meta: meta,
      })._meta[EVENTS_SUBSCRIPTION_ID_META_KEY],
    ).toBe(1);
    expect(
      EventErrorNotificationParamsSchema.parse({
        error: { code: -32603, message: 'UpstreamError', data: { reason: 'Gmail API 503' } },
        _meta: meta,
      }).error.code,
    ).toBe(-32603);
    expect(EventHeartbeatNotificationParamsSchema.parse({ cursor: 'historyId_99850', _meta: meta }).cursor).toBe(
      'historyId_99850',
    );
    expect(
      EventTerminatedNotificationParamsSchema.parse({
        error: { code: -32024, message: 'Forbidden', data: { reason: 'Access revoked' } },
        _meta: { [EVENTS_SUBSCRIPTION_ID_META_KEY]: 'listen:1' },
      }).error.message,
    ).toBe('Forbidden');
    expect(StreamEventsResultSchema.parse({ resultType: 'complete', _meta: meta }).resultType).toBe('complete');
  });

  it('requires the subscription id on push notifications', () => {
    expect(EventHeartbeatNotificationParamsSchema.safeParse({ cursor: null, _meta: {} }).success).toBe(false);
    expect(EventActiveNotificationParamsSchema.safeParse({ cursor: null }).success).toBe(false);
  });
});

describe('events/subscribe and events/unsubscribe', () => {
  it('parses the SEP example request and responses', () => {
    expect(
      SubscribeEventsRequestParamsSchema.parse({
        name: 'incident.created',
        arguments: { severity: 'P1' },
        delivery: { mode: 'webhook', url: 'https://proxy.example.com/hooks/client123', secret },
        cursor: null,
        maxAgeMs: 300000,
        ttlMs: 3600000,
      }).ttlMs,
    ).toBe(3600000);

    const refreshed = SubscribeEventsResultSchema.parse({
      resultType: 'complete',
      id: 'sub_a3f1c8e2b0d49f7e',
      refreshBefore: '2026-02-19T17:00:00Z',
      cursor: 'cursor_xyz',
      truncated: false,
      deliveryStatus: {
        active: false,
        lastDeliveryAt: '2026-02-19T15:45:00Z',
        lastError: 'http_4xx',
        failedSince: '2026-02-19T15:50:00Z',
      },
    });
    expect(refreshed.deliveryStatus?.lastError).toBe('http_4xx');

    expect(
      UnsubscribeEventsRequestParamsSchema.parse({
        name: 'incident.created',
        arguments: { severity: 'P1' },
        delivery: { url: 'https://proxy.example.com/hooks/client123' },
      }).delivery.url,
    ).toBe('https://proxy.example.com/hooks/client123');
  });

  it('distinguishes omitted ttlMs from an explicit no-expiry request', () => {
    const base = { name: 'n', delivery: { mode: 'webhook', url: 'https://example.com/h', secret } };
    expect('ttlMs' in SubscribeEventsRequestParamsSchema.parse(base)).toBe(false);
    expect(SubscribeEventsRequestParamsSchema.parse({ ...base, ttlMs: null }).ttlMs).toBeNull();
  });

  it('accepts a no-expiry grant', () => {
    expect(SubscribeEventsResultSchema.parse({ id: 's', refreshBefore: null, cursor: null }).refreshBefore).toBeNull();
  });
});

describe('WebhookSecretSchema', () => {
  it.each([
    ['24 bytes', `whsec_${randomBytes(24).toString('base64')}`, true],
    ['64 bytes', `whsec_${randomBytes(64).toString('base64')}`, true],
    ['23 bytes', `whsec_${randomBytes(23).toString('base64')}`, false],
    ['65 bytes', `whsec_${randomBytes(65).toString('base64')}`, false],
    ['missing prefix', randomBytes(32).toString('base64'), false],
    ['not base64', 'whsec_not-base64!!', false],
    // Lenient decoders accept these; strict ones such as atob throw, so a receiver couldn't verify.
    ['length not a multiple of 4', `whsec_${'A'.repeat(33)}`, false],
    ['padding stripped', `whsec_${randomBytes(32).toString('base64').replace(/=+$/, '')}`, false],
  ])('%s', (_label, value, ok) => {
    expect(WebhookSecretSchema.safeParse(value).success).toBe(ok);
  });
});

describe('parseWebhookBody', () => {
  it('treats bodies without a type field as occurrences', () => {
    const parsed = parseWebhookBody({
      eventId: 'evt_789',
      name: 'incident.created',
      timestamp: '2026-02-19T16:00:00Z',
      data: { incidentId: 'INC-1234' },
      cursor: 'cursor_xyz',
    });
    expect(parsed.kind).toBe('event');
  });

  it('parses each control envelope from the SEP', () => {
    expect(parseWebhookBody({ type: 'gap', cursor: 'fresh' })).toEqual({
      kind: 'control',
      control: { type: 'gap', cursor: 'fresh' },
    });
    expect(
      parseWebhookBody({ type: 'terminated', error: { code: -32024, message: 'Forbidden', data: { reason: 'x' } } }),
    ).toMatchObject({ kind: 'control', control: { type: 'terminated' } });
    expect(parseWebhookBody({ type: 'verification', challenge: 'nonce' })).toMatchObject({
      control: { challenge: 'nonce' },
    });
  });

  it('rejects unknown control types', () => {
    expect(() => parseWebhookBody({ type: 'mystery' })).toThrow();
  });
});

describe('getEventsCapability', () => {
  it('reads the extensions entry', () => {
    expect(getEventsCapability({ extensions: { [EVENTS_EXTENSION_ID]: { listChanged: true } } })).toEqual({
      listChanged: true,
    });
    expect(getEventsCapability({ extensions: eventsCapabilityEntry() })).toEqual({});
  });

  it('returns undefined when not advertised, including the legacy top-level key', () => {
    expect(getEventsCapability(undefined)).toBeUndefined();
    expect(getEventsCapability({})).toBeUndefined();
    expect(getEventsCapability({ events: { listChanged: true } } as never)).toBeUndefined();
    expect(getEventsCapability({ extensions: { [EVENTS_EXTENSION_ID]: 'nope' } })).toBeUndefined();
  });
});
