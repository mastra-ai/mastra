import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MastraJwtAuth } from '@mastra/auth';
import { Mastra } from '@mastra/core/mastra';
import type { ServerConfig, ServerMCPOAuthConfig } from '@mastra/core/server';
import { createTool } from '@mastra/core/tools';
import { MCPClient } from '@mastra/mcp';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import type { JWTPayload } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

export interface BuiltinMCPOAuthTestSuiteConfig {
  suiteName?: string;
  /** Serve the Mastra instance over real HTTP (MCPClient needs a socket) and return its base URL. */
  startServer: (mastra: Mastra) => Promise<{ url: string; close: () => Promise<void> }>;
}

const ISSUER = 'https://issuer.example.com/';
const KID = 'oauth-suite-key';

type Running = { url: string; close: () => Promise<void> };

/** A local signing key served as a real JWKS document over HTTP. */
async function startJwks() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: KID, alg: 'RS256', use: 'sig' };
  const server: Server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    jwksUri: `http://127.0.0.1:${port}/.well-known/jwks.json`,
    sign: (claims: JWTPayload, expiresIn: string | number = '5m') =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: KID })
        .setIssuer(ISSUER)
        .setSubject('user-1')
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(privateKey),
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

const echo = createTool({
  id: 'echo',
  description: 'Echoes its input',
  inputSchema: z.object({ text: z.string() }),
  execute: async ({ text }) => ({ echoed: text }),
});

const MCP_INIT = {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
};

/**
 * OAuth discovery (RFC 9728) and audience enforcement for the built-in `/api/mcp` endpoint, using a real
 * `MastraJwtAuth` verifying RS256 tokens against a local JWKS server.
 */
export function createBuiltinMCPOAuthTestSuite(config: BuiltinMCPOAuthTestSuiteConfig) {
  const { suiteName = 'Built-in MCP OAuth', startServer } = config;

  describe(suiteName, () => {
    let jwks: Awaited<ReturnType<typeof startJwks>>;
    const running: Running[] = [];
    const clients: MCPClient[] = [];

    beforeAll(async () => {
      jwks = await startJwks();
    });

    afterAll(async () => {
      await Promise.all(clients.map(client => client.disconnect()));
      await Promise.all(running.map(server => server.close()));
      await jwks?.close();
      vi.unstubAllEnvs();
    });

    const serve = async (server: ServerConfig) => {
      const mastra = new Mastra({ logger: false, tools: { echo }, server });
      const started = await startServer(mastra);
      running.push(started);
      return { ...started, mastra };
    };

    const serveWithJwt = (oauth?: ServerMCPOAuthConfig) =>
      serve({ auth: new MastraJwtAuth({ jwksUri: jwks.jwksUri, issuer: ISSUER }), mcp: { oauth } });

    const postMCP = (url: string, token?: string) =>
      fetch(`${url}/api/mcp`, {
        ...MCP_INIT,
        headers: { ...MCP_INIT.headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      });

    const listTools = async (url: string, token: string) => {
      const client = new MCPClient({
        id: `oauth-suite-${clients.length}`,
        servers: {
          mastra: { url: new URL(`${url}/api/mcp`), requestInit: { headers: { authorization: `Bearer ${token}` } } },
        },
      });
      clients.push(client);
      return Object.keys(await client.listTools());
    };

    const resourceMetadataUrl = (challenge: string | null) => /resource_metadata="([^"]+)"/.exec(challenge ?? '')?.[1];

    describe('discovery', () => {
      let server: Running;
      beforeAll(async () => {
        server = await serveWithJwt();
      });

      it('answers an unauthenticated MCP request with 401 and a resource_metadata challenge', async () => {
        const response = await postMCP(server.url);
        expect(response.status).toBe(401);
        const challenge = response.headers.get('www-authenticate');
        expect(challenge).toBe(`Bearer resource_metadata="${server.url}/.well-known/oauth-protected-resource/api/mcp"`);

        const metadata = await fetch(resourceMetadataUrl(challenge)!);
        expect(metadata.status).toBe(200);
        expect(metadata.headers.get('content-type')).toContain('application/json');
        expect(metadata.headers.get('cache-control')).toBe('no-store');
        const document = await metadata.json();
        expect(document).toEqual({
          resource: `${server.url}/api/mcp`,
          authorization_servers: [ISSUER],
          bearer_methods_supported: ['header'],
        });

        const root = await fetch(`${server.url}/.well-known/oauth-protected-resource`);
        expect(root.status).toBe(200);
        expect(await root.json()).toEqual(document);
      });

      it('marks presented but invalid tokens with error="invalid_token"', async () => {
        const response = await postMCP(server.url, 'not-a-jwt');
        expect(response.status).toBe(401);
        expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
        expect(resourceMetadataUrl(response.headers.get('www-authenticate'))).toBeDefined();
      });

      it('marks expired tokens with error="invalid_token"', async () => {
        const expired = await jwks.sign({ aud: 'anything' }, Math.floor(Date.now() / 1000) - 60);
        const response = await postMCP(server.url, expired);
        expect(response.status).toBe(401);
        expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
      });

      it('does not enforce the token audience while server.mcp.oauth.resource is unset', async () => {
        const token = await jwks.sign({ aud: 'https://some-other-api.example.com' });
        expect(await listTools(server.url, token)).toContain('mastra_tool_echo');
      });

      it('leaves other routes unchanged', async () => {
        const response = await fetch(`${server.url}/api/tools`);
        expect(response.status).toBe(401);
        expect(response.headers.get('www-authenticate')).toBeNull();
      });
    });

    describe('audience enforcement (server.mcp.oauth.resource)', () => {
      const resource = 'https://mcp.example.com/api/mcp';
      let server: Running;
      beforeAll(async () => {
        server = await serveWithJwt({ resource });
      });

      it('serves MCP to tokens issued for the resource', async () => {
        const token = await jwks.sign({ aud: ['https://other.example.com', resource] });
        expect(await listTools(server.url, token)).toContain('mastra_tool_echo');
      });

      it('rejects tokens issued for another audience with 401 invalid_token', async () => {
        const token = await jwks.sign({ aud: 'https://some-other-api.example.com' });
        const response = await postMCP(server.url, token);
        expect(response.status).toBe(401);
        const challenge = response.headers.get('www-authenticate');
        expect(challenge).toContain('error="invalid_token"');
        // The configured resource is the canonical URL, so discovery points at its origin.
        expect(resourceMetadataUrl(challenge)).toBe(
          'https://mcp.example.com/.well-known/oauth-protected-resource/api/mcp',
        );
      });

      it('does not apply the MCP audience to other routes', async () => {
        const token = await jwks.sign({ aud: 'https://some-other-api.example.com' });
        const response = await fetch(`${server.url}/api/tools`, { headers: { authorization: `Bearer ${token}` } });
        expect(response.status).toBe(200);
      });

      it('advertises the configured resource', async () => {
        const document = (await (
          await fetch(`${server.url}/.well-known/oauth-protected-resource/api/mcp`)
        ).json()) as Record<string, unknown>;
        expect(document.resource).toBe(resource);
      });
    });

    it('prefers configured authorization servers over the provider issuer', async () => {
      const server = await serveWithJwt({
        authorizationServers: ['https://login.example.com'],
        scopesSupported: ['mastra'],
      });
      const document = (await (await fetch(`${server.url}/.well-known/oauth-protected-resource`)).json()) as Record<
        string,
        unknown
      >;
      expect(document.authorization_servers).toEqual(['https://login.example.com']);
      expect(document.scopes_supported).toEqual(['mastra']);
    });

    it('sends no challenge and serves no metadata while the built-in MCP server is disabled', async () => {
      const server = await serve({
        auth: new MastraJwtAuth({ jwksUri: jwks.jwksUri, issuer: ISSUER }),
        mcp: { enabled: false },
      });
      const response = await postMCP(server.url);
      expect(response.headers.get('www-authenticate')).toBeNull();
      expect((await fetch(`${server.url}/.well-known/oauth-protected-resource/api/mcp`)).status).toBe(404);
    });

    it('turns discovery and audience checks off for an invalid resource instead of failing requests', async () => {
      const server = await serveWithJwt({ resource: 'mcp.example.com/api/mcp' });
      const anonymous = await postMCP(server.url);
      expect(anonymous.status).toBe(401);
      expect(anonymous.headers.get('www-authenticate')).toBeNull();
      expect((await fetch(`${server.url}/.well-known/oauth-protected-resource`)).status).toBe(404);
      const tools = await listTools(server.url, await jwks.sign({ aud: 'https://other-api.example.com' }));
      expect(tools).toContain('mastra_tool_echo');
    });

    it('serves no discovery routes without server.auth', async () => {
      vi.stubEnv('MASTRA_DEV', 'true');
      const server = await serve({});
      expect((await fetch(`${server.url}/.well-known/oauth-protected-resource`)).status).toBe(404);
      expect((await fetch(`${server.url}/.well-known/oauth-protected-resource/api/mcp`)).status).toBe(404);
      vi.unstubAllEnvs();
    });
  });
}
