import { visibleWidth } from '@earendil-works/pi-tui';
import { InMemoryStore } from '@mastra/core/storage';
import { buildSubconsciousActivitySnapshot } from '@mastra/memory/processors';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';

import { parseSubconsciousActivitySnapshot, SubconsciousActivityComponent } from '../subconscious-activity.js';

function snapshot(overrides: Record<string, unknown> = {}): any {
  return {
    updates: [
      {
        action: 'record-created',
        type: 'record',
        name: 'Atlas launch',
        createdAt: '2026-07-15T00:00:00.000Z',
      },
    ],
    hot: [{ type: 'node', name: 'Atlas launch', updates: 3 }],
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
    expect(rendered).toContain('record-created: Atlas launch');
    expect(rendered).toContain('Hot: Atlas launch (3)');
  });

  it('renders redacted activity details without requiring storage identifiers', () => {
    const parsed = parseSubconsciousActivitySnapshot(
      snapshot({ updates: [{ ...snapshot().updates[0], name: undefined }], hot: [] }),
    );
    const rendered = text(new SubconsciousActivityComponent(parsed!));

    expect(rendered).toContain('record (details unavailable)');
  });

  it('accepts snapshots produced by observational memory without exposing provenance', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('knowledge'))!;
    const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];
    const node = await store.createNode({ name: 'Atlas launch', kind: 'project', scope });
    const item = await store.appendKnowledge({
      node: node.id,
      text: 'Launches in January.',
      scope,
      sourceThreadId: 'private-thread',
      resolutionScope: scope,
      defaultScope: scope,
    });

    const produced = await buildSubconsciousActivitySnapshot({ store, scope, recentUpdates: 10 });
    const parsed = parseSubconsciousActivitySnapshot(produced);

    expect(parsed).toBeDefined();
    expect(text(new SubconsciousActivityComponent(parsed!))).toContain('record-created: Atlas launch');
    expect(JSON.stringify(produced)).not.toContain(node.id);
    expect(JSON.stringify(produced)).not.toContain(item.id);
    expect(JSON.stringify(produced)).not.toContain('private-thread');
    expect(produced.updates.every(update => !('recordId' in update) && !('targetId' in update))).toBe(true);
    expect(produced.updates.every(update => !('sourceThreadId' in update))).toBe(true);
  });

  it('renders errors without losing activity', () => {
    const rendered = text(new SubconsciousActivityComponent(snapshot({ errors: ['remind model failed'] })));
    expect(rendered).toContain('1 error');
    expect(rendered).toContain('Error: remind model failed');
    expect(rendered).toContain('record-created: Atlas launch');
  });

  it('bounds dense activity output', () => {
    const dense = snapshot({
      updates: Array.from({ length: 10 }, (_, index) => ({
        ...snapshot().updates[0]!,
        name: `Record ${index}`,
      })),
      hot: Array.from({ length: 10 }, (_, index) => ({
        type: 'node' as const,
        name: `Node ${index}`,
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

  it('accepts configured activity bounds and rejects larger payloads', () => {
    expect(parseSubconsciousActivitySnapshot({ updates: 'invalid', hot: [] })).toBeUndefined();
    expect(parseSubconsciousActivitySnapshot({ updates: [], hot: [], errors: [1] })).toBeUndefined();
    expect(
      parseSubconsciousActivitySnapshot({
        updates: Array.from({ length: 100 }, () => snapshot().updates[0]),
        hot: [],
      }),
    ).toBeDefined();
    expect(
      parseSubconsciousActivitySnapshot({
        updates: Array.from({ length: 101 }, () => snapshot().updates[0]),
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
