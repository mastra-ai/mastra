import { describe, expect, it } from 'vitest';

import { PiCommandAdapter } from '../command-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

function commandGeneration(id: string, result: string) {
  const generation = new MastraPiExtensionGeneration(id, id, `/tmp/${id}.ts`);
  generation.createApi().registerCommand('review', { description: id, handler: args => `${result}:${args}` });
  void generation.bind();
  return generation;
}

describe('Pi command adapter', () => {
  it('assigns deterministic conflict names and dispatches owned handlers', async () => {
    const first = commandGeneration('first', 'a');
    const second = commandGeneration('second', 'b');
    const adapter = new PiCommandAdapter();
    adapter.setGenerations([first, second], ['review']);

    expect(adapter.list().map(command => command.name)).toEqual(['review:1', 'review:2']);
    await expect(adapter.dispatch('review:1', 'one')).resolves.toBe('a:one');
    await expect(adapter.dispatch('review:2', 'two')).resolves.toBe('b:two');
    expect(second.compatibility.diagnostics.some(diagnostic => diagnostic.message.includes('review:2'))).toBe(true);
  });

  it('creates a narrow owned command context instead of forwarding caller objects', async () => {
    const generation = new MastraPiExtensionGeneration('context', 'context', '/tmp/context.ts');
    generation.createApi().registerCommand('inspect', {
      handler: (_args, context) => ({
        frozen: Object.isFrozen(context),
        keys: Object.keys(context as object),
        mode: (context as { mode?: unknown }).mode,
      }),
    });
    await generation.bind({ getModel: () => 'model' });
    const adapter = new PiCommandAdapter();
    adapter.setGenerations([generation]);

    const result = await adapter.dispatch('inspect', '', { mode: 'tui' });
    expect(result).toMatchObject({ frozen: true, mode: 'tui' });
    expect((result as { keys: string[] }).keys).not.toContain('requestContext');
  });

  it('uses typed flag values and diagnoses legacy config values before falling back to defaults', () => {
    const generation = new MastraPiExtensionGeneration('flags', 'flags', '/tmp/flags.ts');
    const api = generation.createApi({ enabled: true, channel: false });
    api.registerFlag('enabled', { type: 'boolean', default: false });
    api.registerFlag('channel', { type: 'string', default: 'stable' });
    expect(api.getFlag('enabled')).toBe(true);
    expect(api.getFlag('channel')).toBe('stable');
    expect(generation.compatibility.diagnostics.some(diagnostic => diagnostic.capability === 'getFlag:migration')).toBe(
      true,
    );
  });

  it('rejects dispatch through a stale generation', async () => {
    const generation = commandGeneration('stale', 'value');
    const adapter = new PiCommandAdapter();
    adapter.setGenerations([generation]);
    await generation.invalidate();
    await expect(adapter.dispatch('review')).rejects.toThrow('stale');
  });
});
