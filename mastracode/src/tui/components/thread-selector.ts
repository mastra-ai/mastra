/**
 * Thread selector component for switching between conversation threads.
 * Uses SearchableListOverlay for search and navigation.
 */

import { Text } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';
import type { HarnessThread } from '@mastra/core/harness';
import { SearchableListOverlay } from './searchable-list-overlay.js';
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

export class ThreadSelectorComponent extends SearchableListOverlay<HarnessThread> {
  private currentThreadId: string | null;
  private currentResourceId: string | undefined;
  private onSelectCallback: (thread: HarnessThread) => void;
  private onCancelCallback: () => void;
  private getMessagePreview: ((threadId: string) => Promise<string | null>) | undefined;
  private messagePreviews: Map<string, string> = new Map();

  constructor(options: ThreadSelectorOptions) {
    const sorted = ThreadSelectorComponent.sortThreads(
      options.threads,
      options.currentThreadId,
      options.currentResourceId,
    );

    super(
      {
        tui: options.tui,
        title: 'Select Thread',
      },
      sorted,
    );

    this.currentThreadId = options.currentThreadId;
    this.currentResourceId = options.currentResourceId;
    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;
    this.getMessagePreview = options.getMessagePreview;

    this.loadMessagePreviews();
  }

  // ---------------------------------------------------------------------------
  // SearchableListOverlay implementation
  // ---------------------------------------------------------------------------

  protected getSearchableText(thread: HarnessThread): string {
    return `${thread.title ?? ''} ${thread.resourceId} ${thread.id} ${(thread.metadata?.projectPath as string) ?? ''}`;
  }

  protected renderItem(thread: HarnessThread, _index: number, isSelected: boolean): Text[] {
    const isCurrent = thread.id === this.currentThreadId;
    const checkmark = isCurrent ? theme.fg('success', ' ✓') : '';
    const shortId = thread.id.slice(-6);
    const threadPath = thread.metadata?.projectPath as string | undefined;
    const pathTag = threadPath ? theme.fg('dim', ` [${threadPath.split('/').pop()}]`) : '';
    const displayId = `${thread.resourceId}/${shortId}`;
    const timeAgo = theme.fg('muted', ` (${this.formatTimeAgo(thread.updatedAt)})`);

    let line = '';
    if (isSelected) {
      line = theme.fg('accent', `→ ${displayId}`) + pathTag + timeAgo + checkmark;
    } else {
      line = `  ${displayId}` + pathTag + timeAgo + checkmark;
    }

    const texts: Text[] = [new Text(line, 0, 0)];

    // Show message preview or custom title on second line
    const hasCustomTitle = thread.title && thread.title !== 'New Thread';
    const preview = this.messagePreviews.get(thread.id);
    if (preview) {
      texts.push(new Text(`     ${theme.fg('muted', `"${preview}"`)}`, 0, 0));
    } else if (hasCustomTitle) {
      texts.push(new Text(`     ${theme.fg('muted', `"${thread.title}"`)}`, 0, 0));
    }

    return texts;
  }

  protected onSelect(thread: HarnessThread): void {
    this.onSelectCallback(thread);
  }

  protected onCancel(): void {
    this.onCancelCallback();
  }

  protected getEmptyMessage(): string {
    return 'No matching threads';
  }

  // ---------------------------------------------------------------------------
  // Async message previews
  // ---------------------------------------------------------------------------

  private async loadMessagePreviews(): Promise<void> {
    if (!this.getMessagePreview) return;

    for (const thread of this.allItems) {
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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

  private static sortThreads(
    threads: HarnessThread[],
    currentThreadId: string | null,
    currentResourceId?: string,
  ): HarnessThread[] {
    const sorted = [...threads];
    sorted.sort((a, b) => {
      // Current thread first
      if (a.id === currentThreadId) return -1;
      if (b.id === currentThreadId) return 1;
      // Current resource threads before other resources
      if (currentResourceId) {
        const aLocal = a.resourceId === currentResourceId;
        const bLocal = b.resourceId === currentResourceId;
        if (aLocal && !bLocal) return -1;
        if (!aLocal && bLocal) return 1;
      }
      // Then by most recently updated
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    return sorted;
  }
}
