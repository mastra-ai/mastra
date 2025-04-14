import { spawn } from 'child_process';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll, vi } from 'vitest';
import { MCPConfiguration } from './configuration';

vi.setConfig({ testTimeout: 80000, hookTimeout: 80000 });

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
    const connectedTools = await mcp.getTools();

    // Each tool should be namespaced with its server name
    expect(connectedTools).toHaveProperty('stockPrice_getStockPrice');
    expect(connectedTools).toHaveProperty('weather_getWeather');
  });

  it('should get connected toolsets grouped by server', async () => {
    const connectedToolsets = await mcp.getToolsets();

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

    await expect(badConfig.getTools()).rejects.toThrow();
    await badConfig.disconnect();
  });

  describe('Instance Management', () => {
    it('should allow multiple instances with different IDs', async () => {
      const config2 = new MCPConfiguration({
        id: 'custom-id',
        servers: {
          stockPrice: {
            command: 'npx',
            args: ['-y', 'tsx', path.join(__dirname, '__fixtures__/stock-price.ts')],
            env: {
              FAKE_CREDS: 'test',
            },
          },
        },
      });

      expect(config2).not.toBe(mcp);
      await config2.disconnect();
    });

    it('should allow reuse of configuration after closing', async () => {
      await mcp.disconnect();

      const config2 = new MCPConfiguration({
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

      expect(config2).not.toBe(mcp);
      await config2.disconnect();
    });

    it('should throw error when creating duplicate instance without ID', async () => {
      const existingConfig = new MCPConfiguration({
        servers: {
          stockPrice: {
            command: 'npx',
            args: ['-y', 'tsx', path.join(__dirname, '__fixtures__/stock-price.ts')],
            env: {
              FAKE_CREDS: 'test',
            },
          },
        },
      });

      expect(
        () =>
          new MCPConfiguration({
            servers: {
              stockPrice: {
                command: 'npx',
                args: ['-y', 'tsx', path.join(__dirname, '__fixtures__/stock-price.ts')],
                env: {
                  FAKE_CREDS: 'test',
                },
              },
            },
          }),
      ).toThrow(/MCPConfiguration was initialized multiple times/);

      await existingConfig.disconnect();
    });
  });
  describe('MCPConfiguration Operation Timeouts', () => {
    it('should respect custom timeout in configuration', async () => {
      const config = new MCPConfiguration({
        id: 'test-timeout-config',
        timeout: 3000, // 3 second timeout
        servers: {
          test: {
            command: 'node',
            args: [
              '-e',
              `
            const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
            const server = new Server({ name: 'test', version: '1.0.0' });
            setTimeout(() => process.exit(0), 2000); // 2 second delay
          `,
            ],
          },
        },
      });

      const error = await config.getTools().catch(e => e);
      expect(error).toBeDefined(); // Will throw since server exits before responding
      expect(error.message).not.toMatch(/Request timed out/);

      await config.disconnect();
    });

    it('should respect per-server timeout override', async () => {
      const config = new MCPConfiguration({
        id: 'test-server-timeout-config',
        timeout: 500, // Global timeout of 500ms
        servers: {
          test: {
            command: 'node',
            args: [
              '-e',
              `
            const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
            const server = new Server({ name: 'test', version: '1.0.0' });
            setTimeout(() => process.exit(0), 2000); // 2 second delay
          `,
            ],
            timeout: 3000, // Server-specific timeout of 3s
          },
        },
      });

      // This should succeed since server timeout (3s) is longer than delay (2s)
      const error = await config.getTools().catch(e => e);
      expect(error).toBeDefined(); // Will throw since server exits before responding
      expect(error.message).not.toMatch(/Request timed out/);

      await config.disconnect();
    });
  });

  describe('MCPConfiguration Connection Timeout', () => {
    it('should throw timeout error for slow starting server', async () => {
      const slowConfig = new MCPConfiguration({
        id: 'test-slow-server',
        servers: {
          slowServer: {
            command: 'node',
            args: ['-e', 'setTimeout(() => process.exit(0), 65000)'], // Simulate a server that takes 65 seconds to start
          },
        },
      });

      await expect(slowConfig.getTools()).rejects.toThrow(/Request timed out/);
      await slowConfig.disconnect();
    });

    it('timeout should be longer than default timeout', async () => {
      const slowConfig = new MCPConfiguration({
        id: 'test-slow-server',
        timeout: 70000,
        servers: {
          slowServer: {
            command: 'node',
            args: ['-e', 'setTimeout(() => process.exit(0), 65000)'], // Simulate a server that takes 65 seconds to start
          },
        },
      });

      const error = await slowConfig.getTools().catch(e => e);
      expect(error).toBeDefined();
      expect(error.message).not.toMatch(/Request timed out/);
      await slowConfig.disconnect();
    });

    it('should respect custom timeout configuration', async () => {
      const quickConfig = new MCPConfiguration({
        id: 'test-quick-timeout',
        timeout: 1000, // Very short global timeout
        servers: {
          slowServer: {
            command: 'node',
            args: ['-e', 'setTimeout(() => process.exit(0), 30000)'], // Takes 30 seconds to exit
          },
        },
      });

      await expect(quickConfig.getTools()).rejects.toThrow(/Request timed out/);
      await quickConfig.disconnect();
    });

    it('should respect per-server timeout configuration', async () => {
      const mixedConfig = new MCPConfiguration({
        id: 'test-mixed-timeout',
        timeout: 1000, // Short global timeout
        servers: {
          quickServer: {
            command: 'node',
            args: ['-e', 'setTimeout(() => process.exit(0), 2000)'], // Takes 2 seconds to exit
          },
          slowServer: {
            command: 'node',
            args: ['-e', 'setTimeout(() => process.exit(0), 2000)'], // Takes 2 seconds to exit
            timeout: 3000, // But has a longer timeout
          },
        },
      });

      // Quick server should timeout
      await expect(mixedConfig.getTools()).rejects.toThrow(/Request timed out/);
      await mixedConfig.disconnect();
    });
  });
});
