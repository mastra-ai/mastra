import { expect, it, vi } from 'vitest';

const runTui = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('./run-tui.js', () => ({ runTui }));

it('the mastracode bin boots with runTui and no launcher options', async () => {
  await import('./main.js');

  expect(runTui).toHaveBeenCalledTimes(1);
  expect(runTui).toHaveBeenCalledWith();
});
