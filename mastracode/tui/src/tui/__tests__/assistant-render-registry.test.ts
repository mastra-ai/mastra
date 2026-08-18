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

  it('coalesces append-only updates and compacts chunks only when pending state is applied', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const component = new AssistantMessageComponent();
    const update = vi.spyOn(component, 'updateRenderParts');
    registry.start('assistant-1', key, () => component);

    expect(registry.queueActive('assistant-1', assistantMessage([{ type: 'text', text: 'a' }]))).toEqual({
      mode: 'replace',
      appendedChunks: 0,
    });
    expect(registry.queueActive('assistant-1', assistantMessage([{ type: 'text', text: 'ab' }]))).toEqual({
      mode: 'append',
      appendedChunks: 1,
    });
    expect(registry.queueActive('assistant-1', assistantMessage([{ type: 'text', text: 'abc' }]))).toEqual({
      mode: 'append',
      appendedChunks: 1,
    });
    expect(update).not.toHaveBeenCalled();

    expect(registry.applyPending()).toHaveLength(1);
    expect(update).toHaveBeenCalledOnce();
    expect(component.render(80).join('\n')).toContain('abc');
    expect(registry.getActive('assistant-1')?.source?.parts[0]?.chunks).toEqual([]);
    expect(registry.applyPending()).toEqual([]);
    expect(update).toHaveBeenCalledOnce();
  });

  it('materializes split ANSI and Markdown source only after the complete latest state arrives', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const component = new AssistantMessageComponent();
    const update = vi.spyOn(component, 'updateRenderParts');
    registry.start('assistant-1', key, () => component);

    registry.queueActive('assistant-1', assistantMessage([{ type: 'text', text: '```ts\nconst styled = "\u001b[' }]));
    registry.queueActive(
      'assistant-1',
      assistantMessage([{ type: 'text', text: '```ts\nconst styled = "\u001b[31mred\u001b[0m";\n```' }]),
    );
    registry.applyPending();

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      [{ kind: 'text', text: '```ts\nconst styled = "\u001b[31mred\u001b[0m";\n```' }],
      { stopReason: undefined, errorMessage: undefined },
    );
    expect(component.render(80).join('\n')).toContain('red');
  });

  it('replaces only the active source on a divergent correction', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const component = new AssistantMessageComponent();
    registry.start('assistant-1', key, () => component);
    registry.queueActive('assistant-1', assistantMessage([{ type: 'text', text: 'draft ending' }]));
    registry.applyPending();
    const child = contentChildren(component)[0];

    expect(registry.queueActive('assistant-1', assistantMessage([{ type: 'text', text: 'corrected ending' }]))).toEqual(
      {
        mode: 'replace',
        appendedChunks: 0,
      },
    );
    registry.applyPending();

    expect(contentChildren(component)[0]).toBe(child);
    expect(component.render(80).join('\n')).toContain('corrected ending');
    expect(component.render(80).join('\n')).not.toContain('draft ending');
  });

  it('finalizes segments without retaining the full message object or temporary source chunks', () => {
    const registry = new AssistantRenderRegistry();
    const key = getAssistantSegmentKey('assistant-1');
    const message = assistantMessage([{ type: 'text', text: 'complete' }]);
    const { segment } = registry.reconcile('assistant-1', key, message, () => new AssistantMessageComponent());

    registry.finalizeActive('assistant-1');

    expect(segment.finalized).toBe(true);
    expect(registry.getActive('assistant-1')).toBeUndefined();
    expect(segment.source).toBeUndefined();
    expect(segment.pendingApply).toBe(false);
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
