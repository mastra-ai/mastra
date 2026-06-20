/**
 * Searchable Slack channel / DM picker component — multi-select.
 * Follows the same pattern as ModelSelectorComponent but adapted for
 * Slack conversations with tabbed channel/DM/group DM views.
 *
 * Space toggles the highlighted item; Enter confirms all selected items
 * (or the highlighted item if none toggled).
 */

import { Box, Container, fuzzyFilter, getKeybindings, Input, Spacer, Text } from '@earendil-works/pi-tui';
import type { Focusable, TUI } from '@earendil-works/pi-tui';
import type { SlackSignalsConversation } from '@mastra/slack-signals';
import chalk from 'chalk';
import { theme } from '../theme.js';

// =============================================================================
// Types
// =============================================================================

export interface SlackChannelPickerOptions {
  tui: TUI;
  conversations: SlackSignalsConversation[];
  subscribedIds?: Set<string>;
  title?: string;
  loadingMessage?: string;
  onConfirm: (conversations: SlackSignalsConversation[]) => void;
  onCancel: () => void;
}

type ConversationView = 'channels' | 'dms' | 'group-dms';

const VIEW_LABELS: Record<ConversationView, string> = {
  channels: 'Channels',
  dms: 'DMs',
  'group-dms': 'Group DMs',
};

// =============================================================================
// SlackChannelPickerComponent
// =============================================================================

export class SlackChannelPickerComponent extends Box implements Focusable {
  private searchInput!: Input;
  private listContainer!: Container;
  private viewTabs!: Text;
  private currentView: ConversationView = 'channels';
  private allConversations: SlackSignalsConversation[];
  private filteredConversations: SlackSignalsConversation[];
  private subscribedIds: Set<string>;
  /** IDs toggled for the current multi-select session */
  private selectedIds: Set<string>;
  private highlightedIndex = 0;
  private onConfirmCallback: (conversations: SlackSignalsConversation[]) => void;
  private onCancelCallback: () => void;
  private tui: TUI;
  private title: string;
  private loadingMessage: string;

  // Loading state — when true, the list shows a loading message
  private isLoading = false;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(options: SlackChannelPickerOptions) {
    super(4, 1, text => theme.bg('overlayBg', text));

    this.tui = options.tui;
    this.title = options.title ?? 'Select Slack Channel or DM';
    this.loadingMessage = options.loadingMessage ?? '';
    // Only filter/sort if we have data; otherwise show loading state
    this.allConversations = options.conversations.length > 0
      ? options.conversations.filter(c => !c.isArchived)
      : [];
    this.subscribedIds = options.subscribedIds ?? new Set();
    this.selectedIds = new Set(this.subscribedIds);
    this.onConfirmCallback = options.onConfirm;
    this.onCancelCallback = options.onCancel;
    this.isLoading = options.conversations.length === 0 && !!options.loadingMessage;
    this.filteredConversations = this.isLoading ? [] : this.getViewConversations('channels');

    this.buildUI();
  }

  /**
   * Populate the picker with loaded conversations, replacing any loading state.
   */
  setConversations(conversations: SlackSignalsConversation[]): void {
    this.allConversations = conversations.filter(c => !c.isArchived);
    this.isLoading = false;
    this.loadingMessage = '';
    this.filteredConversations = this.getViewConversations(this.currentView);
    this.renderViewTabs();
    this.updateList();
    this.tui.requestRender();
  }

  private getViewConversations(view: ConversationView): SlackSignalsConversation[] {
    return this.allConversations.filter(conv => {
      switch (view) {
        case 'channels':
          return (conv.type === 'public_channel' || conv.type === 'private_channel') && conv.isMember !== false;
        case 'dms':
          return conv.type === 'im';
        case 'group-dms':
          return conv.type === 'mpim';
      }
    }).sort((a, b) => {
      // Subscribed conversations float to the top
      const aSub = this.subscribedIds.has(a.id) ? 0 : 1;
      const bSub = this.subscribedIds.has(b.id) ? 0 : 1;
      return aSub - bSub;
    });
  }

  private buildUI(): void {
    // Title
    this.addChild(new Text(theme.bold(theme.fg('accent', this.title)), 0, 0));
    this.addChild(new Spacer(1));

    // View tabs
    this.viewTabs = new Text('', 0, 0);
    this.renderViewTabs();
    this.addChild(this.viewTabs);
    this.addChild(new Spacer(1));

    // Hint
    this.addChild(
      new Text(theme.fg('muted', 'Type to search · Tab switch view · ↑↓ navigate · Space toggle · Enter confirm · Esc cancel'), 0, 0),
    );
    this.addChild(new Spacer(1));

    // Search input
    this.searchInput = new Input();
    this.searchInput.onSubmit = () => {
      this.confirmSelection();
    };
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));

    // List container
    this.listContainer = new Container();
    this.addChild(this.listContainer);

    // Initial render
    this.updateList();
  }

  private renderViewTabs(): void {
    const tabs = (['channels', 'dms', 'group-dms'] as ConversationView[])
      .map(view => {
        const label = VIEW_LABELS[view];
        const count = this.getViewConversations(view).length;
        const tabText = `${label} (${count})`;
        return view === this.currentView
          ? chalk.bgHex('#7f45e0').white.bold(` ${tabText} `)
          : theme.fg('muted', ` ${tabText} `);
      });
    this.viewTabs.setText(tabs.join(''));
  }

  private cycleView(): void {
    const views: ConversationView[] = ['channels', 'dms', 'group-dms'];
    const currentIndex = views.indexOf(this.currentView);
    const newIndex = (currentIndex + 1) % views.length;
    this.currentView = views[newIndex]!;
    this.highlightedIndex = 0;
    this.searchInput.setValue('');
    this.filteredConversations = this.getViewConversations(this.currentView);
    this.renderViewTabs();
    this.updateList();
    this.tui.requestRender();
  }

  private filterConversations(query: string): void {
    const candidates = this.getViewConversations(this.currentView);
    this.filteredConversations = query
      ? fuzzyFilter(candidates, query, conv => `${conv.name ?? ''} ${conv.id} ${conv.type}`)
      : candidates;

    const totalItems = this.filteredConversations.length;
    this.highlightedIndex = Math.min(this.highlightedIndex, Math.max(0, totalItems - 1));
    this.updateList();
  }

  private toggleSelection(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.updateList();
  }

  private confirmSelection(): void {
    // Build the list from selectedIds — reference is stable, IDs checked individually
    const selected: SlackSignalsConversation[] = [];
    for (const id of this.selectedIds) {
      const item = this.allConversations.find(c => c.id === id);
      if (item) selected.push(item);
    }

    // If nothing was toggled, fall back to the highlighted item
    if (selected.length === 0) {
      const item = this.filteredConversations[this.highlightedIndex];
      if (item) {
        this.onConfirmCallback([item]);
        return;
      }
      this.onCancelCallback();
      return;
    }

    this.onConfirmCallback(selected);
  }

  private updateList(): void {
    this.listContainer.clear();

    // Loading state
    if (this.isLoading && this.loadingMessage) {
      this.listContainer.addChild(new Text(theme.fg('accent', this.loadingMessage), 0, 0));
      return;
    }

    const totalItems = this.filteredConversations.length;
    const maxVisible = 12;
    const startIndex = Math.max(0, Math.min(this.highlightedIndex - Math.floor(maxVisible / 2), totalItems - maxVisible));
    const endIndex = Math.min(startIndex + maxVisible, totalItems);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredConversations[i];
      if (!item) continue;

      const isHighlighted = i === this.highlightedIndex;
      const isSelected = this.selectedIds.has(item.id);
      const isSubscribed = this.subscribedIds.has(item.id);
      const name = item.name ?? item.id;
      const prefix = this.currentView === 'dms' || this.currentView === 'group-dms' ? '' : '#';
      const subscribedMark = isSubscribed ? theme.fg('success', ' ●') : '';

      // Selection checkbox / indicator
      const checkMark = isSelected ? chalk.green('✓') : ' ';
      let line: string;
      if (isHighlighted) {
        line = theme.fg('accent', `→ [${checkMark}] ${prefix}${name}`) + subscribedMark;
      } else {
        line = `  [${checkMark}] ${prefix}${name}` + subscribedMark;
      }

      // Show type badge for DMs (since they have opaque IDs)
      if (this.currentView === 'dms' && !item.name) {
        line += theme.fg('muted', ` (user ${item.id})`);
      }

      this.listContainer.addChild(new Text(line, 0, 0));
    }

    // Scroll indicator
    if (startIndex > 0 || endIndex < totalItems) {
      const scrollInfo = theme.fg('muted', `(${this.highlightedIndex + 1}/${totalItems})`);
      this.listContainer.addChild(new Text(scrollInfo, 0, 0));
    }

    // Empty state
    if (totalItems === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', 'No matching conversations'), 0, 0));
    }

    // Selection count footer
    const totalToggled = this.selectedIds.size;
    if (totalToggled > 0) {
      this.listContainer.addChild(new Text(theme.fg('accent', `\n${totalToggled} selected - Enter to confirm`), 0, 0));
    }
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();

    // Escape or Ctrl+C should always work, including while loading.
    if (kb.matches(keyData, 'tui.select.cancel') || keyData === '\u0003' || keyData === '\u001b') {
      this.onCancelCallback();
      return;
    }

    // While loading, ignore non-cancel input but don't pass it to the search input.
    if (this.isLoading) {
      return;
    }

    const totalItems = this.filteredConversations.length;

    // Tab to cycle view tabs
    if (keyData === '\t') {
      this.cycleView();
      return;
    }
    // Space to toggle
    if (keyData === ' ') {
      const item = this.filteredConversations[this.highlightedIndex];
      if (item) {
        this.toggleSelection(item.id);
        this.tui.requestRender();
      }
      return;
    }
    // Up arrow
    if (kb.matches(keyData, 'tui.select.up')) {
      if (totalItems === 0) return;
      this.highlightedIndex = this.highlightedIndex === 0 ? totalItems - 1 : this.highlightedIndex - 1;
      this.updateList();
      this.tui.requestRender();
      return;
    }
    // Down arrow
    if (kb.matches(keyData, 'tui.select.down')) {
      if (totalItems === 0) return;
      this.highlightedIndex = this.highlightedIndex === totalItems - 1 ? 0 : this.highlightedIndex + 1;
      this.updateList();
      this.tui.requestRender();
      return;
    }
    // Enter
    if (kb.matches(keyData, 'tui.select.confirm')) {
      this.confirmSelection();
      return;
    }
    // Escape or Ctrl+C
    if (kb.matches(keyData, 'tui.select.cancel')) {
      this.onCancelCallback();
      return;
    }
    // Pass everything else to search input
    this.searchInput.handleInput(keyData);
    this.filterConversations(this.searchInput.getValue());
    this.tui.requestRender();
  }
}
