import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { spawnSync } from 'node:child_process';

const timeout = 5 * 60 * 1000;

/**
 * E2E tests for bundler analysis functionality:
 * - Dynamic packages detection (packages loaded via dynamic requires/imports)
 * - Pino transport auto-detection
 */
describe.for([['pnpm'] as const])(`%s bundler analysis`, ([pkgManager]) => {
  let fixturePath: string;

  beforeAll(
    async () => {
      const registry = inject('registry');

      fixturePath = await mkdtemp(join(tmpdir(), `mastra-bundler-analysis-test-${pkgManager}-`));
      process.env.npm_config_registry = registry;

      // Create a basic project structure
      await mkdir(join(fixturePath, 'src', 'mastra'), { recursive: true });
      await mkdir(join(fixturePath, '.mastra'), { recursive: true });

      // Create package.json
      await writeFile(
        join(fixturePath, 'package.json'),
        JSON.stringify(
          {
            name: 'bundler-analysis-test',
            version: '1.0.0',
            type: 'module',
            scripts: {
              build: 'mastra build',
            },
            dependencies: {
              '@mastra/core': 'deployers-e2e-test',
              mastra: 'deployers-e2e-test',
              pino: '^9.0.0',
              'pino-pretty': '^11.0.0',
              'pino-opentelemetry-transport': '^1.0.0',
              zod: '^3.0.0',
            },
            devDependencies: {
              typescript: '^5.0.0',
              '@types/node': '^22.0.0',
            },
          },
          null,
          2,
        ),
      );

      // Create tsconfig.json
      await writeFile(
        join(fixturePath, 'tsconfig.json'),
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'ESNext',
              moduleResolution: 'bundler',
              esModuleInterop: true,
              strict: true,
              outDir: './dist',
              skipLibCheck: true,
            },
            include: ['src/**/*'],
          },
          null,
          2,
        ),
      );

      // Create mastra entry with pino transport usage and dynamicPackages config
      await writeFile(
        join(fixturePath, 'src', 'mastra', 'index.ts'),
        `
import pino from 'pino';
import { Mastra } from '@mastra/core';

// This uses pino.transport with a string target - should be auto-detected
const transport = pino.transport({
  targets: [
    { target: 'pino-pretty', level: 'info' },
  ]
});

export const logger = pino(transport);

export const mastra = new Mastra({
  bundler: {
    dynamicPackages: ['pino-opentelemetry-transport'],
  },
});
`,
      );

      // Install dependencies
      console.log('Installing dependencies...');
      spawnSync(pkgManager, ['install'], {
        cwd: fixturePath,
        stdio: 'inherit',
        shell: true,
        env: process.env,
      });
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

  describe('dynamicPackages and pino transport detection', () => {
    beforeAll(async () => {
      // Run the build
      console.log('Building project...');
      const result = spawnSync(pkgManager, ['build'], {
        cwd: fixturePath,
        stdio: 'inherit',
        shell: true,
        env: process.env,
      });

      // Check if build succeeded
      if (result.status !== 0) {
        throw new Error(`Build failed with exit code ${result.status}`);
      }
    }, timeout);

    it('should auto-detect pino transport targets as external dependencies', async () => {
      // Read the output package.json to verify pino-pretty was detected
      const pkgPath = join(fixturePath, '.mastra', 'output', 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      expect(pkg.dependencies).toHaveProperty('pino-pretty');
    });

    it('should include manually specified dynamicPackages as external dependencies', async () => {
      const pkgPath = join(fixturePath, '.mastra', 'output', 'package.json');
      const pkgContent = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      // pino-opentelemetry-transport was specified via dynamicPackages config
      expect(pkg.dependencies).toHaveProperty('pino-opentelemetry-transport');
    });
  });
});
