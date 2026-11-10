import { describe, expect, it } from 'vitest';

import { mentionPopupPlacement } from './popupPlacement';

describe('mentionPopupPlacement', () => {
  const pane = { width: 860, height: 760 };

  it('opens below a click in the top half', () => {
    expect(mentionPopupPlacement({ point: { x: 400, y: 200 }, pane })).toMatchObject({ top: 212, maxHeight: 320 });
  });

  it('opens above a click in the bottom half so it is not cut off by the pane', () => {
    const style = mentionPopupPlacement({ point: { x: 400, y: 620 }, pane });
    expect(style).toMatchObject({ bottom: 152, maxHeight: 320 });
    expect(style.top).toBeUndefined();
  });

  it('never grows taller than the room on its side', () => {
    expect(mentionPopupPlacement({ point: { x: 400, y: 150 }, pane: { width: 400, height: 400 } })).toMatchObject({
      top: 162,
      maxHeight: 230,
    });
  });
});
