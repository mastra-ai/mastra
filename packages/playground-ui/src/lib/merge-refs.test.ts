import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { mergeRefs } from './merge-refs';

describe('mergeRefs', () => {
  it('detaches every ref the way React would: runs returned cleanups, nulls the rest', () => {
    const element = { tagName: 'DIV' };
    const objectRef = createRef<typeof element>();
    const plainCallback = vi.fn();
    const cleanup = vi.fn();
    const callbackWithCleanup = vi.fn(() => cleanup);

    const detach = mergeRefs(objectRef, plainCallback, callbackWithCleanup)(element);

    expect(objectRef.current).toBe(element);
    expect(plainCallback).toHaveBeenLastCalledWith(element);

    detach();

    expect(objectRef.current).toBeNull();
    expect(plainCallback).toHaveBeenLastCalledWith(null);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(callbackWithCleanup).not.toHaveBeenCalledWith(null);
  });
});
