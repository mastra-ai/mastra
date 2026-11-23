import { describe, expect, it } from 'vitest';

import { resolveThreadTitleUpdate } from '../observation-strategies/thread-title';

describe('resolveThreadTitleUpdate', () => {
  const thread = { title: 'Current title', metadata: {} };

  it('returns the new title when it differs and is long enough', () => {
    expect(resolveThreadTitleUpdate(thread, 'A fresh title')).toBe('A fresh title');
  });

  it('returns undefined for short, missing, or unchanged titles', () => {
    expect(resolveThreadTitleUpdate(thread, 'ab')).toBeUndefined();
    expect(resolveThreadTitleUpdate(thread, undefined)).toBeUndefined();
    expect(resolveThreadTitleUpdate(thread, '  Current title  ')).toBeUndefined();
  });

  it('returns undefined when the title is pinned by a manual rename', () => {
    expect(resolveThreadTitleUpdate({ ...thread, metadata: { titlePinned: true } }, 'A fresh title')).toBeUndefined();
  });

  it('treats titlePinned false as not pinned', () => {
    expect(resolveThreadTitleUpdate({ ...thread, metadata: { titlePinned: false } }, 'A fresh title')).toBe(
      'A fresh title',
    );
  });
});
