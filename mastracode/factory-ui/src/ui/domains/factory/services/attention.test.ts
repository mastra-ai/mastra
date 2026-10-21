import { describe, expect, it } from 'vitest';

import { readableAttentionDetail } from './attention';

describe('readableAttentionDetail', () => {
  it('turns ISO instants into a local clock and keeps the sentence around them', () => {
    const detail = readableAttentionDetail(
      'In review since 2026-10-12T07:28:26.926Z with no active review seat; nothing will move it.',
    );

    expect(detail).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(detail).toMatch(/^In review since .+ with no active review seat; nothing will move it\.$/);
  });

  it('leaves bare dates and other numbers alone', () => {
    expect(readableAttentionDetail('Release 2026-10-12 shipped 3 fixes')).toBe('Release 2026-10-12 shipped 3 fixes');
  });

  it('leaves an instant that is not a real date as written instead of failing the render', () => {
    expect(readableAttentionDetail('Mentioned at 2026-13-12T07:28:26.926Z')).toBe(
      'Mentioned at 2026-13-12T07:28:26.926Z',
    );
  });
});
