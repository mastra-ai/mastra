import { it, describe, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { setupRegistry, runCreateMastra } from './setup';
import { copyFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { existsSync, fstat } from 'fs';
import { chdir } from 'process';
import { execa } from 'execa';

describe('create mastra', () => {
  let fixturePath: string;
  let cleanup: () => void;

  beforeAll(
    async () => {
      const port = await getPort();
      fixturePath = await mkdtemp(join(tmpdir(), 'mastra-create-test-'));
      await copyFile('./verdaccio.yaml', join(fixturePath, 'verdaccio.yaml'));
      cleanup = await setupRegistry(fixturePath, port);

      process.env.npm_config_registry = `http://localhost:${port}/`;
      await runCreateMastra(fixturePath, 'pnpm', port);
      chdir(join(fixturePath, 'project'));
    },
    15 * 60 * 1000,
  );

  afterAll(async () => {
    try {
      cleanup();
      await rm(fixturePath, {
        force: true,
      });
    } catch {}
  });

  it('folder should exist', async () => {
    expect(existsSync(join(fixturePath, 'project', 'src', 'mastra', 'index.ts'))).toBe(true);
  });

  describe('dev', () => {
    let port: number;
    let proc: ReturnType<typeof execa> | undefined;
    beforeAll(async () => {
      port = await getPort();
      proc = execa('pnpm', ['dev', '--port', port.toString()], {
        cwd: join(fixturePath, 'project'),
      });

      await new Promise<void>(resolve => {
        console.log('waiting for server to start');
        proc!.stdout?.on('data', data => {
          if (data?.toString()?.includes(`http://localhost:${port}`)) {
            resolve();
          }
        });
      });
    });

    afterAll(async () => {
      if (proc) {
        proc.kill();
      }
    });

    it(
      'should open playground',
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
            "weatherAgent": {
              "instructions": "
                You are a helpful weather assistant that provides accurate weather information.

                Your primary function is to help users get weather details for specific locations. When responding:
                - Always ask for a location if none is provided
                - If the location name isn’t in English, please translate it
                - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
                - Include relevant details like humidity, wind conditions, and precipitation
                - Keep responses concise but informative

                Use the weatherTool to fetch current weather data.
          ",
              "modelId": "gpt-4o",
              "name": "Weather Agent",
              "provider": "openai.chat",
              "tools": {
                "weatherTool": {
                  "description": "Get current weather for a location",
                  "id": "get-weather",
                  "inputSchema": "{"json":{"type":"object","properties":{"location":{"type":"string","description":"City name"}},"required":["location"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}",
                  "outputSchema": "{"json":{"type":"object","properties":{"temperature":{"type":"number"},"feelsLike":{"type":"number"},"humidity":{"type":"number"},"windSpeed":{"type":"number"},"windGust":{"type":"number"},"conditions":{"type":"string"},"location":{"type":"string"}},"required":["temperature","feelsLike","humidity","windSpeed","windGust","conditions","location"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}",
                },
              },
            },
          }
        `);
      },
    );
  });
});
