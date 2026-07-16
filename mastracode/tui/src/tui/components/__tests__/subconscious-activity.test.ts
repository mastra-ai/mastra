import { visibleWidth } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';

import type { SubconsciousActivitySnapshot } from '../subconscious-activity.js';
import { parseSubconsciousActivitySnapshot, SubconsciousActivityComponent } from '../subconscious-activity.js';

function snapshot(overrides: Partial<SubconsciousActivitySnapshot> = {}): SubconsciousActivitySnapshot {
  return {
    updates: [
      {
        id: 'activity-1',
        action: 'fact-created',
        type: 'fact',
        recordId: 'fact-1',
        name: 'Atlas launch',
        targetId: 'atlas',
        targetType: 'entity',
        sourceThreadId: 'thread-1',
        createdAt: '2026-07-15T00:00:00.000Z',
      },
    ],
    hot: [{ type: 'entity', id: 'atlas', name: 'Atlas launch', updates: 3 }],
    ...overrides,
  };
}

function text(component: SubconsciousActivityComponent, width = 100): string {
  return component.render(width).map(stripAnsi).join('\n');
}

describe('SubconsciousActivityComponent', () => {
  it('validates and renders a structured snapshot', () => {
    const parsed = parseSubconsciousActivitySnapshot(snapshot());
    expect(parsed).toBeDefined();
    const rendered = text(new SubconsciousActivityComponent(parsed!));
    expect(rendered).toContain('Subconscious knowledge');
    expect(rendered).toContain('1 update · 1 hot');
    expect(rendered).toContain('fact-created: Atlas launch');
    expect(rendered).toContain('Hot: Atlas launch (3)');
  });

  it('renders errors without losing activity', () => {
    const rendered = text(new SubconsciousActivityComponent(snapshot({ errors: ['remind model failed'] })));
    expect(rendered).toContain('1 error');
    expect(rendered).toContain('Error: remind model failed');
    expect(rendered).toContain('fact-created: Atlas launch');
  });

  it('bounds dense activity output', () => {
    const dense = snapshot({
      updates: Array.from({ length: 10 }, (_, index) => ({
        ...snapshot().updates[0]!,
        id: `activity-${index}`,
        name: `Record ${index}`,
      })),
      hot: Array.from({ length: 10 }, (_, index) => ({
        type: 'entity' as const,
        id: `entity-${index}`,
        name: `Entity ${index}`,
        updates: 10 - index,
      })),
      errors: Array.from({ length: 10 }, (_, index) => `error ${index}`),
    });
    const rendered = text(new SubconsciousActivityComponent(dense));
    expect(rendered).toContain('+6 more updates');
    expect(rendered).toContain('+7 more errors');
    expect(rendered).not.toContain('Record 9');
    expect(rendered).not.toContain('error 9');
  });

  it('rejects malformed and unbounded payloads', () => {
    expect(parseSubconsciousActivitySnapshot({ updates: 'invalid', hot: [] })).toBeUndefined();
    expect(parseSubconsciousActivitySnapshot({ updates: [], hot: [], errors: [1] })).toBeUndefined();
    expect(
      parseSubconsciousActivitySnapshot({
        updates: Array.from({ length: 11 }, () => snapshot().updates[0]),
        hot: [],
      }),
    ).toBeUndefined();
  });

  it('renders safely at narrow terminal widths', () => {
    const component = new SubconsciousActivityComponent(snapshot());
    for (const line of component.render(30)) expect(visibleWidth(line)).toBeLessThanOrEqual(30);
    expect(text(component, 30)).toContain('Subconscious knowledge');
  });
});
