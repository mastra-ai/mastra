import { generateKeyPairSync } from 'node:crypto';
import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { A2AAgent } from '@mastra/core/a2a';
import { AgentCard as AgentCardV1 } from '@mastra/core/a2a/v1';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { A2AConfig } from '@mastra/core/server';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

describe('A2A discovery over Hono HTTP', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        server =>
          new Promise<void>((resolve, reject) => {
            server.close(error => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          }),
      ),
    );
  });

  async function startServer(a2a?: A2AConfig, prefix = '/api') {
    const agent = (id: string) =>
      new Agent({ id, name: id, instructions: 'Answer questions.', model: 'openai/gpt-4o-mini' });
    const mastra = new Mastra({
      logger: false,
      agents: {
        shared: agent('shared'),
        modern: agent('modern'),
      },
      server: { a2a },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra, prefix }).init();
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    servers.push(server);
    if (!server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
    }
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
    const origin = `http://127.0.0.1:${address.port}`;
    return {
      origin,
      discover: (agentId: string, version?: string) =>
        fetch(`${origin}${prefix}/.well-known/${agentId}/agent-card.json`, {
          headers: version === undefined ? {} : { 'A2A-Version': version },
        }),
    };
  }

  function expectJson(response: Response, status = 200) {
    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(
      response.headers
        .get('vary')
        ?.toLowerCase()
        .split(/\s*,\s*/),
    ).toContain('a2a-version');
  }

  it.each([undefined, '', '   ', '0.3'])(
    'defaults to a legacy card for header %j without configuration',
    async version => {
      const { discover, origin } = await startServer();
      const response = await discover('shared', version);
      expectJson(response);
      const card = await response.json();
      expect(card).toMatchObject({ name: 'shared', protocolVersion: '0.3.0', url: `${origin}/api/a2a/shared` });
      expect(card).not.toHaveProperty('supportedInterfaces');
    },
  );

  it('serves a pure v1 card decodable by the standard SDK without Mastra-specific discovery knowledge', async () => {
    const { discover, origin } = await startServer();
    const response = await discover('shared', '1.0');
    expectJson(response);
    const card = await response.json();
    expect(card.supportedInterfaces).toEqual([
      { url: `${origin}/api/a2a/shared`, protocolBinding: 'JSONRPC', protocolVersion: '0.3' },
      { url: `${origin}/api/a2a/shared`, protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
    ]);
    for (const legacyField of [
      'url',
      'protocolVersion',
      'additionalInterfaces',
      'security',
      'supportsAuthenticatedExtendedCard',
    ]) {
      expect(card).not.toHaveProperty(legacyField);
    }
    expect(card.capabilities).not.toHaveProperty('stateTransitionHistory');
    const decoded = AgentCardV1.fromJSON(card);
    expect(decoded.supportedInterfaces).toHaveLength(2);
    expect(decoded.name).toBe('shared');
    expect(AgentCardV1.toJSON(decoded)).toEqual(card);
  });

  it('supports v1 A2AAgent discovery against the hosted card', async () => {
    const { origin } = await startServer();
    const remote = new A2AAgent({
      url: `${origin}/api/.well-known/modern/agent-card.json`,
      protocolVersion: '1.0',
    });
    await expect(remote.getAgentCard()).resolves.toMatchObject({
      name: 'modern',
      url: `${origin}/api/a2a/modern`,
    });
  });

  it('negotiates both versions for the same agent without leaking the previous response format', async () => {
    const { discover } = await startServer();
    for (const version of ['1.0', '0.3', '1.0']) {
      const response = await discover('shared', version);
      expectJson(response);
      const card = await response.json();
      if (version === '1.0') {
        expect(card.supportedInterfaces.map((item: { protocolVersion: string }) => item.protocolVersion)).toEqual([
          '0.3',
          '1.0',
        ]);
        expect(card).not.toHaveProperty('protocolVersion');
      } else {
        expect(card.protocolVersion).toBe('0.3.0');
        expect(card).not.toHaveProperty('supportedInterfaces');
      }
    }
  });

  it('rejects an unsupported discovery version', async () => {
    const { discover } = await startServer();
    const response = await discover('shared', '2.0');
    expectJson(response, 400);
    expect(await response.json()).toMatchObject({ error: { code: -32009 } });
  });

  it.each(['0.3', '1.0'])('preserves configured signing in the %s HTTP response', async version => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const { discover } = await startServer({
      agentCardSigning: {
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        protectedHeader: { alg: 'ES256', kid: 'discovery-test-key' },
      },
    });
    const response = await discover('shared', version);
    expectJson(response);
    const card = await response.json();
    expect(card.signatures).toHaveLength(1);
    expect(card.signatures[0].signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.parse(Buffer.from(card.signatures[0].protected, 'base64url').toString())).toMatchObject({
      alg: 'ES256',
      kid: 'discovery-test-key',
    });
    if (version === '1.0') {
      expect(AgentCardV1.fromJSON(card).signatures).toHaveLength(1);
      expect(card).not.toHaveProperty('url');
    } else {
      expect(card.protocolVersion).toBe('0.3.0');
    }
  });

  it.each(['0.3', '1.0'])('uses the actual origin and custom route prefix in the %s card', async version => {
    const { discover, origin } = await startServer(undefined, '/custom/v2');
    const response = await discover('shared', version);
    expectJson(response);
    const card = await response.json();
    const expectedUrl = `${origin}/custom/v2/a2a/shared`;
    if (version === '0.3') {
      expect(card.url).toBe(expectedUrl);
    } else {
      expect(card.supportedInterfaces).toEqual([
        { url: expectedUrl, protocolBinding: 'JSONRPC', protocolVersion: '0.3' },
        { url: expectedUrl, protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
      ]);
    }
  });
});
