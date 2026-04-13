import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { existsSync } from 'fs';
import { execa } from 'execa';
import { execSync } from 'child_process';

describe('create mastra', () => {
  let fixturePath: string;
  let projectPath: string;

  beforeAll(
    async () => {
      const tag = inject('tag');
      const registry = inject('registry');

      console.log('registry', registry);
      console.log('tag', tag);

      fixturePath = await mkdtemp(join(tmpdir(), 'mastra-create-test-'));
      projectPath = join(fixturePath, 'project');
      execSync(
        `pnpm --config.trust-policy=off --config.block-exotic-subdeps=false dlx create-mastra@${tag} -c agents,tools,workflows,scorers -l openai -e project`,
        {
          cwd: fixturePath,
          stdio: ['inherit', 'inherit', 'inherit'],
          env: {
            ...process.env,
            npm_config_registry: registry,
          },
        },
      );
    },
    10 * 60 * 1000,
  );

  afterAll(async () => {
    try {
      await rm(fixturePath, {
        force: true,
      });
    } catch {}
  });

  it('folder should exist', async () => {
    expect(existsSync(join(projectPath, 'src', 'mastra', 'index.ts'))).toBe(true);
  });

  describe('dev', () => {
    let port: number;
    let proc: ReturnType<typeof execa> | undefined;
    beforeAll(
      async () => {
        port = await getPort();
        proc = execa('pnpm', ['dev'], {
          cwd: projectPath,
          env: {
            PORT: port.toString(),
          },
        });

        await new Promise<void>((resolve, reject) => {
          console.log('waiting for server to start');

          const timeout = setTimeout(() => {
            reject(new Error('Dev server did not start in time'));
          }, 30000); // 30s safety

          proc!.stderr?.on('data', data => {
            const output = data?.toString() ?? '';
            console.error(output);

            const errorPatterns = ['error', 'err', 'failed', 'enoent', 'module_not_found'];
            if (errorPatterns.some(pattern => output.toLowerCase().includes(pattern))) {
              clearTimeout(timeout);
              reject(new Error('failed to start dev: ' + output));
            }
          });

          proc!.stdout?.on('data', data => {
            const output = data?.toString() ?? '';
            console.log(output);

            if (output.includes(`http://localhost:${port}`)) {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      },
      60 * 10 * 1000,
    );

    afterAll(async () => {
      if (proc) {
        proc.kill('SIGTERM');
      }
    });

    it(
      'should open studio',
      {
        timeout: 60 * 1000,
      },
      async () => {
        const response = await fetch(`http://localhost:${port}`);
        expect(response.status).toBe(200);
      },
    );

    it(
      'should fetch agents',
      {
        timeout: 60 * 1000,
      },
      async () => {
        const response = await fetch(`http://localhost:${port}/api/agents`);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchInlineSnapshot(`
          {
            "weather-agent": {
              "agents": {},
              "browserTools": [],
              "defaultGenerateOptionsLegacy": {},
              "defaultOptions": {},
              "defaultStreamOptionsLegacy": {},
              "description": "",
              "hasDraft": false,
              "id": "weather-agent",
              "inputProcessors": [],
              "instructions": "
                You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.

                Your primary function is to help users get weather details for specific locations. When responding:
                - Always ask for a location if none is provided
                - If the location name isn't in English, please translate it
                - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
                - Include relevant details like humidity, wind conditions, and precipitation
                - Keep responses concise but informative
                - If the user asks for activities and provides the weather forecast, suggest activities based on the weather forecast.
                - If the user asks for activities, respond in the format they request.

                Use the weatherTool to fetch current weather data.
          ",
              "modelId": "gpt-5-mini",
              "modelVersion": "v2",
              "name": "Weather Agent",
              "outputProcessors": [],
              "provider": "openai",
              "skills": [],
              "source": "code",
              "tools": {
                "weatherTool": {
                  "description": "Get current weather for a location",
                  "id": "get-weather",
                  "inputSchema": "{"json":{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"location":{"type":"string","description":"City name"}},"required":["location"],"additionalProperties":false}}",
                  "outputSchema": "{"json":{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"temperature":{"type":"number"},"feelsLike":{"type":"number"},"humidity":{"type":"number"},"windSpeed":{"type":"number"},"windGust":{"type":"number"},"conditions":{"type":"string"},"location":{"type":"string"}},"required":["temperature","feelsLike","humidity","windSpeed","windGust","conditions","location"],"additionalProperties":false}}",
                  "requireApproval": false,
                },
              },
              "workflows": {},
              "workspaceTools": [],
            },
          }
        `);
      },
    );
  });
});
