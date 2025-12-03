import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'node:path';
import { execa } from 'execa';
import { createProject, type TestProject } from '../../_shared/setup/project.js';

describe('commonjs', () => {
  let project: TestProject;

  beforeAll(async () => {
    const registryUrl = inject('registryUrl');

    project = await createProject({
      template: 'commonjs',
      namePrefix: 'mastra-commonjs-test',
      registryUrl,
    });
  }, 60 * 1000);

  afterAll(async () => {
    await project?.cleanup();
  });

  it('should pass tsc type check', { timeout: 30 * 1000 }, async () => {
    const tsc = await execa('tsc', [], {
      cwd: project.path,
    });
    expect(tsc.exitCode).toBe(0);
  });

  it('should return all agents', async () => {
    // First compile
    await execa('tsc', [], {
      cwd: project.path,
    });

    // Then run
    const { stdout } = await execa(process.execPath, [join(project.path, 'dist', 'index.js')], {
      cwd: project.path,
    });

    const parsedOutput = JSON.parse(stdout);
    expect(parsedOutput.weatherAgent).toBeDefined();
    expect(parsedOutput.weatherAgent.name).toBe('Weather Agent');
    expect(parsedOutput.weatherAgent.instructions).toMatchInlineSnapshot(`
      "
            You are a helpful weather assistant that provides accurate weather information.

            Your primary function is to help users get weather details for specific locations. When responding:
            - Always ask for a location if none is provided
            - If the location name isn't in English, please translate it
            - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
            - Include relevant details like humidity, wind conditions, and precipitation
            - Keep responses concise but informative

            Use the weatherTool to fetch current weather data.
      "
    `);
  });
});
