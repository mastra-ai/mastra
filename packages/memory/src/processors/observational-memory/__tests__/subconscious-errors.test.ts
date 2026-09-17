import { describe, expect, it, vi } from 'vitest';

import { publishSubconsciousError } from '../subconscious/activity';

describe('Subconscious errors', () => {
  it('emits a typed UI part and an activity error snapshot', async () => {
    const custom = vi.fn().mockResolvedValue(undefined);
    const sendStateSignal = vi.fn().mockResolvedValue({ skipped: false });

    await publishSubconsciousError({
      agent: 'curate',
      error: 'curate failed',
      writer: { custom } as any,
      sendStateSignal: sendStateSignal as any,
    });

    expect(custom).toHaveBeenCalledWith({
      type: 'data-subconscious-error',
      data: { agent: 'curate', error: 'curate failed' },
    });
    expect(sendStateSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheKey: '232b1353322676a79edecb678b2994d58499e5ba474084cb23268f8531e504fe',
        metadata: { origin: 'subconscious' },
        value: expect.objectContaining({ errors: ['curate failed'] }),
      }),
    );
  });
});
