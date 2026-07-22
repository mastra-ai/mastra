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
});
