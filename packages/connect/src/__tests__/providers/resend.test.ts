import { afterEach, describe, expect, it, vi } from 'vitest';

import { createResendTools } from '../../providers/resend.js';

const TOKEN = 'fake-test-token';

const EXPECTED_TOOLS = [
  'resend_send_email',
  'resend_get_email',
  'resend_list_domains',
  'resend_list_audiences',
  'resend_create_contact',
  'resend_list_contacts',
  'resend_list_broadcasts',
];

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createResendTools>[0]) {
  return createResendTools({
    connectionId: 'c_rs1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createResendTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createResendTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createResendTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createResendTools({ allowTools: ['resend_send_email'] });
    expect(Object.keys(tools)).toEqual(['resend_send_email']);
    expect(() => createResendTools({ allowTools: ['resend_nope'] })).toThrow(/resend_nope/);
  });

  it('POSTs send_email to the proxy-root emails path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'em-1' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'resend_send_email').execute(
      {
        from: 'Acme <noreply@acme.test>',
        to: ['ada@acme.test'],
        subject: 'Hello',
        text: 'Hi Ada',
        replyTo: 'team@acme.test',
      },
      {} as never,
    );
    expect(result).toEqual({ id: 'em-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_rs1/proxy/emails');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      from: 'Acme <noreply@acme.test>',
      to: ['ada@acme.test'],
      subject: 'Hello',
      text: 'Hi Ada',
      html: undefined,
      reply_to: 'team@acme.test',
    });
  });

  it('rejects send_email without text or html without calling fetch', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const rejected = await tool(tools, 'resend_send_email').execute(
      { from: 'a@b.test', to: ['c@d.test'], subject: 'No body' },
      {} as never,
    );
    expect(rejected).toMatchObject({ error: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gets an email by id with content and last event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: 'em-1',
        from: 'Acme <noreply@acme.test>',
        to: ['ada@acme.test'],
        subject: 'Hello',
        text: 'Hi Ada',
        html: '<p>Hi Ada</p>',
        created_at: '2026-09-03T00:00:00Z',
        last_event: 'delivered',
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'resend_get_email').execute({ emailId: 'em-1' }, {} as never);
    expect(result).toEqual({
      id: 'em-1',
      from: 'Acme <noreply@acme.test>',
      to: ['ada@acme.test'],
      subject: 'Hello',
      text: 'Hi Ada',
      html: '<p>Hi Ada</p>',
      createdAt: '2026-09-03T00:00:00Z',
      lastEvent: 'delivered',
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_rs1/proxy/emails/em-1');
  });

  it('lists domains from the data envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: 'dom-1',
            name: 'acme.test',
            status: 'verified',
            region: 'us-east-1',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'resend_list_domains').execute({}, {} as never);
    expect(result).toEqual({
      domains: [
        { id: 'dom-1', name: 'acme.test', status: 'verified', region: 'us-east-1', createdAt: '2026-01-01T00:00:00Z' },
      ],
    });
  });

  it('lists audiences', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: [{ id: 'aud-1', name: 'Newsletter', created_at: '2026-02-01T00:00:00Z' }] }),
      );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'resend_list_audiences').execute({}, {} as never);
    expect(result).toEqual({
      audiences: [{ id: 'aud-1', name: 'Newsletter', createdAt: '2026-02-01T00:00:00Z' }],
    });
  });

  it('creates a contact under the audience path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'con-1', object: 'contact' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'resend_create_contact').execute(
      { audienceId: 'aud-1', email: 'ada@acme.test', firstName: 'Ada', unsubscribed: false },
      {} as never,
    );
    expect(result).toEqual({ id: 'con-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_rs1/proxy/audiences/aud-1/contacts');
    expect(JSON.parse(init.body)).toEqual({
      email: 'ada@acme.test',
      first_name: 'Ada',
      last_name: undefined,
      unsubscribed: false,
    });
  });

  it('lists contacts of an audience', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: 'con-1',
            email: 'ada@acme.test',
            first_name: 'Ada',
            last_name: 'Lovelace',
            unsubscribed: false,
            created_at: '2026-03-01T00:00:00Z',
          },
        ],
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'resend_list_contacts').execute({ audienceId: 'aud-1' }, {} as never);
    expect(result).toEqual({
      contacts: [
        {
          id: 'con-1',
          email: 'ada@acme.test',
          firstName: 'Ada',
          lastName: 'Lovelace',
          unsubscribed: false,
          createdAt: '2026-03-01T00:00:00Z',
        },
      ],
    });
  });

  it('lists broadcasts with nullable schedule/sent timestamps', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: 'br-1',
            name: null,
            audience_id: 'aud-1',
            status: 'sent',
            created_at: '2026-04-01T00:00:00Z',
            scheduled_at: null,
            sent_at: '2026-04-02T00:00:00Z',
          },
        ],
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'resend_list_broadcasts').execute({}, {} as never);
    expect(result).toEqual({
      broadcasts: [
        {
          id: 'br-1',
          name: null,
          audienceId: 'aud-1',
          status: 'sent',
          createdAt: '2026-04-01T00:00:00Z',
          scheduledAt: null,
          sentAt: '2026-04-02T00:00:00Z',
        },
      ],
    });
  });

  it('falls back to MASTRA_RESEND_CONNECTION_ID and errors when unresolvable', async () => {
    vi.stubEnv('MASTRA_RESEND_CONNECTION_ID', 'c_envrs');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    const tools = createResendTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'resend_list_domains').execute({}, {} as never);
    expect(fetchMock.mock.calls[0]![0]).toContain('/v2/connections/c_envrs/proxy/');

    vi.stubEnv('MASTRA_RESEND_CONNECTION_ID', '');
    const tools2 = createResendTools({ client: { accessToken: TOKEN, baseUrl: 'https://example.test' } });
    await expect(tool(tools2, 'resend_list_domains').execute({}, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
  });
});
