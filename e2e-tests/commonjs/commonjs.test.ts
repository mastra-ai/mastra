import { it, describe, expect, beforeAll, afterAll } from 'vitest';
import { rollup } from 'rollup';
import { join } from 'path';
import { setupTestProject } from './setup';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { execa, ExecaError } from 'execa';

describe('commonjs', () => {
  let fixturePath: string;

  beforeAll(async () => {
    fixturePath = await mkdtemp(join(tmpdir(), 'mastra-commonjs-test-'));
    await setupTestProject(fixturePath);
  }, 60 * 1000);

  afterAll(async () => {
    try {
      await rm(fixturePath, {
        force: true,
      });
    } catch {}
  });

  it('should pass tsc type check', async () => {
    const tsc = await execa({
      cwd: fixturePath,
    })`tsc`;

    expect(tsc.exitCode).toBe(0);
  });

  it('should return all agents', async () => {
    const tsc = await execa({
      cwd: fixturePath,
    })`tsc`;

    const { stdout } = await execa(process.execPath, [join(fixturePath, 'dist', 'index.js')], {
      cwd: fixturePath,
    });

    const parsedOutput = JSON.parse(stdout);
    expect(parsedOutput.weatherAgent).toBeDefined();
    expect(parsedOutput.weatherAgent.name).toBe('Weather Agent');
    expect(parsedOutput.weatherAgent.instructions).toMatchInlineSnapshot(`
      "
            You are a helpful weather assistant that provides accurate weather information.

            Your primary function is to help users get weather details for specific locations. When responding:
            - Always ask for a location if none is provided
            - If the location name isn’t in English, please translate it
            - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
            - Include relevant details like humidity, wind conditions, and precipitation
            - Keep responses concise but informative

            Use the weatherTool to fetch current weather data.
      "
    `);
  });
});
