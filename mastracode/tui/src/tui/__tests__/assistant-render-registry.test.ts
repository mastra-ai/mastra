import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';
import {
  AssistantRenderRegistry,
  disposeAssistantRenderState,
  getAssistantSegmentKey,
} from '../assistant-render-registry.js';
import { AssistantMessageComponent } from '../components/assistant-message.js';
import type { TUIState } from '../state.js';

function assistantMessage(parts: MastraDBMessage['content']['parts']): MastraDBMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts },
  } as MastraDBMessage;
}

function contentChildren(component: AssistantMessageComponent): unknown[] {
  const content = component.children[0] as unknown as { children: unknown[] };
  return content.children;
}

function containsReference(root: unknown, target: object, seen = new WeakSet<object>()): boolean {
  if (root === target) return true;
  if (!root || typeof root !== 'object') return false;
  if (seen.has(root)) return false;
  seen.add(root);
  if (root instanceof Map) {
    return [...root.entries()].some(([key, value]) => {
      return containsReference(key, target, seen) || containsReference(value, target, seen);
    });
  }
  if (root instanceof Set) {
    return [...root.values()].some(value => containsReference(value, target, seen));
  }
  return Object.values(root).some(value => containsReference(value, target, seen));
}

describe('AssistantRenderRegistry', () => {
  it('uses deterministic message and tool-delimited segment keys', () => {
    expect(getAssistantSegmentKey('message-1')).toBe('message-1:segment:part:0');
    expect(getAssistantSegmentKey('message-1', 'tool-2')).toBe('message-1:segment:after-tool:tool-2');
    expect(getAssistantSegmentKey('message-1', 'tool-2')).toBe(getAssistantSegmentKey('message-1', 'tool-2'));
  });

  it('preserves component identity while reconciling the active segment', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const create = vi.fn(() => new AssistantMessageComponent());
    const first = registry.reconcile('assistant-1', key, assistantMessage([{ type: 'text', text: 'hello' }]), create);
    const second = registry.reconcile(
      'assistant-1',
      key,
      assistantMessage([{ type: 'text', text: 'hello world' }]),
      create,
    );

    expect(second.segment.component).toBe(first.segment.component);
    expect(create).toHaveBeenCalledOnce();
    expect(second.segment.component.render(80).join('\n')).toContain('hello world');
  });

  it('keeps unaffected children while reconciling a divergent structure', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const initial = assistantMessage([
      { type: 'text', text: 'stable' },
      { type: 'text', text: 'replace me' },
    ]);
    const divergent = assistantMessage([
      { type: 'text', text: 'stable' },
      { type: 'reasoning', reasoning: 'thinking instead' } as never,
    ]);
    const { segment } = registry.reconcile('assistant-1', key, initial, () => new AssistantMessageComponent());
    const before = contentChildren(segment.component);

    registry.reconcile('assistant-1', key, divergent, () => new AssistantMessageComponent());
    const after = contentChildren(segment.component);

    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(segment.component.render(80).join('\n')).toContain('thinking instead');
  });

  it('finalizes segments without retaining the full message object', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const message = assistantMessage([{ type: 'text', text: 'complete' }]);
    const { segment } = registry.reconcile('assistant-1', key, message, () => new AssistantMessageComponent());

    registry.finalizeActive('assistant-1');

    expect(segment.finalized).toBe(true);
    expect(registry.getActive('assistant-1')).toBeUndefined();
    expect(containsReference(registry, message)).toBe(false);
    expect((segment.component as unknown as { sourceParts: unknown[] }).sourceParts).toEqual([]);
    expect(segment.component.render(80).join('\n')).toContain('complete');
  });

  it('disposes component and registry ownership explicitly', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const { segment } = registry.reconcile(
      'assistant-1',
      key,
      assistantMessage([{ type: 'text', text: 'discard' }]),
      () => new AssistantMessageComponent(),
    );

    registry.dispose('assistant-1');

    expect(registry.size).toBe(0);
    expect(registry.get('assistant-1')).toBeUndefined();
    expect(contentChildren(segment.component)).toEqual([]);
  });

  it('clears all render ownership and streaming references at a thread boundary', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const { segment } = registry.start('assistant-1', key, () => new AssistantMessageComponent());
    const state = {
      assistantRenderRegistry: registry,
      streamingComponent: segment.component,
      streamingMessage: assistantMessage([{ type: 'text', text: 'pending' }]),
    } as TUIState;

    disposeAssistantRenderState(state);

    expect(registry.size).toBe(0);
    expect(state.streamingComponent).toBeUndefined();
    expect(state.streamingMessage).toBeUndefined();
  });
});
