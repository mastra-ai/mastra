import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';
import { applyUpdate } from '../plugin.js';

/**
 * The plugin entry re-exports the shared fold so out-of-tree plugins reach it
 * through their existing `mastracode` peer dependency.
 *
 * This asserts the value is the real fold. It imports the module relatively, so
 * on its own it does not prove the published `mastracode/plugin` subpath resolves
 * — the phase gate pairs it with a resolution check through the real export map
 * (`import('mastracode/plugin')`) after `pnpm build:mastracode`.
 */
describe('plugin exports', () => {
  it('re-exports applyUpdate as a working fold', () => {
    expect(typeof applyUpdate).toBe('function');

    const message = {
      id: 'm1',
      role: 'assistant',
      createdAt: new Date(),
      content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
    } as unknown as MastraDBMessage;

    const updated = applyUpdate(message, { type: 'text-delta', delta: ' world' });

    expect(updated?.content.parts).toEqual([{ type: 'text', text: 'hello world' }]);
    expect(updated).not.toBe(message);
  });
});
