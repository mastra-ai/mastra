import { Text } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { adaptPiToolRenderers } from '../render-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

describe('Pi tool render adapter', () => {
  it('renders supported Pi components as deterministic plain text', () => {
    const generation = new MastraPiExtensionGeneration('render-plugin', 'render-extension', '/tmp/render.ts');
    const config = adaptPiToolRenderers(
      generation,
      {
        name: 'rendered',
        renderCall: args => new Text(`call: ${(args as { value: string }).value}`, 0, 0),
        renderResult: () => new Text('\u001b[31mresult text\u001b[0m', 0, 0),
      },
      '/workspace',
    );

    expect(config?.type).toBe('pi-text');
    expect(config?.renderCall({ value: 'hello' })).toBe('call: hello');
    expect(config?.renderResult({ content: [] })).toBe('result text');
    expect(generation.compatibility.diagnostics).toEqual([]);
  });

  it('preserves renderer state and arguments for each tool call', () => {
    const generation = new MastraPiExtensionGeneration('render-plugin', 'render-extension', '/tmp/render.ts');
    const config = adaptPiToolRenderers(
      generation,
      {
        name: 'stateful',
        renderCall: (_args, _theme, context) => {
          const ctx = context as { state: { count?: number }; cwd: string };
          ctx.state.count = (ctx.state.count ?? 0) + 1;
          return new Text(`call:${ctx.state.count}:${ctx.cwd}`, 0, 0);
        },
        renderResult: (_result, _options, _theme, context) => {
          const ctx = context as { state: { count?: number }; args: { value: string } };
          return new Text(`result:${ctx.state.count}:${ctx.args.value}`, 0, 0);
        },
      },
      '/workspace',
    );

    expect(config?.renderCall({ value: 'one' }, { toolCallId: 'call-1' })).toBe('call:1:/workspace');
    expect(config?.renderResult({}, { toolCallId: 'call-1' })).toBe('result:1:one');
    expect(config?.renderCall({ value: 'two' }, { toolCallId: 'call-2' })).toBe('call:1:/workspace');
  });

  it('uses safe text and records an attributed diagnostic for unsupported nodes', () => {
    const generation = new MastraPiExtensionGeneration('render-plugin', 'render-extension', '/tmp/render.ts');
    const config = adaptPiToolRenderers(
      generation,
      {
        name: 'fallback',
        renderCall: () => ({ unsupported: true }),
      },
      '/workspace',
    );

    expect(config?.renderCall({ query: 'value' })).toBe('{"query":"value"}');
    expect(generation.compatibility.diagnostics).toEqual([
      expect.objectContaining({
        extensionId: 'render-extension',
        severity: 'warning',
        message: expect.stringContaining('unsupported call renderer node'),
      }),
    ]);
  });

  it('rejects captured renderers after generation invalidation', async () => {
    const generation = new MastraPiExtensionGeneration('render-plugin', 'render-extension', '/tmp/render.ts');
    const config = adaptPiToolRenderers(
      generation,
      {
        name: 'stale',
        renderCall: () => new Text('stale', 0, 0),
      },
      '/workspace',
    );

    await generation.invalidate();
    expect(() => config?.renderCall({})).toThrow('context is stale');
  });
});
