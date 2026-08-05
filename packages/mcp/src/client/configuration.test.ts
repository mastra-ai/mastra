import { afterEach, describe, expect, it, vi } from 'vitest';
import { InternalMastraMCPClient } from './client';
import { MCPClient } from './configuration';

let clientId = 0;

describe('MCPClient tool discovery retries', () => {
  const clients: MCPClient[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(clients.map(client => client.disconnect().catch(() => {})));
    clients.length = 0;
  });

  function createClient() {
    const client = new MCPClient({
      id: `configuration-test-${++clientId}`,
      servers: {
        weather: {
          url: new URL('http://localhost:1234/sse'),
        },
      },
    });

    clients.push(client);
    return client;
  }

  function createMultiServerClient() {
    const client = new MCPClient({
      id: `configuration-test-${++clientId}`,
      servers: {
        weather: {
          url: new URL('http://localhost:1234/sse'),
        },
        stock: {
          url: new URL('http://localhost:5678/sse'),
        },
      },
    });

    clients.push(client);
    return client;
  }

  it('returns namespaced tools and empty errors from listToolsWithErrors on successful discovery', async () => {
    const client = createClient();
    const toolset = { getWeather: {} as any };
    const internalClient = {
      tools: vi.fn().mockResolvedValue(toolset),
    } as any;

    vi.spyOn(client as any, 'getConnectedClientForServer').mockResolvedValue(internalClient);

    const result = await client.listToolsWithErrors();

    expect(result).toEqual({
      tools: {
        weather_getWeather: toolset.getWeather,
      },
      errors: {},
    });
    expect(internalClient.tools).toHaveBeenCalledTimes(1);
  });

  it('returns successful tools and server errors from listToolsWithErrors on partial failure', async () => {
    const client = createMultiServerClient();
    const weatherTools = { getWeather: {} as any };
    const weatherClient = {
      tools: vi.fn().mockResolvedValue(weatherTools),
    } as any;
    const stockClient = {
      tools: vi.fn().mockRejectedValue(new Error('Validation failed')),
    } as any;

    vi.spyOn(client as any, 'getConnectedClientForServer').mockImplementation(async (serverName: string) => {
      return serverName === 'weather' ? weatherClient : stockClient;
    });

    const result = await client.listToolsWithErrors();

    expect(result).toEqual({
      tools: {
        weather_getWeather: weatherTools.getWeather,
      },
      errors: {
        stock: 'Validation failed',
      },
    });
    expect(weatherClient.tools).toHaveBeenCalledTimes(1);
    expect(stockClient.tools).toHaveBeenCalledTimes(1);
  });

  it('retries listToolsWithErrors once after a reconnectable discovery failure', async () => {
    const client = createClient();
    const toolset = { getWeather: {} as any };
    const internalClient = {
      tools: vi.fn().mockRejectedValueOnce(new Error('Connection closed')).mockResolvedValueOnce(toolset),
    } as any;

    vi.spyOn(client as any, 'getConnectedClientForServer').mockResolvedValue(internalClient);
    const reconnectSpy = vi.spyOn(client, 'reconnectServer').mockResolvedValue();

    const result = await client.listToolsWithErrors();

    expect(result).toEqual({
      tools: {
        weather_getWeather: toolset.getWeather,
      },
      errors: {},
    });
    expect(internalClient.tools).toHaveBeenCalledTimes(2);
    expect(reconnectSpy).toHaveBeenCalledTimes(1);
    expect(reconnectSpy).toHaveBeenCalledWith('weather');
  });

  it('keeps duplicate tool names uniquely namespaced in listToolsWithErrors', async () => {
    const client = createMultiServerClient();
    const weatherTools = { search: {} as any };
    const stockTools = { search: {} as any };
    const weatherClient = {
      tools: vi.fn().mockResolvedValue(weatherTools),
    } as any;
    const stockClient = {
      tools: vi.fn().mockResolvedValue(stockTools),
    } as any;

    vi.spyOn(client as any, 'getConnectedClientForServer').mockImplementation(async (serverName: string) => {
      return serverName === 'weather' ? weatherClient : stockClient;
    });

    const result = await client.listToolsWithErrors();

    expect(result).toEqual({
      tools: {
        weather_search: weatherTools.search,
        stock_search: stockTools.search,
      },
      errors: {},
    });
  });

  it('retries listToolsetsWithErrors once after a reconnectable discovery failure', async () => {
    const client = createClient();
    const toolset = { getWeather: {} as any };
    const internalClient = {
      tools: vi.fn().mockRejectedValueOnce(new Error('Connection closed')).mockResolvedValueOnce(toolset),
    } as any;

    vi.spyOn(client as any, 'getConnectedClientForServer').mockResolvedValue(internalClient);
    const reconnectSpy = vi.spyOn(client, 'reconnectServer').mockResolvedValue();

    const result = await client.listToolsetsWithErrors();

    expect(result).toEqual({
      toolsets: {
        weather: toolset,
      },
      errors: {},
    });
    expect(internalClient.tools).toHaveBeenCalledTimes(2);
    expect(reconnectSpy).toHaveBeenCalledTimes(1);
    expect(reconnectSpy).toHaveBeenCalledWith('weather');
  });

  it('does not retry listToolsetsWithErrors for non-reconnectable discovery failures', async () => {
    const client = createClient();
    const internalClient = {
      tools: vi.fn().mockRejectedValue(new Error('Validation failed')),
    } as any;

    vi.spyOn(client as any, 'getConnectedClientForServer').mockResolvedValue(internalClient);
    const reconnectSpy = vi.spyOn(client, 'reconnectServer').mockResolvedValue();

    const result = await client.listToolsetsWithErrors();

    expect(result).toEqual({
      toolsets: {},
      errors: {
        weather: 'Validation failed',
      },
    });
    expect(internalClient.tools).toHaveBeenCalledTimes(1);
    expect(reconnectSpy).not.toHaveBeenCalled();
  });

  it('retries listTools once and preserves namespaced tool names', async () => {
    const client = createClient();
    const toolset = { getWeather: {} as any };
    const internalClient = {
      tools: vi.fn().mockRejectedValueOnce(new Error('Not connected')).mockResolvedValueOnce(toolset),
    } as any;

    vi.spyOn(client as any, 'getConnectedClientForServer').mockResolvedValue(internalClient);
    const reconnectSpy = vi.spyOn(client, 'reconnectServer').mockResolvedValue();

    const tools = await client.listTools();

    expect(tools).toEqual({
      weather_getWeather: toolset.getWeather,
    });
    expect(internalClient.tools).toHaveBeenCalledTimes(2);
    expect(reconnectSpy).toHaveBeenCalledTimes(1);
    expect(reconnectSpy).toHaveBeenCalledWith('weather');
  });

  it('forwards per-server capabilities into InternalMastraMCPClient', async () => {
    const customCapabilities = {
      elicitation: {
        supportedContentTypes: ['text/uri-list', 'application/vnd.mastra.form+json'],
      },
    } as any;

    const connectSpy = vi.spyOn(InternalMastraMCPClient.prototype, 'connect').mockResolvedValue(true);

    const client = new MCPClient({
      id: `configuration-test-${++clientId}`,
      servers: {
        weather: {
          url: new URL('http://localhost:1234/sse'),
          capabilities: customCapabilities,
        },
      },
    });

    clients.push(client);

    const internalClient = await (client as any).getConnectedClientForServer('weather');
    const capabilities = (internalClient as any).client._capabilities;

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(capabilities).toMatchObject(customCapabilities);
  });

  it('registers elicitation handlers before connecting the server', async () => {
    const connectSpy = vi.spyOn(InternalMastraMCPClient.prototype, 'connect').mockResolvedValue(true);

    const client = new MCPClient({
      id: `configuration-test-${++clientId}`,
      servers: {
        weather: {
          url: new URL('http://localhost:1234/sse'),
        },
      },
    });

    clients.push(client);

    await client.elicitation.onRequest('weather', async () => ({ action: 'decline' }));

    const internalClient = (client as any).mcpClientsById.get('weather');
    const capabilities = internalClient.client._capabilities;

    expect(connectSpy).not.toHaveBeenCalled();
    expect(capabilities.elicitation).toMatchObject({ form: {} });
  });

  it('returns cached server instructions for configured servers', async () => {
    vi.spyOn(InternalMastraMCPClient.prototype, 'connect').mockImplementation(async function (this: any) {
      this.serverInstructions = this.name === 'db' ? 'Validate schema before migrating.' : undefined;
      return true;
    });

    const client = new MCPClient({
      id: `configuration-test-${++clientId}`,
      servers: {
        db: {
          url: new URL('http://localhost:1234/sse'),
        },
        empty: {
          url: new URL('http://localhost:5678/sse'),
        },
      },
    });

    clients.push(client);

    await (client as any).getConnectedClientForServer('db');

    expect(client.getServerInstructions()).toEqual({
      db: 'Validate schema before migrating.',
      empty: undefined,
    });
  });

  const makeThreeServerClient = () => {
    const client = new MCPClient({
      id: `configuration-test-${++clientId}`,
      servers: {
        alpha: { url: new URL('http://localhost:1111/sse') },
        bravo: { url: new URL('http://localhost:2222/sse') },
        charlie: { url: new URL('http://localhost:3333/sse') },
      },
    });
    clients.push(client);
    return client;
  };

  // Spies getConnectedClientForServer so each server's discovery call awaits
  // `gate(serverName)` before returning a probe result. `gate` is where each
  // test injects its timing — a per-server delay, or a concurrency latch.
  type Gate = (serverName: string) => Promise<void>;
  const installToolsMock = (client: MCPClient, gate: Gate) =>
    vi.spyOn(client as any, 'getConnectedClientForServer').mockImplementation(async (serverName: string) => ({
      tools: vi.fn().mockImplementation(async () => {
        await gate(serverName);
        return { probe: {} as any };
      }),
    }));
  const installResourcesMock = (client: MCPClient, gate: Gate) =>
    vi.spyOn(client as any, 'getConnectedClientForServer').mockImplementation(async (serverName: string) => ({
      resources: {
        list: vi.fn().mockImplementation(async () => {
          await gate(serverName);
          return [{ uri: `${serverName}://probe` } as any];
        }),
      },
    }));

  // Servers resolve in reverse configuration order; asserts the folded result
  // still keys in configuration order (a completion-order fold would not).
  const expectConfigOrder = async (
    installMock: (client: MCPClient, gate: Gate) => void,
    invoke: (client: MCPClient) => Promise<Record<string, unknown>>,
    expectedKeys: string[],
  ) => {
    const client = makeThreeServerClient();
    const delays: Record<string, number> = { alpha: 30, bravo: 15, charlie: 0 };
    installMock(client, serverName => new Promise(resolve => setTimeout(resolve, delays[serverName])));
    expect(Object.keys(await invoke(client))).toEqual(expectedKeys);
  };

  // Asserts every server's discovery is in flight at once; deadlocks against a
  // serial implementation, where only the first server would ever start.
  const expectConcurrentDiscovery = async (
    installMock: (client: MCPClient, gate: Gate) => void,
    invoke: (client: MCPClient) => Promise<unknown>,
  ) => {
    const client = makeThreeServerClient();
    const serverCount = 3;
    let inFlight = 0;
    let maxInFlight = 0;
    const release: Array<() => void> = [];
    const allStarted = new Promise<void>(resolveAllStarted => {
      installMock(client, async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        if (inFlight === serverCount) resolveAllStarted();
        await new Promise<void>(resolve => release.push(resolve));
        inFlight--;
      });
    });

    const pending = invoke(client);
    await allStarted;
    expect(maxInFlight).toBe(serverCount);
    release.forEach(fn => fn());
    await pending;
  };

  it('preserves configuration order in listToolsWithErrors even when servers resolve out of order', () =>
    expectConfigOrder(installToolsMock, async client => (await client.listToolsWithErrors()).tools, [
      'alpha_probe',
      'bravo_probe',
      'charlie_probe',
    ]));

  it('discovers tools from all servers concurrently rather than serially', () =>
    expectConcurrentDiscovery(installToolsMock, client => client.listToolsWithErrors()));

  // resources.list() shares the concurrent settle/fold path but is an
  // independent code path from tool discovery, so cover it directly too.
  it('preserves configuration order in resources.list even when servers resolve out of order', () =>
    expectConfigOrder(installResourcesMock, client => client.resources.list(), ['alpha', 'bravo', 'charlie']));

  it('lists resources from all servers concurrently rather than serially', () =>
    expectConcurrentDiscovery(installResourcesMock, client => client.resources.list()));
});
