import { spawn } from 'child_process';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll } from 'vitest';
import { MCPConfiguration } from './configuration';

describe('MCPConfiguration', () => {
  let mcp: MCPConfiguration;
  let weatherProcess: ReturnType<typeof spawn>;

  beforeAll(async () => {
    // Start the weather SSE server
    weatherProcess = spawn('npx', ['-y', 'tsx', path.join(__dirname, '__fixtures__/weather.ts')]);

    // Wait for SSE server to be ready
    let resolved = false;
    await new Promise<void>((resolve, reject) => {
      weatherProcess.on(`exit`, () => {
        if (!resolved) reject();
      });
      if (weatherProcess.stderr) {
        weatherProcess.stderr.on(`data`, chunk => {
          console.error(chunk.toString());
        });
      }
      if (weatherProcess.stdout) {
        weatherProcess.stdout.on('data', chunk => {
          if (chunk.toString().includes('server is running on SSE')) {
            resolve();
            resolved = true;
          }
        });
      }
    });
  });

  beforeEach(async () => {
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
          url: new URL('http://localhost:60808/sse'),
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up any connected clients
    await mcp.disconnect();
  });

  afterAll(async () => {
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
        url: new URL('http://localhost:60808/sse'),
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
    await badConfig.disconnect();
  });

