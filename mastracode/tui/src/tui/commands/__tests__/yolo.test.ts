import { describe, expect, it, vi } from 'vitest';

import { handleYoloCommand } from '../yolo.js';

describe('handleYoloCommand', () => {
  it('reports success only after the canonical session accepts the state change', async () => {
    const showInfo = vi.fn();
    const showError = vi.fn();
    const set = vi.fn(async () => {
      throw new Error('state unavailable');
    });
    const ctx = {
      state: { session: { state: { get: () => ({ yolo: false }), set } } },
      showInfo,
      showError,
    } as any;

    await handleYoloCommand(ctx);

    expect(showInfo).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('Failed to enable YOLO mode: state unavailable');
  });
});
