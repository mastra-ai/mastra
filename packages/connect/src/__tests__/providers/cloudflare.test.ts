import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraConnectError } from '../../errors.js';
import { createCloudflareTools } from '../../providers/cloudflare.js';

const TOKEN = 'fake-test-token';

const EXPECTED_TOOLS = [
  'cloudflare_verify_token',
  'cloudflare_list_accounts',
  'cloudflare_list_zones',
  'cloudflare_list_dns_records',
  'cloudflare_create_dns_record',
  'cloudflare_update_dns_record',
  'cloudflare_delete_dns_record',
  'cloudflare_purge_cache',
];

const dnsRecordObject = {
  id: 'rec-1',
  type: 'A',
  name: 'www.example.test',
  content: '203.0.113.7',
  ttl: 300,
  proxied: true,
  comment: 'web frontend',
};

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createCloudflareTools>[0]) {
  return createCloudflareTools({
    connectionId: 'c_cf1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createCloudflareTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

function envelope(result: unknown, success = true, errors: unknown[] = []) {
  return Response.json({ success, errors, messages: [], result });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createCloudflareTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createCloudflareTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createCloudflareTools({ allowTools: ['cloudflare_list_zones'] });
    expect(Object.keys(tools)).toEqual(['cloudflare_list_zones']);
    expect(() => createCloudflareTools({ allowTools: ['cloudflare_nope'] })).toThrow(/cloudflare_nope/);
  });

  it('verifies the token through v4/user/tokens/verify', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 'tok-1', status: 'active' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'cloudflare_verify_token').execute({}, {} as never);
    expect(result).toEqual({ id: 'tok-1', status: 'active' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_cf1/proxy/v4/user/tokens/verify');
  });

  it('throws proxy_error when Cloudflare reports success:false on an HTTP 200', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope(null, false, [{ code: 9109, message: 'Invalid access token' }]));
    const tools = makeTools(fetchMock);
    try {
      await tool(tools, 'cloudflare_list_accounts').execute({}, {} as never);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MastraConnectError);
      expect((error as MastraConnectError).code).toBe('proxy_error');
      expect((error as Error).message).toContain('Invalid access token');
    }
  });

  it('lists zones with account_id filter and unwraps the result array', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope([{ id: 'zone-1', name: 'example.test', status: 'active', plan: { name: 'Free' } }]));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'cloudflare_list_zones').execute({ accountId: 'acc-1' }, {} as never);
    expect(result).toEqual({
      zones: [{ id: 'zone-1', name: 'example.test', status: 'active', planName: 'Free' }],
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_cf1/proxy/v4/zones?account_id=acc-1');
  });

  it('lists DNS records with type filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope([dnsRecordObject]));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'cloudflare_list_dns_records').execute(
      { zoneId: 'zone-1', type: 'A' },
      {} as never,
    );
    expect(result).toEqual({
      dnsRecords: [
        {
          id: 'rec-1',
          type: 'A',
          name: 'www.example.test',
          content: '203.0.113.7',
          ttl: 300,
          proxied: true,
          comment: 'web frontend',
        },
      ],
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_cf1/proxy/v4/zones/zone-1/dns_records?type=A');
  });

  it('rejects an MX record without priority without calling fetch', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const rejected = await tool(tools, 'cloudflare_create_dns_record').execute(
      { zoneId: 'zone-1', type: 'MX', name: '@', content: 'mail.example.test' },
      {} as never,
    );
    expect(rejected).toMatchObject({ error: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs create_dns_record with the shaped body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope(dnsRecordObject));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'cloudflare_create_dns_record').execute(
      { zoneId: 'zone-1', type: 'A', name: 'www', content: '203.0.113.7', ttl: 300, proxied: true },
      {} as never,
    );
    expect(result).toMatchObject({ id: 'rec-1', proxied: true });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body)).toMatchObject({ type: 'A', name: 'www', content: '203.0.113.7', ttl: 300 });
  });

  it('rejects a no-op cloudflare_update_dns_record without calling fetch', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const rejected = await tool(tools, 'cloudflare_update_dns_record').execute(
      { zoneId: 'zone-1', recordId: 'rec-1' },
      {} as never,
    );
    expect(rejected).toMatchObject({ error: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DELETEs a DNS record', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 'rec-1' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'cloudflare_delete_dns_record').execute(
      { zoneId: 'zone-1', recordId: 'rec-1' },
      {} as never,
    );
    expect(result).toEqual({ id: 'rec-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_cf1/proxy/v4/zones/zone-1/dns_records/rec-1');
    expect(init.method).toBe('DELETE');
  });

  it('purges the whole cache with everything:true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 'purge-1' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'cloudflare_purge_cache').execute(
      { zoneId: 'zone-1', everything: true },
      {} as never,
    );
    expect(result).toEqual({ purgeId: 'purge-1' });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body)).toEqual({ everything: true });
  });

  it('rejects purge_cache mixing everything with targets, and empty purges', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const mixed = await tool(tools, 'cloudflare_purge_cache').execute(
      { zoneId: 'zone-1', everything: true, tags: ['t1'] },
      {} as never,
    );
    expect(mixed).toMatchObject({ error: true });
    const empty = await tool(tools, 'cloudflare_purge_cache').execute({ zoneId: 'zone-1' }, {} as never);
    expect(empty).toMatchObject({ error: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to MASTRA_CLOUDFLARE_CONNECTION_ID and errors when unresolvable', async () => {
    vi.stubEnv('MASTRA_CLOUDFLARE_CONNECTION_ID', 'c_envcf');
    const fetchMock = vi.fn().mockResolvedValue(envelope([]));
    const tools = createCloudflareTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'cloudflare_list_accounts').execute({}, {} as never);
    expect(fetchMock.mock.calls[0]![0]).toContain('/v2/connections/c_envcf/proxy/');

    vi.stubEnv('MASTRA_CLOUDFLARE_CONNECTION_ID', '');
    const tools2 = createCloudflareTools({ client: { accessToken: TOKEN, baseUrl: 'https://example.test' } });
    await expect(tool(tools2, 'cloudflare_list_accounts').execute({}, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
  });
});
