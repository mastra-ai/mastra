import { Box, Container, fuzzyFilter, getKeybindings, Input, Spacer, Text } from '@earendil-works/pi-tui';
import type { Focusable, TUI } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { theme } from '../theme.js';

export interface GithubPRPickerItem {
  owner?: string;
  repo?: string;
  number: number;
  title?: string;
  author?: string;
  updatedAt?: string;
  url?: string;
  headRefName?: string;
  baseRefName?: string;
}

export interface GithubPRPickerOptions {
  tui: TUI;
  pullRequests: GithubPRPickerItem[];
  searchPullRequests?: GithubPRPickerItem[];
  subscribedIds?: Set<string>;
  title?: string;
  loadingMessage?: string;
  errorMessage?: string;
  onConfirm: (pullRequests: GithubPRPickerItem[]) => void;
  onCancel: () => void;
}

type PRView = 'mine' | 'search';

const VIEW_LABELS: Record<PRView, string> = {
  mine: 'My open PRs',
  search: 'Search repo',
};

export function githubPRId(pr: { owner?: string; repo?: string; number: number }): string {
  return pr.owner && pr.repo ? `${pr.owner}/${pr.repo}#${pr.number}` : `#${pr.number}`;
}

function legacyGithubPRId(pr: { number: number }): string {
  return `#${pr.number}`;
}

function githubPRIdMatches(
  id: string,
  pr: { owner?: string; repo?: string; number: number },
  candidates: Array<{ owner?: string; repo?: string; number: number }> = [pr],
): boolean {
  if (id === githubPRId(pr)) return true;
  if (id !== legacyGithubPRId(pr)) return false;

  const matchingRepos = new Set(
    candidates
      .filter(candidate => candidate.number === pr.number && candidate.owner && candidate.repo)
      .map(candidate => `${candidate.owner}/${candidate.repo}`),
  );
  return matchingRepos.size <= 1;
}

function formatUpdatedAt(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export class GithubPRPickerDialog extends Box implements Focusable {
  private searchInput!: Input;
  private listContainer!: Container;
  private viewTabs!: Text;
  private currentView: PRView = 'mine';
  private myPullRequests: GithubPRPickerItem[];
  private searchPullRequests: GithubPRPickerItem[];
  private filteredPullRequests: GithubPRPickerItem[];
  private subscribedIds: Set<string>;
  private selectedIds: Set<string>;
  private highlightedIndex = 0;
  private readonly tui: TUI;
  private readonly title: string;
  private loadingMessage: string;
  private errorMessage: string;
  private isLoading = false;
  private readonly onConfirmCallback: (pullRequests: GithubPRPickerItem[]) => void;
  private readonly onCancelCallback: () => void;
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(options: GithubPRPickerOptions) {
    super(4, 1, text => theme.bg('overlayBg', text));
    this.tui = options.tui;
    this.title = options.title ?? 'Select GitHub PRs';
    this.myPullRequests = options.pullRequests;
    this.searchPullRequests = options.searchPullRequests ?? [];
    this.subscribedIds = options.subscribedIds ?? new Set();
    this.selectedIds = new Set(this.subscribedIds);
    this.loadingMessage = options.loadingMessage ?? '';
    this.errorMessage = options.errorMessage ?? '';
    this.isLoading = options.pullRequests.length === 0 && !!options.loadingMessage;
    this.onConfirmCallback = options.onConfirm;
    this.onCancelCallback = options.onCancel;
    this.filteredPullRequests = this.isLoading ? [] : this.getViewPullRequests(this.currentView);
    this.buildUI();
  }

  setPullRequests(input: { mine: GithubPRPickerItem[]; search?: GithubPRPickerItem[]; errorMessage?: string }): void {
    this.myPullRequests = input.mine;
    this.searchPullRequests = input.search ?? [];
    this.errorMessage = input.errorMessage ?? '';
    this.loadingMessage = '';
    this.isLoading = false;
    this.filteredPullRequests = this.getViewPullRequests(this.currentView);
    this.renderViewTabs();
    this.updateList();
    this.tui.requestRender();
  }

  private get allPullRequests(): GithubPRPickerItem[] {
    const byId = new Map<string, GithubPRPickerItem>();
    for (const pr of [...this.myPullRequests, ...this.searchPullRequests]) byId.set(githubPRId(pr), pr);
    return [...byId.values()];
  }

  private getViewPullRequests(view: PRView): GithubPRPickerItem[] {
    const pullRequests = view === 'mine' ? this.myPullRequests : this.searchPullRequests;
    return [...pullRequests].sort((a, b) => {
      const aSubscribed = this.hasId(this.subscribedIds, a) ? 0 : 1;
      const bSubscribed = this.hasId(this.subscribedIds, b) ? 0 : 1;
      if (aSubscribed !== bSubscribed) return aSubscribed - bSubscribed;
      return b.number - a.number;
    });
  }

  private buildUI(): void {
    this.addChild(new Text(theme.bold(theme.fg('accent', this.title)), 0, 0));
    this.addChild(new Spacer(1));
    this.viewTabs = new Text('', 0, 0);
    this.renderViewTabs();
    this.addChild(this.viewTabs);
    this.addChild(new Spacer(1));
    this.addChild(
      new Text(
        theme.fg('muted', 'Type to search · Tab switch view · ↑↓ navigate · Space toggle · Enter confirm · Esc cancel'),
        0,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.searchInput = new Input();
    this.searchInput.onSubmit = () => this.confirmSelection();
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));
    this.listContainer = new Container();
    this.addChild(this.listContainer);
    this.updateList();
  }

  private renderViewTabs(): void {
    const tabs = (['mine', 'search'] as PRView[]).map(view => {
      const tabText = `${VIEW_LABELS[view]} (${this.getViewPullRequests(view).length})`;
      return view === this.currentView
        ? chalk.bgHex('#7f45e0').white.bold(` ${tabText} `)
        : theme.fg('muted', ` ${tabText} `);
    });
    this.viewTabs.setText(tabs.join(''));
  }

  private cycleView(): void {
    this.currentView = this.currentView === 'mine' ? 'search' : 'mine';
    this.highlightedIndex = 0;
    this.searchInput.setValue('');
    this.filteredPullRequests = this.getViewPullRequests(this.currentView);
    this.renderViewTabs();
    this.updateList();
    this.tui.requestRender();
  }

  private filterPullRequests(query: string): void {
    const candidates = this.getViewPullRequests(this.currentView);
    this.filteredPullRequests = query
      ? fuzzyFilter(candidates, query, pr => `${githubPRId(pr)} ${pr.title ?? ''} ${pr.author ?? ''}`)
      : candidates;
    this.highlightedIndex = Math.min(this.highlightedIndex, Math.max(0, this.filteredPullRequests.length - 1));
    this.updateList();
  }

  private hasId(ids: Set<string>, item: GithubPRPickerItem): boolean {
    const candidates = this.allPullRequests;
    return [...ids].some(id => githubPRIdMatches(id, item, candidates));
  }

  private toggleSelection(item: GithubPRPickerItem): void {
    if (this.hasId(this.selectedIds, item)) {
      const candidates = this.allPullRequests;
      for (const id of [...this.selectedIds]) {
        if (githubPRIdMatches(id, item, candidates)) this.selectedIds.delete(id);
      }
    } else {
      this.selectedIds.add(githubPRId(item));
    }
    this.updateList();
  }

  private getSelectedPullRequests(): GithubPRPickerItem[] {
    const candidates = this.allPullRequests;
    const selectedById = new Map<string, GithubPRPickerItem>();
    for (const id of this.selectedIds) {
      const item = candidates.find(pr => githubPRIdMatches(id, pr, candidates));
      if (item) selectedById.set(githubPRId(item), item);
    }
    return [...selectedById.values()];
  }

  private confirmSelection(): void {
    const selected = this.getSelectedPullRequests();
    if (selected.length > 0) {
      this.onConfirmCallback(selected);
      return;
    }
    const item = this.filteredPullRequests[this.highlightedIndex];
    if (item) this.onConfirmCallback([item]);
    else this.onCancelCallback();
  }

  private updateList(): void {
    this.listContainer.clear();
    if (this.isLoading && this.loadingMessage) {
      this.listContainer.addChild(new Text(theme.fg('accent', this.loadingMessage), 0, 0));
      return;
    }
    if (this.errorMessage) this.listContainer.addChild(new Text(theme.fg('error', this.errorMessage), 0, 0));

    const totalItems = this.filteredPullRequests.length;
    const maxVisible = 12;
    const startIndex = Math.max(
      0,
      Math.min(this.highlightedIndex - Math.floor(maxVisible / 2), totalItems - maxVisible),
    );
    const endIndex = Math.min(startIndex + maxVisible, totalItems);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredPullRequests[i];
      if (!item) continue;
      const id = githubPRId(item);
      const isHighlighted = i === this.highlightedIndex;
      const isSelected = this.hasId(this.selectedIds, item);
      const isSubscribed = this.hasId(this.subscribedIds, item);
      const checkMark = isSelected ? chalk.green('✓') : ' ';
      const title = item.title ? ` ${item.title}` : '';
      const meta = [
        item.author ? `@${item.author}` : undefined,
        formatUpdatedAt(item.updatedAt),
        item.headRefName && item.baseRefName ? `${item.headRefName}→${item.baseRefName}` : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
      const subscribedMark = isSubscribed ? theme.fg('success', ' ●') : '';
      const line = `${isHighlighted ? theme.fg('accent', '→') : ' '} [${checkMark}] ${id}${title}${meta ? theme.fg('muted', ` (${meta})`) : ''}${subscribedMark}`;
      this.listContainer.addChild(new Text(line, 0, 0));
    }

    if (startIndex > 0 || endIndex < totalItems) {
      this.listContainer.addChild(new Text(theme.fg('muted', `(${this.highlightedIndex + 1}/${totalItems})`), 0, 0));
    }
    if (totalItems === 0) {
      this.listContainer.addChild(
        new Text(
          theme.fg(
            'muted',
            this.errorMessage ? 'No PRs loaded. You can still use /github owner/repo#123.' : 'No matching PRs',
          ),
          0,
          0,
        ),
      );
    }
    const selectedCount = this.getSelectedPullRequests().length;
    if (selectedCount > 0) {
      this.listContainer.addChild(new Text(theme.fg('accent', `\n${selectedCount} selected - Enter to confirm`), 0, 0));
    }
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    if (kb.matches(keyData, 'tui.select.cancel') || keyData === '\u0003' || keyData === '\u001b') {
      this.onCancelCallback();
      return;
    }
    if (this.isLoading) return;
    const totalItems = this.filteredPullRequests.length;
    if (keyData === '\t') {
      this.cycleView();
      return;
    }
    if (keyData === ' ') {
      const item = this.filteredPullRequests[this.highlightedIndex];
      if (item) {
        this.toggleSelection(item);
        this.tui.requestRender();
      }
      return;
    }
    if (kb.matches(keyData, 'tui.select.up')) {
      if (totalItems === 0) return;
      this.highlightedIndex = this.highlightedIndex === 0 ? totalItems - 1 : this.highlightedIndex - 1;
      this.updateList();
      this.tui.requestRender();
      return;
    }
    if (kb.matches(keyData, 'tui.select.down')) {
      if (totalItems === 0) return;
      this.highlightedIndex = this.highlightedIndex === totalItems - 1 ? 0 : this.highlightedIndex + 1;
      this.updateList();
      this.tui.requestRender();
      return;
    }
    if (kb.matches(keyData, 'tui.select.confirm')) {
      this.confirmSelection();
      return;
    }
    this.searchInput.handleInput(keyData);
    this.filterPullRequests(this.searchInput.getValue());
    this.tui.requestRender();
  }
}
