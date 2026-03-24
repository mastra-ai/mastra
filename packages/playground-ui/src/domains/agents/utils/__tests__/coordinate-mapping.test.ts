import { describe, it, expect } from 'vitest';
import { mapClientToViewport, normalizeWheelDelta, getModifiers } from '../coordinate-mapping';

describe('mapClientToViewport', () => {
  it('maps correctly for exact-fit aspect ratio (no letterbox)', () => {
    // elemRect 800x600, viewport 1600x1200 -> scale = min(0.5, 0.5) = 0.5
    // rendered: 800x600, offset: (0, 0)
    // click at (400, 300) -> imageX=400, imageY=300 -> viewport (800, 600)
    const result = mapClientToViewport(400, 300, { left: 0, top: 0, width: 800, height: 600 }, { width: 1600, height: 1200 });
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(800, 1);
    expect(result!.y).toBeCloseTo(600, 1);
  });

  it('maps correctly for pillarbox (viewport wider than element)', () => {
    // elemRect 800x600, viewport 1920x1080
    // scale = min(800/1920, 600/1080) = min(0.4167, 0.5556) = 0.4167
    // rendered: 1920*0.4167=800, 1080*0.4167=450
    // offsetX = (800-800)/2=0, offsetY = (600-450)/2=75
    // click at center (400, 300) -> imageX=400, imageY=300-75=225
    // viewport: (400/0.4167, 225/0.4167) = (960, 540)
    const result = mapClientToViewport(400, 300, { left: 0, top: 0, width: 800, height: 600 }, { width: 1920, height: 1080 });
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(960, 0);
    expect(result!.y).toBeCloseTo(540, 0);
  });

  it('maps correctly for letterbox (viewport taller than element)', () => {
    // elemRect 800x600, viewport 800x1200
    // scale = min(800/800, 600/1200) = min(1, 0.5) = 0.5
    // rendered: 800*0.5=400, 1200*0.5=600
    // offsetX = (800-400)/2=200, offsetY = (600-600)/2=0
    // click at (400, 300) -> imageX=400-200=200, imageY=300
    // viewport: (200/0.5, 300/0.5) = (400, 600)
    const result = mapClientToViewport(400, 300, { left: 0, top: 0, width: 800, height: 600 }, { width: 800, height: 1200 });
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(400, 1);
    expect(result!.y).toBeCloseTo(600, 1);
  });

  it('returns null for click in left pillarbox region', () => {
    // letterbox case: offsetX = 200
    // click at (100, 300) -> imageX = 100-200 = -100 < 0 -> null
    const result = mapClientToViewport(100, 300, { left: 0, top: 0, width: 800, height: 600 }, { width: 800, height: 1200 });
    expect(result).toBeNull();
  });

  it('returns null for click in top letterbox region', () => {
    // pillarbox case: offsetY = 75
    // click at (400, 50) -> imageY = 50-75 = -25 < 0 -> null
    const result = mapClientToViewport(400, 50, { left: 0, top: 0, width: 800, height: 600 }, { width: 1920, height: 1080 });
    expect(result).toBeNull();
  });

  it('returns null for click in right pillarbox region', () => {
    // letterbox case: offsetX=200, renderedWidth=400
    // click at (700, 300) -> imageX=700-200=500 > 400 -> null
    const result = mapClientToViewport(700, 300, { left: 0, top: 0, width: 800, height: 600 }, { width: 800, height: 1200 });
    expect(result).toBeNull();
  });

  it('returns null for click in bottom letterbox region', () => {
    // pillarbox case: offsetY=75, renderedHeight=450
    // click at (400, 560) -> imageY=560-75=485 > 450 -> null
    const result = mapClientToViewport(400, 560, { left: 0, top: 0, width: 800, height: 600 }, { width: 1920, height: 1080 });
    expect(result).toBeNull();
  });

  it('maps top-left corner of rendered area to viewport (0, 0)', () => {
    // letterbox case: offsetX=200, offsetY=0, scale=0.5
    // click at (200, 0) -> imageX=0, imageY=0 -> viewport (0, 0)
    const result = mapClientToViewport(200, 0, { left: 0, top: 0, width: 800, height: 600 }, { width: 800, height: 1200 });
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(0, 1);
    expect(result!.y).toBeCloseTo(0, 1);
  });

  it('maps bottom-right corner of rendered area to viewport max', () => {
    // letterbox case: offsetX=200, offsetY=0, scale=0.5, renderedWidth=400, renderedHeight=600
    // click at (200+400, 0+600) = (600, 600) -> imageX=400, imageY=600
    // viewport: (400/0.5, 600/0.5) = (800, 1200)
    const result = mapClientToViewport(600, 600, { left: 0, top: 0, width: 800, height: 600 }, { width: 800, height: 1200 });
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(800, 1);
    expect(result!.y).toBeCloseTo(1200, 1);
  });

  it('handles non-zero element offset (left/top not at origin)', () => {
    // elemRect at (100, 50), size 800x600, viewport 1600x1200
    // scale = 0.5, no letterbox
    // click at (500, 350) -> relX=500-100=400, relY=350-50=300
    // viewport: (400/0.5, 300/0.5) = (800, 600)
    const result = mapClientToViewport(500, 350, { left: 100, top: 50, width: 800, height: 600 }, { width: 1600, height: 1200 });
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(800, 1);
    expect(result!.y).toBeCloseTo(600, 1);
  });
});

describe('normalizeWheelDelta', () => {
  it('returns pixel delta unchanged for deltaMode 0 (DOM_DELTA_PIXEL)', () => {
    expect(normalizeWheelDelta(120, 0)).toBe(120);
  });

  it('multiplies line delta by 16 for deltaMode 1 (DOM_DELTA_LINE)', () => {
    expect(normalizeWheelDelta(3, 1)).toBe(48);
  });

  it('multiplies page delta by viewportHeight for deltaMode 2 (DOM_DELTA_PAGE)', () => {
    // 1 * 900 = 900, clamped to 500
    expect(normalizeWheelDelta(1, 2, 900)).toBe(500);
  });

  it('uses default height 800 when viewportHeight not provided for page mode', () => {
    // 1 * 800 = 800, clamped to 500
    expect(normalizeWheelDelta(1, 2)).toBe(500);
  });

  it('preserves negative delta values', () => {
    expect(normalizeWheelDelta(-300, 0)).toBe(-300);
  });

  it('clamps extreme positive delta to 500', () => {
    expect(normalizeWheelDelta(1000, 0)).toBe(500);
  });

  it('clamps extreme negative delta to -500', () => {
    expect(normalizeWheelDelta(-1000, 0)).toBe(-500);
  });

  it('handles fractional line deltas', () => {
    // 1.5 * 16 = 24
    expect(normalizeWheelDelta(1.5, 1)).toBe(24);
  });

  it('handles zero delta', () => {
    expect(normalizeWheelDelta(0, 0)).toBe(0);
  });

  it('falls back to pixel behavior for unknown deltaMode', () => {
    expect(normalizeWheelDelta(50, 99)).toBe(50);
  });
});

describe('getModifiers', () => {
  it('returns 0 when no modifiers are active', () => {
    expect(getModifiers({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false })).toBe(0);
  });

  it('returns 1 for Alt only', () => {
    expect(getModifiers({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false })).toBe(1);
  });

  it('returns 2 for Ctrl only', () => {
    expect(getModifiers({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: false })).toBe(2);
  });

  it('returns 4 for Meta only', () => {
    expect(getModifiers({ altKey: false, ctrlKey: false, metaKey: true, shiftKey: false })).toBe(4);
  });

  it('returns 8 for Shift only', () => {
    expect(getModifiers({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: true })).toBe(8);
  });

  it('returns 10 for Ctrl+Shift', () => {
    expect(getModifiers({ altKey: false, ctrlKey: true, metaKey: false, shiftKey: true })).toBe(10);
  });

  it('returns 15 for all modifiers active', () => {
    expect(getModifiers({ altKey: true, ctrlKey: true, metaKey: true, shiftKey: true })).toBe(15);
  });

  it('returns 5 for Alt+Meta', () => {
    expect(getModifiers({ altKey: true, ctrlKey: false, metaKey: true, shiftKey: false })).toBe(5);
  });
});
