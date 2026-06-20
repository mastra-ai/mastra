/**
 * Searchable Slack channel / DM picker component.
 * Follows the same pattern as ModelSelectorComponent but adapted for
 * Slack conversations with tabbed channel/DM/group DM views.
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
  onSelect: (conversation: SlackSignalsConversation) => void;
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
  /** Index into conversationViews — [channels, dms, group-dms] */
  private viewTabs!: Text;
  private currentView: ConversationView = 'channels';
  private allConversations: SlackSignalsConversation[];
  private filteredConversations: SlackSignalsConversation[];
  private subscribedIds: Set<string>;
  private selectedIndex = 0;
  private onSelectCallback: (conversation: SlackSignalsConversation) => void;
  private onCancelCallback: () => void;
  private tui: TUI;
  private title: string;

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
    // Box with padding and background — slightly wider than model selector
    super(4, 1, text => theme.bg('overlayBg', text));

    this.tui = options.tui;
    this.title = options.title ?? 'Select Slack Channel or DM';
    this.allConversations = options.conversations;
    this.subscribedIds = options.subscribedIds ?? new Set();
    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;
    this.filteredConversations = this.getViewConversations('channels');

    this.buildUI();
  }

  private getViewConversations(view: ConversationView): SlackSignalsConversation[] {
    return this.allConversations.filter(conv => {
      switch (view) {
        case 'channels':
          return conv.type === 'public_channel' || conv.type === 'private_channel';
        case 'dms':
          return conv.type === 'im';
        case 'group-dms':
          return conv.type === 'mpim';
      }
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
      new Text(theme.fg('muted', 'Type to search • Tab switch view • ↑↓ navigate • Enter select • Esc cancel'), 0, 0),
    );
    this.addChild(new Spacer(1));

    // Search input
    this.searchInput = new Input();
    this.searchInput.onSubmit = () => {
      const selected = this.filteredConversations[this.selectedIndex];
      if (selected) this.handleSelect(selected);
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
    this.selectedIndex = 0;
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
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, totalItems - 1));
    this.updateList();
  }

  private updateList(): void {
    this.listContainer.clear();

    const totalItems = this.filteredConversations.length;
    const maxVisible = 12;
    const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), totalItems - maxVisible));
    const endIndex = Math.min(startIndex + maxVisible, totalItems);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredConversations[i];
      if (!item) continue;

      const isSelected = i === this.selectedIndex;
      const isSubscribed = this.subscribedIds.has(item.id);
      const name = item.name ?? item.id;
      const prefix = this.currentView === 'dms' || this.currentView === 'group-dms' ? '' : '#';
      const subscribedMark = isSubscribed ? theme.fg('success', ' ●') : '';

      let line: string;
      if (isSelected) {
        line = theme.fg('accent', `→ ${prefix}${name}`) + subscribedMark;
      } else {
        line = `  ${prefix}${name}` + subscribedMark;
      }

      // Show type badge for DMs (since they have opaque IDs)
      if (this.currentView === 'dms' && !item.name) {
        line += theme.fg('muted', ` (user ${item.id})`);
      }

      this.listContainer.addChild(new Text(line, 0, 0));
    }

    // Scroll indicator
    if (startIndex > 0 || endIndex < totalItems) {
      const scrollInfo = theme.fg('muted', `(${this.selectedIndex + 1}/${totalItems})`);
      this.listContainer.addChild(new Text(scrollInfo, 0, 0));
    }

    // Empty state
    if (totalItems === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', 'No matching conversations'), 0, 0));
    }
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    const totalItems = this.filteredConversations.length;

    // Tab to cycle view tabs
    if (keyData === '\t') {
      this.cycleView();
      return;
    }
    // Up arrow
    if (kb.matches(keyData, 'tui.select.up')) {
      if (totalItems === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? totalItems - 1 : this.selectedIndex - 1;
      this.updateList();
      this.tui.requestRender();
      return;
    }
    // Down arrow
    if (kb.matches(keyData, 'tui.select.down')) {
      if (totalItems === 0) return;
      this.selectedIndex = this.selectedIndex === totalItems - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
      this.tui.requestRender();
      return;
    }
    // Enter
    if (kb.matches(keyData, 'tui.select.confirm')) {
      const selected = this.filteredConversations[this.selectedIndex];
      if (selected) this.handleSelect(selected);
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

  private handleSelect(conversation: SlackSignalsConversation): void {
    this.onSelectCallback(conversation);
  }
}
