/**
 * Thread selector component for switching between conversation threads.
 * Uses pi-tui overlay pattern with search and navigation.
 */

import { Box, Container, fuzzyFilter, getEditorKeybindings, Input, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, TUI } from '@mariozechner/pi-tui';
import type { HarnessThread } from '@mastra/core/harness';
import { theme } from '../theme.js';

// =============================================================================
// Types
// =============================================================================

export interface ThreadSelectorOptions {
  tui: TUI;
  threads: HarnessThread[];
  currentThreadId: string | null;
  /** Current resource ID — threads from this resource sort to the top */
  currentResourceId?: string;
  onSelect: (thread: HarnessThread) => void;
  onCancel: () => void;
  /** Function to fetch message preview for a thread */
  getMessagePreview?: (threadId: string) => Promise<string | null>;
}

// =============================================================================
// ThreadSelectorComponent
// =============================================================================

export class ThreadSelectorComponent extends Box implements Focusable {
  private searchInput!: Input;
  private listContainer!: Container;
  private allThreads: HarnessThread[];
  private filteredThreads: HarnessThread[];
  private selectedIndex = 0;
  private currentThreadId: string | null;
  private currentResourceId: string | undefined;
  private onSelectCallback: (thread: HarnessThread) => void;
  private onCancelCallback: () => void;
  private tui: TUI;
  private getMessagePreview: ((threadId: string) => Promise<string | null>) | undefined;
  private messagePreviews: Map<string, string> = new Map();

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(options: ThreadSelectorOptions) {
    super(2, 1, text => theme.bg('overlayBg', text));

    this.tui = options.tui;
    this.currentResourceId = options.currentResourceId;
    this.allThreads = this.sortThreads(options.threads, options.currentThreadId);
    this.currentThreadId = options.currentThreadId;
    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;
    this.getMessagePreview = options.getMessagePreview;
    this.filteredThreads = this.allThreads;

    this.buildUI();
    this.loadMessagePreviews();
  }

  private async loadMessagePreviews(): Promise<void> {
    if (!this.getMessagePreview) return;

    // Load previews for all threads
    for (const thread of this.allThreads) {
      try {
        const preview = await this.getMessagePreview(thread.id);
        if (preview) {
          this.messagePreviews.set(thread.id, preview);
        }
      } catch {
        // Ignore errors, preview will just be empty
      }
    }
    this.updateList();
    this.tui.requestRender();
  }

  private buildUI(): void {
    this.addChild(new Text(theme.bold(theme.fg('accent', 'Select Thread')), 0, 0));
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('muted', 'Type to search • ↑↓ navigate • Enter select • Esc cancel'), 0, 0));
    this.addChild(new Spacer(1));

    this.searchInput = new Input();
    this.searchInput.onSubmit = () => {
      const selected = this.filteredThreads[this.selectedIndex];
      if (selected) {
        this.onSelectCallback(selected);
      }
    };
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));

    this.listContainer = new Container();
    this.addChild(this.listContainer);

    this.updateList();
  }

  private sortThreads(threads: HarnessThread[], currentThreadId: string | null): HarnessThread[] {
    const sorted = [...threads];
    const resId = this.currentResourceId;
    sorted.sort((a, b) => {
      // Current thread first
      if (a.id === currentThreadId) return -1;
      if (b.id === currentThreadId) return 1;
      // Current resource threads before other resources
      if (resId) {
        const aLocal = a.resourceId === resId;
        const bLocal = b.resourceId === resId;
        if (aLocal && !bLocal) return -1;
        if (!aLocal && bLocal) return 1;
      }
      // Then by most recently updated
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return sorted;
  }

  private filterThreads(query: string): void {
    this.filteredThreads = query
      ? fuzzyFilter(
          this.allThreads,
          query,
          t => `${t.title ?? ''} ${t.resourceId} ${t.id} ${(t.metadata?.projectPath as string) ?? ''}`,
        )
      : this.allThreads;

    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredThreads.length - 1));
    this.updateList();
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  private updateList(): void {
    this.listContainer.clear();

    const maxVisible = 12;
    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(maxVisible / 2), this.filteredThreads.length - maxVisible),
    );
    const endIndex = Math.min(startIndex + maxVisible, this.filteredThreads.length);

    for (let i = startIndex; i < endIndex; i++) {
      const thread = this.filteredThreads[i];
      if (!thread) continue;

      const isSelected = i === this.selectedIndex;
      const isCurrent = thread.id === this.currentThreadId;
      const checkmark = isCurrent ? theme.fg('success', ' ✓') : '';
      const shortId = thread.id.slice(-6);
      const threadPath = thread.metadata?.projectPath as string | undefined;
      const pathTag = threadPath ? theme.fg('dim', ` [${threadPath.split('/').pop()}]`) : '';
      const displayId = `${thread.resourceId}/${shortId}`;
      const timeAgo = theme.fg('muted', ` (${this.formatTimeAgo(thread.updatedAt)})`);

      // Only show custom titles (not auto-generated "New Thread")
      const hasCustomTitle = thread.title && thread.title !== 'New Thread';

      let line = '';
      if (isSelected) {
        line = theme.fg('accent', `→ ${displayId}`) + pathTag + timeAgo + checkmark;
      } else {
        line = `  ${displayId}` + pathTag + timeAgo + checkmark;
      }

      this.listContainer.addChild(new Text(line, 0, 0));

      // Show message preview or custom title on second line
      const preview = this.messagePreviews.get(thread.id);
      if (preview) {
        this.listContainer.addChild(new Text(`     ${theme.fg('muted', `"${preview}"`)}`, 0, 0));
      } else if (hasCustomTitle) {
        this.listContainer.addChild(new Text(`     ${theme.fg('muted', `"${thread.title}"`)}`, 0, 0));
      }
    }

    if (startIndex > 0 || endIndex < this.filteredThreads.length) {
      const scrollInfo = theme.fg('muted', `(${this.selectedIndex + 1}/${this.filteredThreads.length})`);
      this.listContainer.addChild(new Text(scrollInfo, 0, 0));
    }

    if (this.filteredThreads.length === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', 'No matching threads'), 0, 0));
    }
  }

  handleInput(keyData: string): void {
    const kb = getEditorKeybindings();

    if (kb.matches(keyData, 'selectUp')) {
      if (this.filteredThreads.length === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? this.filteredThreads.length - 1 : this.selectedIndex - 1;
      this.updateList();
      this.tui.requestRender();
    } else if (kb.matches(keyData, 'selectDown')) {
      if (this.filteredThreads.length === 0) return;
      this.selectedIndex = this.selectedIndex === this.filteredThreads.length - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
      this.tui.requestRender();
    } else if (kb.matches(keyData, 'selectConfirm')) {
      const selected = this.filteredThreads[this.selectedIndex];
      if (selected) {
        this.onSelectCallback(selected);
      }
    } else if (kb.matches(keyData, 'selectCancel')) {
      this.onCancelCallback();
    } else {
      this.searchInput.handleInput(keyData);
      this.filterThreads(this.searchInput.getValue());
      this.tui.requestRender();
    }
  }
}
