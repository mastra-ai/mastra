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
    const capabilities = (internalClient as any).client._options?.capabilities;

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(capabilities).toMatchObject(customCapabilities);
  });
});
