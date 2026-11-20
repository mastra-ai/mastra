import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineConfig } from './vitest.js';

const resolverNames = (config: { plugins?: unknown[] }) =>
  (config.plugins ?? []).filter(plugin => (plugin as { name?: string })?.name === 'mastra-workspace-source-resolver')
    .length;

describe('defineConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('adds the resolver once and lets inline projects inherit it', () => {
    vi.stubEnv('CI', '');

    const config = defineConfig({
      test: {
        projects: [{ test: { name: 'inherits' } }, { extends: false, test: { name: 'standalone' } }],
      },
    }) as any;

    expect(resolverNames(config)).toBe(1);
    expect(resolverNames(config.test.projects[0])).toBe(0);
    expect(resolverNames(config.test.projects[1])).toBe(1);
  });

  it('drops resolver copies from projects that inherit one', () => {
    vi.stubEnv('CI', '');
    const loadedProject = defineConfig({ test: { name: 'loaded' } }) as any;

    const config = defineConfig({ test: { projects: [loadedProject] } }) as any;

    expect(resolverNames(config.test.projects[0])).toBe(0);
  });

  it('passes the Node source hooks to spawned processes once', () => {
    vi.stubEnv('CI', '');
    vi.stubEnv('NODE_OPTIONS', '--max-old-space-size=4096');

    const config = defineConfig({ test: { env: { OTHER: '1' } } }) as any;
    const nodeOptions: string = config.test.env.NODE_OPTIONS;

    expect(config.test.env.OTHER).toBe('1');
    expect(nodeOptions.startsWith('--max-old-space-size=4096 --import=file:')).toBe(true);
    expect(nodeOptions.endsWith('/node-source-hooks.js')).toBe(true);
    expect((defineConfig(config) as any).test.env.NODE_OPTIONS).toBe(nodeOptions);
  });

  it('leaves the config untouched in CI', () => {
    vi.stubEnv('CI', 'true');
    const input = { test: { name: 'ci' } };

    expect(defineConfig(input)).toEqual(input);
  });
});
