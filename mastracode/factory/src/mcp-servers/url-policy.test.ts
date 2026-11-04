import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { describe, expect, it, onTestFinished } from 'vitest';

import {
  McpServerNetworkPolicyError,
  McpServerUrlError,
  createGuardedFetch,
  isPrivateAddress,
  parseMcpServerUrl,
} from './url-policy.js';

const strict = { allowPrivateNetwork: false };
const local = { allowPrivateNetwork: true };

describe('parseMcpServerUrl', () => {
  it.each([
    ['https://mcp.example.com/mcp', strict],
    ['https://mcp.example.com:8443/v1/mcp?tenant=acme', strict],
    ['https://8.8.8.8/mcp', strict],
    ['http://localhost:4111/mcp', local],
    ['http://127.0.0.1:8080/mcp', local],
    ['http://[::1]:8080/mcp', local],
    ['https://10.0.0.5/mcp', local],
  ])('accepts %s', (raw, options) => {
    expect(parseMcpServerUrl(raw, options).toString()).toBe(new URL(raw).toString());
  });

  it.each([
    ['not a url', strict],
    ['ftp://mcp.example.com/', strict],
    ['http://mcp.example.com/mcp', strict],
    ['http://mcp.example.com/mcp', local],
    ['http://10.0.0.5/mcp', local],
    ['https://user:pass@mcp.example.com/mcp', strict],
    ['https://token@mcp.example.com/mcp', local],
    ['https://mcp.example.com/mcp#section', strict],
    ['http://localhost:4111/mcp', strict],
    ['https://localhost/mcp', strict],
    ['https://tools.localhost/mcp', strict],
    ['https://127.0.0.1/mcp', strict],
    ['https://2130706433/mcp', strict], // 127.0.0.1 in decimal
    ['https://0x7f.1/mcp', strict], // 127.0.0.1 in hex shorthand
    ['https://0.0.0.0/mcp', strict],
    ['https://10.1.2.3/mcp', strict],
    ['https://172.16.0.1/mcp', strict],
    ['https://192.168.1.1/mcp', strict],
    ['https://100.64.0.1/mcp', strict],
    ['https://169.254.169.254/latest/meta-data', strict],
    ['https://[::1]/mcp', strict],
    ['https://[fd00::1]/mcp', strict],
    ['https://[fe80::1]/mcp', strict],
    ['https://[::ffff:127.0.0.1]/mcp', strict],
    ['https://[::ffff:169.254.169.254]/mcp', strict],
  ])('rejects %s', (raw, options) => {
    expect(() => parseMcpServerUrl(raw, options)).toThrow(McpServerUrlError);
  });
});

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.127.0.1', '0.0.0.0'])(
    'treats %s as private',
    address => expect(isPrivateAddress(address)).toBe(true),
  );

  it.each(['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1%en0', '::ffff:10.0.0.1', '::ffff:7f00:1', 'ff02::1'])(
    'treats %s as private',
    address => expect(isPrivateAddress(address)).toBe(true),
  );

  it.each(['8.8.8.8', '1.1.1.1', '100.128.0.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    'treats %s as public',
    address => expect(isPrivateAddress(address)).toBe(false),
  );
});

describe('createGuardedFetch', () => {
  async function startServer() {
    let requests = 0;
    const server = createServer((_req, res) => {
      requests++;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('mcp-ok');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    onTestFinished(() => new Promise<void>(resolve => server.close(() => resolve())));
    const { port } = server.address() as AddressInfo;
    return { port, requests: () => requests };
  }

  it('refuses requests to loopback servers before they are sent when private networks are not allowed', async () => {
    const server = await startServer();
    const guarded = createGuardedFetch(strict);

    await expect(guarded(`https://127.0.0.1:${server.port}/mcp`)).rejects.toBeInstanceOf(McpServerNetworkPolicyError);
    // `localhost` is resolved first, so a hostname cannot smuggle a private address past the guard.
    await expect(guarded(`https://localhost:${server.port}/mcp`)).rejects.toThrow(/private network address/);
    await expect(guarded(`http://127.0.0.1:${server.port}/mcp`)).rejects.toThrow(/do not use https/);
    expect(server.requests()).toBe(0);
  });

  it('reaches loopback servers when private networks are allowed', async () => {
    const server = await startServer();
    const response = await createGuardedFetch(local)(`http://127.0.0.1:${server.port}/mcp`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('mcp-ok');
    expect(server.requests()).toBe(1);
  });
});
