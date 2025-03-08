import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { MCPConfiguration } from './configuration';
import path from 'path';

describe('MCPConfiguration', () => {
  let mcp: MCPConfiguration;
  let weatherProcess: ReturnType<typeof spawn>;

  beforeEach(async () => {
    // Start the weather SSE server
    weatherProcess = spawn('npx', ['-y', 'tsx', path.join(__dirname, '__fixtures__/weather.ts')]);
    
    // Wait for SSE server to be ready
    await new Promise<void>((resolve) => {
      if (weatherProcess.stdout) {
        weatherProcess.stdout.on('data', (chunk) => {
          if (chunk.toString().includes('server is running on SSE')) {
            resolve();
          }
        });
      }
    });

    mcp = new MCPConfiguration({
      servers: {
        stockPrice: {
          command: 'npx',
          args: ['-y', 'tsx', path.join(__dirname, '__fixtures__/stock-price.ts')],
          env: {
            FAKE_CREDS: 'test',
          },
        },
        weather: {
          url: new URL('http://localhost:8080/sse'),
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up any connected clients
    const toolsets = await mcp.getConnectedToolsets();
    for (const serverName of Object.keys(toolsets)) {
      const client = mcp['mcpClientsById'].get(serverName);
      if (client) {
        await client.disconnect();
      }
    }

    // Kill the weather SSE server
    weatherProcess.kill('SIGINT');
  });

  it('should initialize with server configurations', () => {
    expect(mcp['serverConfigs']).toEqual({
      stockPrice: {
        command: 'npx',
        args: ['-y', 'tsx', path.join(__dirname, '__fixtures__/stock-price.ts')],
        env: {
          FAKE_CREDS: 'test',
        },
      },
      weather: {
        url: new URL('http://localhost:8080/sse'),
      },
    });
  });

  it('should get connected tools with namespaced tool names', async () => {
    const connectedTools = await mcp.getConnectedTools();
    
    // Each tool should be namespaced with its server name
    expect(connectedTools).toHaveProperty('stockPrice_getStockPrice');
    expect(connectedTools).toHaveProperty('weather_getWeather');
  });

  it('should get connected toolsets grouped by server', async () => {
    const connectedToolsets = await mcp.getConnectedToolsets();
    
    expect(connectedToolsets).toHaveProperty('stockPrice');
    expect(connectedToolsets).toHaveProperty('weather');
    expect(connectedToolsets.stockPrice).toHaveProperty('getStockPrice');
    expect(connectedToolsets.weather).toHaveProperty('getWeather');
  });

  it('should handle connection errors gracefully', async () => {
    const badConfig = new MCPConfiguration({
      servers: {
        badServer: {
          command: 'nonexistent-command',
          args: [],
        },
      },
    });

    await expect(badConfig.getConnectedTools()).rejects.toThrow();
  });
}); 