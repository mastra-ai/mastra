import type { Plugin, PluginContext } from 'rollup';
import { beforeEach, describe, expect, it } from 'vitest';

describe('protocolExternalResolver', () => {
  let plugin: Plugin;
  let mockContext: PluginContext;

  beforeEach(async () => {
    const mod = await import('./protocol-external-resolver');
    plugin = mod.protocolExternalResolver();
    mockContext = {} as PluginContext;
  });

  const resolveId = (id: string) => {
    const fn = plugin.resolveId as Function;
    return fn.call(mockContext, id, undefined, {});
  };

  it('marks cloudflare: imports as external', async () => {
    expect(resolveId('cloudflare:workers')).toEqual({
      id: 'cloudflare:workers',
      external: true,
    });
  });

  it('does not treat node: imports as protocol externals', async () => {
    expect(resolveId('node:fs')).toBeNull();
  });

  it('does not affect normal package imports', async () => {
    expect(resolveId('@mastra/core')).toBeNull();
  });
});
