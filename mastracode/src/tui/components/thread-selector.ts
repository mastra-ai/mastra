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
  /** Current project root path — threads tagged with this directory sort above other same-resource threads */
  currentProjectPath?: string;
  onSelect: (thread: HarnessThread) => void;
  onCancel: () => void;
  /** Called when user presses 'c' to clone the selected thread */
  onClone?: (thread: HarnessThread) => void;
  /** Function to fetch message previews for currently visible threads */
  getMessagePreviews?: (threadIds: string[]) => Promise<Map<string, string>>;
  initialMessagePreviews?: Map<string, string>;
  initialAttemptedPreviewThreadIds?: Set<string>;
  onMessagePreviewsLoaded?: (previews: Map<string, string>, attemptedThreadIds: Set<string>) => void;
}

const MAX_VISIBLE_THREADS = 12;
const INITIAL_PREVIEW_LOAD_COUNT = 24;
const PREVIEW_BATCH_SIZE = 2;
const INITIAL_PREVIEW_LOAD_DELAY_MS = 150;
const INTERACTION_PREVIEW_LOAD_DELAY_MS = 250;
const FOLLOW_UP_PREVIEW_LOAD_DELAY_MS = 50;

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
  private currentProjectPath: string | undefined;
  private onSelectCallback: (thread: HarnessThread) => void;
  private onCancelCallback: () => void;
  private onCloneCallback: ((thread: HarnessThread) => void) | undefined;
  private tui: TUI;
  private getMessagePreviews: ((threadIds: string[]) => Promise<Map<string, string>>) | undefined;
  private onMessagePreviewsLoaded:
    | ((previews: Map<string, string>, attemptedThreadIds: Set<string>) => void)
    | undefined;
  private messagePreviews: Map<string, string>;
  private attemptedPreviewThreadIds: Set<string>;
  private loadingPreviewThreadIds: Set<string> = new Set();
  private previewLoadVersion = 0;
  private previewLoadTimeout: ReturnType<typeof setTimeout> | null = null;

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
    this.currentProjectPath = options.currentProjectPath;
    this.allThreads = this.sortThreads(options.threads, options.currentThreadId);
    this.currentThreadId = options.currentThreadId;
    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;
    this.onCloneCallback = options.onClone;
    this.getMessagePreviews = options.getMessagePreviews;
    this.onMessagePreviewsLoaded = options.onMessagePreviewsLoaded;
    this.messagePreviews = new Map(options.initialMessagePreviews ?? []);
    this.attemptedPreviewThreadIds = new Set(options.initialAttemptedPreviewThreadIds ?? []);
    this.filteredThreads = this.allThreads;

    this.buildUI();
    this.scheduleMessagePreviewLoad({ initialLoad: true });
  }

  private getVisibleRange(): { startIndex: number; endIndex: number } {
    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(MAX_VISIBLE_THREADS / 2),
        this.filteredThreads.length - MAX_VISIBLE_THREADS,
      ),
    );
    const endIndex = Math.min(startIndex + MAX_VISIBLE_THREADS, this.filteredThreads.length);
    return { startIndex, endIndex };
  }

  private getVisibleThreads(): HarnessThread[] {
    const { startIndex, endIndex } = this.getVisibleRange();
    return this.filteredThreads.slice(startIndex, endIndex);
  }

  private getPreviewCandidates(initialLoad: boolean): HarnessThread[] {
    const initialThreads = initialLoad ? this.filteredThreads.slice(0, INITIAL_PREVIEW_LOAD_COUNT) : [];
    const combinedThreads = [...initialThreads, ...this.getVisibleThreads()];
    const uniqueThreads = combinedThreads.filter(
      (thread, index, threads) => threads.findIndex(t => t.id === thread.id) === index,
    );

    const prioritizedThreads = uniqueThreads.filter(
      thread =>
        thread.resourceId === this.currentResourceId &&
        typeof thread.metadata?.projectPath === 'string' &&
        thread.metadata.projectPath === this.currentProjectPath,
    );
    const remainingThreads = uniqueThreads.filter(thread => !prioritizedThreads.some(t => t.id === thread.id));

    return [...prioritizedThreads, ...remainingThreads].filter(
      thread =>
        !this.messagePreviews.has(thread.id) &&
        !this.attemptedPreviewThreadIds.has(thread.id) &&
        !this.loadingPreviewThreadIds.has(thread.id),
    );
  }

  private scheduleMessagePreviewLoad({
    initialLoad = false,
    delayMs,
  }: { initialLoad?: boolean; delayMs?: number } = {}): void {
    const previewDelayMs = delayMs ?? (initialLoad ? INITIAL_PREVIEW_LOAD_DELAY_MS : FOLLOW_UP_PREVIEW_LOAD_DELAY_MS);

    if (this.previewLoadTimeout) {
      clearTimeout(this.previewLoadTimeout);
    }

    this.previewLoadTimeout = setTimeout(() => {
      this.previewLoadTimeout = null;
      void this.loadMessagePreviews({ initialLoad });
    }, previewDelayMs);
  }

  private async loadMessagePreviews({ initialLoad = false }: { initialLoad?: boolean } = {}): Promise<void> {
    if (!this.getMessagePreviews) return;

    const version = ++this.previewLoadVersion;
    const candidates = this.getPreviewCandidates(initialLoad);
    const threadIds = candidates.slice(0, PREVIEW_BATCH_SIZE).map(thread => thread.id);

    if (threadIds.length === 0) return;

    threadIds.forEach(threadId => this.loadingPreviewThreadIds.add(threadId));
    this.updateList();
    this.tui.requestRender();

    try {
      const previews = await this.getMessagePreviews(threadIds);
      if (version !== this.previewLoadVersion) return;

      threadIds.forEach(threadId => this.attemptedPreviewThreadIds.add(threadId));

      for (const [threadId, preview] of previews) {
        if (preview) {
          this.messagePreviews.set(threadId, preview);
        }
      }

      this.onMessagePreviewsLoaded?.(new Map(this.messagePreviews), new Set(this.attemptedPreviewThreadIds));
    } catch {
      // Ignore errors, previews will just be empty
    } finally {
      threadIds.forEach(threadId => this.loadingPreviewThreadIds.delete(threadId));
    }

    this.updateList();
    this.tui.requestRender();

    if (candidates.length > PREVIEW_BATCH_SIZE) {
      this.scheduleMessagePreviewLoad({ initialLoad, delayMs: FOLLOW_UP_PREVIEW_LOAD_DELAY_MS });
    }
  }

  private buildUI(): void {
    this.addChild(new Text(theme.bold(theme.fg('accent', 'Select Thread')), 0, 0));
    this.addChild(new Spacer(1));
    const cloneHint = this.onCloneCallback ? ' • c clone' : '';
    this.addChild(
      new Text(theme.fg('muted', `Type to search • ↑↓ navigate • Enter select${cloneHint} • Esc cancel`), 0, 0),
    );
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
    const projPath = this.currentProjectPath;
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
      // Within the same resource, threads tagged with the current directory first
      if (projPath && a.resourceId === b.resourceId) {
        const aDir = typeof a.metadata?.projectPath === 'string' && a.metadata.projectPath === projPath;
        const bDir = typeof b.metadata?.projectPath === 'string' && b.metadata.projectPath === projPath;
        if (aDir && !bDir) return -1;
        if (!aDir && bDir) return 1;
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
          t =>
            `${t.title ?? ''} ${t.resourceId} ${t.id} ${typeof t.metadata?.projectPath === 'string' ? t.metadata.projectPath : ''}`,
        )
      : this.allThreads;

    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredThreads.length - 1));
    this.updateList();
    this.scheduleMessagePreviewLoad({ initialLoad: true });
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

    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(MAX_VISIBLE_THREADS / 2),
        this.filteredThreads.length - MAX_VISIBLE_THREADS,
      ),
    );
    const endIndex = Math.min(startIndex + MAX_VISIBLE_THREADS, this.filteredThreads.length);

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

      // Show thread title when available, except the default placeholder title.
      const displayTitle = thread.title && thread.title !== 'New Thread' ? thread.title : null;

      let line = '';
      if (isSelected) {
        line = theme.fg('accent', `→ ${displayId}`) + pathTag + timeAgo + checkmark;
      } else {
        line = `  ${displayId}` + pathTag + timeAgo + checkmark;
      }

      this.listContainer.addChild(new Text(line, 0, 0));

      if (displayTitle) {
        this.listContainer.addChild(new Text(`     ${theme.fg('muted', displayTitle)}`, 0, 0));
      } else {
        const preview = this.messagePreviews.get(thread.id);
        if (preview) {
          this.listContainer.addChild(new Text(`     ${theme.fg('dim', `"${preview}"`)}`, 0, 0));
        }
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
      this.scheduleMessagePreviewLoad({ delayMs: INTERACTION_PREVIEW_LOAD_DELAY_MS });
    } else if (kb.matches(keyData, 'selectDown')) {
      if (this.filteredThreads.length === 0) return;
      this.selectedIndex = this.selectedIndex === this.filteredThreads.length - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
      this.tui.requestRender();
      this.scheduleMessagePreviewLoad({ delayMs: INTERACTION_PREVIEW_LOAD_DELAY_MS });
    } else if (kb.matches(keyData, 'selectConfirm')) {
      const selected = this.filteredThreads[this.selectedIndex];
      if (selected) {
        this.onSelectCallback(selected);
      }
    } else if (kb.matches(keyData, 'selectCancel')) {
      this.onCancelCallback();
    } else if (keyData === 'c' && this.onCloneCallback && !this.searchInput.getValue()) {
      const selected = this.filteredThreads[this.selectedIndex];
      if (selected) {
        this.onCloneCallback(selected);
      }
    } else {
      this.searchInput.handleInput(keyData);
      this.filterThreads(this.searchInput.getValue());
      this.tui.requestRender();
      this.scheduleMessagePreviewLoad({ delayMs: INTERACTION_PREVIEW_LOAD_DELAY_MS });
    }
  }
}
