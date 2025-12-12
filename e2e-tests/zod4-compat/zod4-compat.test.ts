import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { setupTestProject } from './prepare';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { execa } from 'execa';

interface TestResult {
  zod4Detected: boolean;
  basicStructuredOutput: { passed: boolean; error?: string };
  structuredOutputWithMemory: { passed: boolean; error?: string };
}

/**
 * Zod v3/v4 Compatibility E2E Test
 *
 * Regression test for issue #11121: Zod 4 schemas with structuredOutput
 * should work when @mastra/core uses Zod 3 internally.
 *
 * Test setup:
 * 1. Publish @mastra/core to a local Verdaccio registry
 * 2. Create a test project with Zod 4 as its primary dependency
 * 3. Install @mastra/core from the local registry (which has Zod 3)
 * 4. Run tests to verify Zod 4 schemas work with agent.generate()
 */
describe('Zod 4 Compatibility', () => {
  let fixturePath: string;
  let prevRegistry: string | undefined;

  beforeAll(async () => {
    const tag = inject('tag');
    const registry = inject('registry');

    console.log('registry', registry);
    console.log('tag', tag);
    fixturePath = await mkdtemp(join(tmpdir(), 'mastra-zod4-compat-test-'));

    prevRegistry = process.env.npm_config_registry;
    process.env.npm_config_registry = registry;
    await setupTestProject(fixturePath);
  }, 120 * 1000);

  afterAll(async () => {
    process.env.npm_config_registry = prevRegistry;

    try {
      await rm(fixturePath, {
        force: true,
        recursive: true,
      });
    } catch {}
  });

  it(
    'should work with Zod 4 schema in agent.generate() with memory (issue #11121)',
    { timeout: 60 * 1000 },
    async () => {
      const { stdout, stderr, exitCode } = await execa('npx', ['tsx', 'src/test.ts'], {
        cwd: fixturePath,
        reject: false,
      });

      // Parse the JSON result from stdout
      let testResult: TestResult;
      try {
        testResult = JSON.parse(stdout);
      } catch {
        throw new Error(`Failed to parse test output as JSON.\nstdout: ${stdout}\nstderr: ${stderr}`);
      }

      // Verify Zod 4 was detected
      expect(testResult.zod4Detected).toBe(true);

      // Verify basic structured output works
      expect(testResult.basicStructuredOutput.passed).toBe(true);

      // Verify structured output with memory works (the main regression test)
      if (!testResult.structuredOutputWithMemory.passed) {
        throw new Error(
          `Zod 4 compatibility test failed (issue #11121):\n` +
            `Error: ${testResult.structuredOutputWithMemory.error}\n` +
            `stderr: ${stderr}`,
        );
      }

      expect(exitCode).toBe(0);
    },
  );
});
