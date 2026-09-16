import { Spacer } from '@earendil-works/pi-tui';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';
import { AssistantMessageComponent } from '../assistant-message.js';

function collectText(component: AssistantMessageComponent): string {
  const lines: string[] = [];
  const walk = (node: unknown): void => {
    const container = node as { children?: unknown[]; text?: unknown };
    if (typeof container.text === 'string') lines.push(container.text);
    if (typeof container.text === 'function') {
      try {
        const value = (container.text as () => unknown)();
        if (typeof value === 'string') lines.push(value);
      } catch {
        // ignore render-time getters that need a layout
      }
    }
    for (const child of container.children ?? []) walk(child);
  };
  walk(component);
  return lines.join('\n');
}

function contentChildren(component: AssistantMessageComponent): unknown[] {
  const content = component.children[0] as unknown as { children: unknown[] };
  return content.children;
}

function countSpacers(component: AssistantMessageComponent): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (node instanceof Spacer) count++;
    for (const child of (node as { children?: unknown[] }).children ?? []) walk(child);
  };
  walk(component);
  return count;
}

function assistantMessage(
  parts: MastraDBMessage['content']['parts'],
  metadata?: Record<string, unknown>,
): MastraDBMessage {
  return {
    id: 'a1',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts,
      ...(metadata ? { metadata } : {}),
    },
  } as MastraDBMessage;
}

describe('AssistantMessageComponent (DB-native)', () => {
  it('renders text parts from content.parts', () => {
    const component = new AssistantMessageComponent(assistantMessage([{ type: 'text', text: 'hello world' }]));
    expect(collectText(component)).toContain('hello world');
  });

  it('renders reasoning parts as thinking traces', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([{ type: 'reasoning', reasoning: 'let me think' } as never]),
      false,
    );
    expect(collectText(component)).toContain('let me think');
  });

  it('renders a single Thinking label for consecutive reasoning parts when thinking is hidden', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([
        { type: 'reasoning', reasoning: 'first span' } as never,
        { type: 'reasoning', reasoning: 'second span' } as never,
      ]),
      true,
    );
    const labels = collectText(component)
      .split('\n')
      .filter(line => line.includes('Thinking...'));
    expect(labels).toHaveLength(1);
  });

  it('renders separate Thinking labels when text interrupts hidden reasoning runs', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([
        { type: 'reasoning', reasoning: 'before' } as never,
        { type: 'text', text: 'visible answer' },
        { type: 'reasoning', reasoning: 'after' } as never,
      ]),
      true,
    );
    const rendered = collectText(component)
      .split('\n')
      .filter(line => line.includes('Thinking...') || line.includes('visible answer'));
    expect(rendered.map(line => (line.includes('Thinking...') ? 'thinking' : 'text'))).toEqual([
      'thinking',
      'text',
      'thinking',
    ]);
  });

  it('adds one spacer after a collapsed hidden thinking run, not one per part', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([
        { type: 'reasoning', reasoning: 'first span' } as never,
        { type: 'reasoning', reasoning: 'second span' } as never,
        { type: 'text', text: 'visible answer' },
      ]),
      true,
    );
    expect(countSpacers(component)).toBe(1);
  });

  it('renders every reasoning span as its own block when thinking is visible', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([
        { type: 'reasoning', reasoning: 'first span' } as never,
        { type: 'reasoning', reasoning: 'second span' } as never,
      ]),
      false,
    );
    const text = collectText(component);
    expect(text).toContain('first span');
    expect(text).toContain('second span');
    expect(text).not.toContain('Thinking...');
  });

  it('reads abort status from content.metadata.stopReason', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([{ type: 'text', text: 'partial' }], { stopReason: 'aborted', errorMessage: 'Interrupted' }),
    );
    expect(collectText(component)).toContain('Interrupted');
  });

  it('reads error status from content.metadata', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([{ type: 'text', text: 'partial' }], { stopReason: 'error', errorMessage: 'boom' }),
    );
    expect(collectText(component)).toContain('boom');
  });

  it('preserves child identity across repeated invalidation', () => {
    const component = new AssistantMessageComponent(assistantMessage([{ type: 'text', text: 'stable' }]));
    const child = contentChildren(component)[0];
    const before = component.render(80);

    component.invalidate();
    component.invalidate();

    expect(contentChildren(component)[0]).toBe(child);
    expect(component.render(80)).toEqual(before);
  });

  it('updates compatible text through the existing Markdown child', () => {
    const component = new AssistantMessageComponent(assistantMessage([{ type: 'text', text: 'first' }]));
    const child = contentChildren(component)[0];

    component.updateContent(assistantMessage([{ type: 'text', text: 'second' }]));

    expect(contentChildren(component)[0]).toBe(child);
    expect(component.render(80).join('\n')).toContain('second');
  });

  it('preserves the active Markdown child as incomplete stream constructs become complete', () => {
    const component = new AssistantMessageComponent(assistantMessage([{ type: 'text', text: '```ts\nconst value' }]));
    const child = contentChildren(component)[0];

    for (const text of [
      '```ts\nconst value = true;\n```\n\n-',
      '```ts\nconst value = true;\n```\n\n- first\n- second\n\n**bold',
      '```ts\nconst value = true;\n```\n\n- first\n- second\n\n**bold**',
    ]) {
      component.updateContent(assistantMessage([{ type: 'text', text }]));
      expect(contentChildren(component)[0]).toBe(child);
    }

    const rendered = component.render(80).join('\n');
    expect(rendered).toContain('const value = true;');
    expect(rendered).toContain('first');
    expect(rendered).toContain('second');
    expect(rendered).toContain('bold');
  });

  it('replaces only children whose render-part structure changes', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([
        { type: 'text', text: 'stable' },
        { type: 'text', text: 'replace me' },
      ]),
    );
    const before = contentChildren(component);

    component.updateContent(
      assistantMessage([{ type: 'text', text: 'stable' }, { type: 'reasoning', reasoning: 'replacement' } as never]),
    );
    const after = contentChildren(component);

    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
  });

  it('keeps child identity and byte-identical output after resize/theme invalidation', () => {
    const component = new AssistantMessageComponent(
      assistantMessage([{ type: 'text', text: '**stable** output that wraps at a narrow terminal width' }]),
    );
    component.render(40);
    const child = contentChildren(component)[0];
    const wideBefore = component.render(80);

    component.invalidate();

    expect(contentChildren(component)[0]).toBe(child);
    expect(component.render(80)).toEqual(wideBefore);
  });
});
