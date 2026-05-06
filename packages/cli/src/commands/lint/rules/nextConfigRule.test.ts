import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextConfigRule } from './nextConfigRule.js';
import type { LintContext } from './types.js';

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const evalMarker = 'MASTRA_NEXT_CONFIG_RULE_EVAL_MARKER';

function createContext(rootDir: string): LintContext {
  return {
    rootDir,
    mastraDir: join(rootDir, 'src', 'mastra'),
    outputDirectory: join(rootDir, '.mastra'),
    discoveredTools: [],
    packageJson: {},
    mastraPackages: [{ name: '@mastra/core', version: '1.0.0', isAlpha: false }],
  };
}

function createProject(nextConfigContent: string): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'mastra-next-config-rule-'));
  writeFileSync(join(rootDir, 'next.config.js'), nextConfigContent);
  return rootDir;
}

describe('nextConfigRule', () => {
  const projectDirs: string[] = [];

  afterEach(() => {
    delete process.env[evalMarker];

    for (const projectDir of projectDirs.splice(0)) {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('reads serverExternalPackages from a nextConfig object literal', async () => {
    const rootDir = createProject(`
      const nextConfig = {
        serverExternalPackages: ["@mastra/*"],
      };
      module.exports = nextConfig;
    `);
    projectDirs.push(rootDir);

    await expect(nextConfigRule.run(createContext(rootDir))).resolves.toBe(true);
  });

  it('reads serverExternalPackages from module.exports object literal', async () => {
    const rootDir = createProject(`
      module.exports = {
        serverExternalPackages: ["@mastra/core"],
      };
    `);
    projectDirs.push(rootDir);

    await expect(nextConfigRule.run(createContext(rootDir))).resolves.toBe(true);
  });

  it('reads serverExternalPackages from export default object literal', async () => {
    const rootDir = createProject(`
      export default {
        serverExternalPackages: ["@mastra/memory"],
      };
    `);
    projectDirs.push(rootDir);

    await expect(nextConfigRule.run(createContext(rootDir))).resolves.toBe(true);
  });

  it('does not execute dynamic code in next.config.js', async () => {
    const rootDir = createProject(`
      const nextConfig = {
        serverExternalPackages: (() => {
          process.env.${evalMarker} = "executed";
          return ["@mastra/*"];
        })(),
      };
      module.exports = nextConfig;
    `);
    projectDirs.push(rootDir);

    await expect(nextConfigRule.run(createContext(rootDir))).resolves.toBe(false);
    expect(process.env[evalMarker]).toBeUndefined();
  });
});
