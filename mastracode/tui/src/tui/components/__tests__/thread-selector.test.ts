import type { AgentControllerThread } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@earendil-works/pi-tui', () => {
  class MockNode {
    children: any[] = [];
    addChild(child: any) {
      this.children.push(child);
      return child;
    }
    clear() {
      this.children = [];
    }
  }

  class Box extends MockNode {
    constructor(..._args: any[]) {
      super();
    }
  }

  class Container extends MockNode {}

  class Input extends MockNode {
    value = '';
    focused = false;
    onSubmit?: () => void;
    getValue() {
      return this.value;
    }
    handleInput(keyData: string) {
      if (keyData === '\r') {
        this.onSubmit?.();
        return;
      }
      if (keyData === '\u007f') {
        this.value = this.value.slice(0, -1);
        return;
      }
      if (keyData.length === 1) {
        this.value += keyData;
      }
    }
  }

  class Text {
    constructor(
      public text: string,
      public x = 0,
      public y = 0,
    ) {}
    render() {
      return [this.text];
    }
  }

  class Spacer {
    constructor(public size: number) {}
  }

  return {
    Box,
    Container,
    Input,
    Spacer,
    Text,
    fuzzyFilter: (
      threads: AgentControllerThread[],
      query: string,
      getText: (thread: AgentControllerThread) => string,
    ) => threads.filter(thread => getText(thread).toLowerCase().includes(query.toLowerCase())),
    getKeybindings: () => ({
      matches: (keyData: string, action: string) => {
        if (action === 'tui.select.up') return keyData === 'UP';
        if (action === 'tui.select.down') return keyData === 'DOWN';
        if (action === 'tui.select.confirm') return keyData === '\r';
        if (action === 'tui.select.cancel') return keyData === 'ESC';
        return false;
      },
    }),
    matchesKey: (data: string, keyId: string) => {
      if (keyId === 'tab') return data === '\t' || data === 'TAB';
      if (keyId === 'ctrl+d') return data === '\u0004' || data === 'CTRL+D';
      return false;
    },
  };
});

vi.mock('../../theme.js', () => ({
  theme: {
    bg: (_token: string, text: string) => text,
    bold: (text: string) => text,
    fg: (_token: string, text: string) => text,
  },
}));

import { ThreadSelectorComponent } from '../thread-selector.js';

function createThread(id: string, updatedAtOffsetMinutes: number): AgentControllerThread {
  const updatedAt = new Date(Date.now() - updatedAtOffsetMinutes * 60_000);
  return {
    id,
    resourceId: 'resource-1',
    title: 'New Thread',
    createdAt: updatedAt,
    updatedAt,
    metadata: {},
    tokenUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
  };
}

describe('ThreadSelectorComponent preview caching', () => {
  it('seeds previews from cache and only fetches uncached thread ids', async () => {
    vi.useFakeTimers();

    const threads = [createThread('thread-1', 0), createThread('thread-2', 1), createThread('thread-3', 2)];
    const requestRender = vi.fn();
    const getMessagePreviews = vi.fn(async (threadIds: string[]) => new Map([[threadIds[0]!, 'Fresh preview']]));
    const onMessagePreviewsLoaded = vi.fn();

    const selector = new ThreadSelectorComponent({
      tui: { requestRender } as any,
      threads,
      currentThreadId: null,
      currentResourceId: 'resource-1',
      currentProjectPath: undefined,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
      getMessagePreviews,
      initialMessagePreviews: new Map([['thread-1', 'Cached preview']]),
      initialAttemptedPreviewThreadIds: new Set(['thread-2']),
      onMessagePreviewsLoaded,
    });

    const initialLines = ((selector as any).listContainer.children as Array<{ text?: string }>)
      .map(child => child.text)
      .filter(Boolean)
      .join('\n');

    expect(initialLines).toContain('"Cached preview"');
    expect(getMessagePreviews).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(150);

    expect(getMessagePreviews).toHaveBeenCalledTimes(1);
    expect(getMessagePreviews).toHaveBeenCalledWith(['thread-3']);
    expect(onMessagePreviewsLoaded).toHaveBeenCalledTimes(1);
    const [previews, attemptedIds] = onMessagePreviewsLoaded.mock.calls[0]!;
    expect(previews).toBeInstanceOf(Map);
    expect(previews.get('thread-1')).toBe('Cached preview');
    expect(previews.get('thread-3')).toBe('Fresh preview');
    expect(attemptedIds).toBeInstanceOf(Set);
    expect(attemptedIds.has('thread-2')).toBe(true);
    expect(attemptedIds.has('thread-3')).toBe(true);
    expect(requestRender).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('debounces preview fetching during navigation', async () => {
    vi.useFakeTimers();

    const threads = [
      createThread('thread-1', 0),
      createThread('thread-2', 1),
      createThread('thread-3', 2),
      createThread('thread-4', 3),
    ];
    const requestRender = vi.fn();
    const getMessagePreviews = vi.fn(async (_threadIds: string[]) => new Map());

    const selector = new ThreadSelectorComponent({
      tui: { requestRender } as any,
      threads,
      currentThreadId: null,
      currentResourceId: 'resource-1',
      currentProjectPath: undefined,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
      getMessagePreviews,
    });

    await vi.advanceTimersByTimeAsync(149);
    expect(getMessagePreviews).not.toHaveBeenCalled();

    selector.handleInput('DOWN');
    selector.handleInput('DOWN');

    await vi.advanceTimersByTimeAsync(249);
    expect(getMessagePreviews).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(getMessagePreviews).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('ThreadSelectorComponent delete action', () => {
  function createSelector(options: {
    onDelete?: (thread: AgentControllerThread) => void;
    threads?: AgentControllerThread[];
  }) {
    return new ThreadSelectorComponent({
      tui: { requestRender: vi.fn() } as any,
      threads: options.threads ?? [createThread('thread-1', 0), createThread('thread-2', 1)],
      currentThreadId: null,
      currentResourceId: 'resource-1',
      currentProjectPath: undefined,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
      onDelete: options.onDelete,
    });
  }

  it('invokes onDelete with the selected thread when Ctrl+D is pressed', () => {
    const onDelete = vi.fn();
    const selector = createSelector({ onDelete });

    selector.handleInput('DOWN');
    selector.handleInput('CTRL+D');

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0]![0].id).toBe('thread-2');
  });

  it('does not invoke onDelete when the filtered list is empty', () => {
    const onDelete = vi.fn();
    const selector = createSelector({ onDelete, threads: [] });

    selector.handleInput('CTRL+D');

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('does not throw on Ctrl+D when no onDelete callback is provided', () => {
    const selector = createSelector({});

    expect(() => selector.handleInput('CTRL+D')).not.toThrow();
  });

  it('shows the delete hint only when onDelete is provided', () => {
    const withDelete = createSelector({ onDelete: vi.fn() });
    const withoutDelete = createSelector({});

    const hintText = (selector: ThreadSelectorComponent) =>
      ((selector as any).children as Array<{ text?: string }>)
        .map(child => child.text)
        .filter(Boolean)
        .join('\n');

    expect(hintText(withDelete)).toContain('Ctrl+D delete');
    expect(hintText(withoutDelete)).not.toContain('Ctrl+D delete');
  });
});
