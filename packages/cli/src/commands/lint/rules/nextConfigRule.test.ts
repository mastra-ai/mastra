import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { nextConfigRule } from './nextConfigRule.js';
import type { LintContext } from './types.js';

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const exploitMarker = '__MASTRA_NEXT_CONFIG_EVAL_TEST__';
const tempDirs: string[] = [];

function createContext(rootDir: string): LintContext {
  return {
    rootDir,
    mastraDir: join(rootDir, 'src', 'mastra'),
    outputDirectory: join(rootDir, '.mastra'),
    discoveredTools: [],
    packageJson: {},
    mastraPackages: [],
  };
}

function writeNextConfig(content: string) {
  const rootDir = mkdtempSync(join(tmpdir(), 'mastra-next-config-rule-'));
  writeFileSync(join(rootDir, 'next.config.js'), content);
  tempDirs.push(rootDir);
  return rootDir;
}

describe('nextConfigRule', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, exploitMarker);
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test('passes when serverExternalPackages includes Mastra packages', async () => {
    const rootDir = writeNextConfig(`
      const nextConfig = {
        serverExternalPackages: ['@mastra/*'],
      };
    `);

    await expect(nextConfigRule.run(createContext(rootDir))).resolves.toBe(true);
  });

  test('does not execute code while reading next.config.js', async () => {
    const rootDir = writeNextConfig(`
      const nextConfig = {
        serverExternalPackages: ['@mastra/*'],
        poweredByHeader: (() => {
          globalThis.${exploitMarker} = true;
          return false;
        })(),
      };
    `);

    await expect(nextConfigRule.run(createContext(rootDir))).resolves.toBe(true);
    expect(Reflect.has(globalThis, exploitMarker)).toBe(false);
  });
});
