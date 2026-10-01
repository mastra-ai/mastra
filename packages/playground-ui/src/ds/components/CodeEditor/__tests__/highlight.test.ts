import { describe, expect, it } from 'vitest';

import { highlight } from '../highlight';

describe('highlight', () => {
  describe('when many blocks are highlighted at once', () => {
    it('yields to the browser between blocks instead of tokenizing them all in one task', async () => {
      await highlight('warm()', 'ts');

      let ticks = 0;
      let counting = true;
      const tick = () => {
        if (!counting) return;
        ticks++;
        setTimeout(tick, 0);
      };
      setTimeout(tick, 0);

      await Promise.all(Array.from({ length: 5 }, (_, i) => highlight(`const v${i} = ${i};`, 'ts')));
      counting = false;

      expect(ticks).toBeGreaterThanOrEqual(4);
    });
  });

  describe('when the same code is highlighted again', () => {
    it('returns the cached tokens', async () => {
      const first = await highlight('const cached = 1;', 'ts');
      const second = await highlight('const cached = 1;', 'ts');

      expect(second).toBe(first);
    });
  });

  describe('when the code is too large to tokenize responsively', () => {
    it('skips highlighting', async () => {
      expect(await highlight('x'.repeat(200_001), 'ts')).toBeNull();
    });
  });
});
