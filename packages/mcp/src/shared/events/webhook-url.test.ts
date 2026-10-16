import { describe, expect, it, vi } from 'vitest';
import type { WebhookLookup, WebhookUrlFailure } from './webhook-url';
import { WebhookUrlError, isGloballyRoutableAddress, resolveAndValidate, validateWebhookUrl } from './webhook-url';

function expectUrlError(fn: () => unknown, reason: WebhookUrlFailure): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(WebhookUrlError);
  expect((caught as WebhookUrlError).reason).toBe(reason);
}

async function expectRejectsWith(promise: Promise<unknown>, reason: WebhookUrlFailure): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(WebhookUrlError);
  expect((error as WebhookUrlError).reason).toBe(reason);
}

function recordingLookup(answers: Awaited<ReturnType<WebhookLookup>>) {
  return vi.fn<WebhookLookup>(async () => answers);
}

describe('isGloballyRoutableAddress', () => {
  it.each([
    ['0.0.0.0', 'this network'],
    ['0.255.1.2', 'this network'],
    ['10.0.0.1', 'private'],
    ['100.64.0.1', 'CGNAT'],
    ['100.127.255.254', 'CGNAT'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.255', 'loopback'],
    ['169.254.169.254', 'link-local / cloud metadata'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private'],
    ['192.0.0.8', 'IETF protocol assignments'],
    ['192.0.2.1', 'TEST-NET-1'],
    ['192.88.99.1', '6to4 relay anycast'],
    ['192.168.1.1', 'private'],
    ['198.18.0.1', 'benchmarking'],
    ['198.19.255.255', 'benchmarking'],
    ['198.51.100.1', 'TEST-NET-2'],
    ['203.0.113.1', 'TEST-NET-3'],
    ['224.0.0.1', 'multicast'],
    ['239.255.255.255', 'multicast'],
    ['240.0.0.1', 'reserved'],
    ['255.255.255.255', 'broadcast'],
    ['::', 'unspecified'],
    ['::1', 'loopback'],
    ['::7f00:1', 'IPv4-compatible'],
    ['fe80::1', 'link-local'],
    ['fc00::1', 'ULA'],
    ['fd12::1', 'ULA'],
    ['fec0::1', 'site-local'],
    ['ff02::1', 'multicast'],
    ['2001:db8::1', 'documentation'],
    ['2001::1', 'Teredo / IETF protocol assignments'],
    ['3fff::1', 'documentation'],
    ['100::1', 'discard-only'],
    ['64:ff9b:1::1', 'local-use NAT64'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:7f00:1', 'IPv4-mapped loopback (hex)'],
    ['::ffff:8.8.8.8', 'IPv4-mapped public (rejected outright)'],
    ['64:ff9b::a00:1', 'NAT64 to 10.0.0.1'],
    ['64:ff9b::127.0.0.1', 'NAT64 to 127.0.0.1 (dotted tail)'],
    ['2002:c0a8:0101::', '6to4 to 192.168.1.1'],
    ['2002:7f00:1::1', '6to4 to 127.0.0.1'],
    ['[::1]', 'bracketed loopback'],
    ['fe80::1%en0', 'scoped link-local'],
    ['localhost', 'not an IP'],
    ['', 'empty'],
    ['999.1.1.1', 'invalid IPv4'],
  ])('blocks %s (%s)', ip => {
    expect(isGloballyRoutableAddress(ip)).toBe(false);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['100.63.255.255'],
    ['100.128.0.1'],
    ['172.15.255.255'],
    ['172.32.0.1'],
    ['198.17.255.255'],
    ['198.20.0.1'],
    ['223.255.255.255'],
    ['2606:4700:4700::1111'],
    ['2a00:1450:4001:80b::200e'],
    ['64:ff9b::808:808'],
    ['2002:808:808::1'],
    ['[2606:4700:4700::1111]'],
  ])('allows global %s', ip => {
    expect(isGloballyRoutableAddress(ip)).toBe(true);
  });
});

describe('validateWebhookUrl', () => {
  it('accepts a public https URL', () => {
    expect(validateWebhookUrl('https://hooks.example.com/mcp?x=1').href).toBe('https://hooks.example.com/mcp?x=1');
  });

  it('rejects http as insecure_scheme', () => {
    expectUrlError(() => validateWebhookUrl('http://hooks.example.com/mcp'), 'insecure_scheme');
  });

  it.each(['not a url', '', 'ftp://example.com/x', 'https://user:pw@example.com/h', 'https://user@example.com/h'])(
    'rejects %j as invalid_url',
    url => {
      expectUrlError(() => validateWebhookUrl(url), 'invalid_url');
    },
  );

  it.each([
    'https://127.0.0.1/h',
    'https://[::1]/h',
    'https://0x7f.1/h',
    'https://2130706433/h',
    'https://017700000001/h',
    'https://169.254.169.254/latest/meta-data',
    'https://[::ffff:127.0.0.1]/h',
    'https://[64:ff9b::10.0.0.1]/h',
  ])('rejects non-global IP literal %s', url => {
    expectUrlError(() => validateWebhookUrl(url), 'disallowed_address');
  });

  it('allows http with allowInsecure', () => {
    expect(validateWebhookUrl('http://hooks.example.com/h', { allowInsecure: true }).protocol).toBe('http:');
  });

  it('allows a loopback literal with allowPrivate', () => {
    expect(validateWebhookUrl('https://127.0.0.1:8443/h', { allowPrivate: true }).host).toBe('127.0.0.1:8443');
  });

  it('allows a local http receiver with both overrides', () => {
    expect(validateWebhookUrl('http://[::1]:3000/h', { allowInsecure: true, allowPrivate: true }).hostname).toBe(
      '[::1]',
    );
  });
});

describe('resolveAndValidate', () => {
  it('returns the pinned address from a public answer', async () => {
    const lookup = recordingLookup([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);
    const resolved = await resolveAndValidate('https://hooks.example.com/mcp', { lookup });
    expect(lookup).toHaveBeenCalledExactlyOnceWith('hooks.example.com');
    expect(resolved.address).toBe('93.184.216.34');
    expect(resolved.family).toBe(4);
    expect(resolved.url.hostname).toBe('hooks.example.com');
  });

  it('rejects a private answer', async () => {
    const lookup = recordingLookup([{ address: '10.0.0.5', family: 4 }]);
    await expectRejectsWith(resolveAndValidate('https://internal.example.com/h', { lookup }), 'disallowed_address');
  });

  it('rejects a mixed public and private answer', async () => {
    const lookup = recordingLookup([
      { address: '93.184.216.34', family: 4 },
      { address: '::1', family: 6 },
    ]);
    await expectRejectsWith(resolveAndValidate('https://rebind.example.com/h', { lookup }), 'disallowed_address');
  });

  it('reports an empty answer as dns_failure', async () => {
    const lookup = recordingLookup([]);
    await expectRejectsWith(resolveAndValidate('https://empty.example.com/h', { lookup }), 'dns_failure');
  });

  it('reports a resolver error as dns_failure', async () => {
    const lookup = vi.fn<WebhookLookup>(async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
    });
    await expectRejectsWith(resolveAndValidate('https://missing.example.com/h', { lookup }), 'dns_failure');
  });

  it('does not resolve IP literals', async () => {
    const lookup = recordingLookup([{ address: '10.0.0.1', family: 4 }]);
    await expect(resolveAndValidate('https://8.8.8.8/h', { lookup })).resolves.toMatchObject({
      address: '8.8.8.8',
      family: 4,
    });
    await expect(resolveAndValidate('https://[2606:4700:4700::1111]/h', { lookup })).resolves.toMatchObject({
      address: '2606:4700:4700::1111',
      family: 6,
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects before resolving when the scheme is insecure', async () => {
    const lookup = recordingLookup([{ address: '93.184.216.34', family: 4 }]);
    await expectRejectsWith(resolveAndValidate('http://hooks.example.com/h', { lookup }), 'insecure_scheme');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('returns a private pinned address with allowPrivate', async () => {
    const lookup = recordingLookup([{ address: '192.168.1.20', family: 4 }]);
    await expect(
      resolveAndValidate('https://receiver.internal/h', { lookup, allowPrivate: true }),
    ).resolves.toMatchObject({ address: '192.168.1.20', family: 4 });
  });

  it('rejects localhost with the default resolver', async () => {
    await expectRejectsWith(resolveAndValidate('https://localhost/h'), 'disallowed_address');
  });
});
