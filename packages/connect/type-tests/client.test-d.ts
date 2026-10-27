import {
  MastraConnectError,
  getConnectionContext,
  listProjectConnections,
  proxyRequest,
  proxyRequestWithResponse,
  resolveClient,
} from '../src/index.js';
import type {
  ConnectClientOptions,
  ConnectionContext,
  ProjectConnection,
  ProxyRequestOptions,
  ProxyResponse,
  ResolvedClient,
} from '../src/index.js';

const options: ConnectClientOptions = { accessToken: 'token', orgId: 'org_1', projectId: 'proj_1' };
const client: ResolvedClient = resolveClient(options);

async function consumer() {
  const connections: ProjectConnection[] = await listProjectConnections(client, 'proj_1');
  const first = connections[0];
  if (!first) return;

  const context: ConnectionContext = await getConnectionContext(client, first.id);
  const config: Record<string, unknown> | null = context.connection_config;
  void config;

  const request: ProxyRequestOptions = { method: 'GET', path: 'v1/items', query: { cursor: 'abc', limit: 50 } };
  const data: unknown = await proxyRequest(client, first.id, request);
  void data;

  const response: ProxyResponse = await proxyRequestWithResponse(client, first.id, request);
  const status: number = response.status;
  const headers: Record<string, string> = response.headers;
  void status;
  void headers;

  try {
    await proxyRequestWithResponse(client, first.id, { method: 'GET', path: 'v1/items/1' });
  } catch (error) {
    if (error instanceof MastraConnectError && error.code === 'proxy_error') {
      const providerStatus: number | undefined = error.status;
      void providerStatus;
    }
  }
}
void consumer;

// @ts-expect-error — the proxy only accepts HTTP methods it forwards.
const badMethod: ProxyRequestOptions = { method: 'CONNECT', path: 'v1/items' };
void badMethod;

// @ts-expect-error — a connection id is required.
void proxyRequest(client, { method: 'GET', path: 'v1/items' });
