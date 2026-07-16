import { getKeybindings, matchesKey, visibleWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import type { Component, Focusable, TUI } from '@earendil-works/pi-tui';
import type {
  KnowledgeInspector,
  KnowledgeInspectorActivityItem,
  KnowledgeInspectorActivityList,
  KnowledgeInspectorEntityDetail,
  KnowledgeInspectorPageDetail,
  KnowledgeInspectorRecordList,
  KnowledgeInspectorRecordSummary,
  KnowledgeInspectorScopeLevel,
  KnowledgeInspectorScopeTree,
} from '@mastra/code-sdk';

import { theme } from '../theme.js';
import { truncateAnsi } from './ansi.js';

export type KnowledgeBrowserSection = 'scopes' | 'entities' | 'pages' | 'activity';
type Detail =
  | { type: 'entity'; value: KnowledgeInspectorEntityDetail }
  | { type: 'page'; value: KnowledgeInspectorPageDetail };
type Target =
  | { type: 'record'; record: KnowledgeInspectorRecordSummary }
  | { type: 'more-facts' }
  | { type: 'more-incoming' };

export interface KnowledgeBrowserOptions {
  tui: TUI;
  inspector: KnowledgeInspector;
  onClose: () => void;
}

const SECTIONS: KnowledgeBrowserSection[] = ['scopes', 'entities', 'pages', 'activity'];
const PAGE_SIZE = 12;
const MAX_BODY_LINES = 10;
const MIN_CONTENT_WIDTH = 20;

function middleTruncate(value: string, width: number): string {
  if (visibleWidth(value) <= width) return value;
  if (width <= 1) return '…';
  const side = Math.max(1, Math.floor((width - 1) / 2));
  return `${value.slice(0, side)}…${value.slice(-side)}`;
}

function scopeLabel(record: KnowledgeInspectorRecordSummary, level: KnowledgeInspectorScopeLevel): string {
  const relation = record.scope.level === level ? 'exact' : 'inherited';
  return `[${relation}:${record.scope.level}]`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class KnowledgeBrowserComponent implements Component, Focusable {
  private readonly tui: TUI;
  private readonly inspector: KnowledgeInspector;
  private readonly onClose: () => void;
  private scopeTree?: KnowledgeInspectorScopeTree;
  private identityKey?: string;
  private section: KnowledgeBrowserSection = 'scopes';
  private level: KnowledgeInspectorScopeLevel = 'resource';
  private records: KnowledgeInspectorRecordSummary[] = [];
  private activity: KnowledgeInspectorActivityItem[] = [];
  private nextCursor?: string;
  private query = '';
  private selectedIndex = 0;
  private detail?: Detail;
  private detailTargets: Target[] = [];
  private loading = false;
  private error?: string;
  private requestVersion = 0;
  private _focused = false;

  constructor(options: KnowledgeBrowserOptions) {
    this.tui = options.tui;
    this.inspector = options.inspector;
    this.onClose = options.onClose;
    void this.refresh();
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
  }

  async refresh(): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.loading = true;
    this.error = undefined;
    this.renderNow();
    try {
      const tree = await this.inspector.getScopeTree();
      if (requestVersion !== this.requestVersion) return;
      const changed = this.identityKey !== undefined && this.identityKey !== tree.identityKey;
      this.scopeTree = tree;
      this.identityKey = tree.identityKey;
      if (changed) {
        this.level = tree.defaultLevel;
        this.section = 'scopes';
        this.detail = undefined;
        this.query = '';
        this.records = [];
        this.activity = [];
        this.nextCursor = undefined;
        this.selectedIndex = 0;
      }
    } catch (error) {
      if (requestVersion === this.requestVersion) this.error = formatError(error);
    } finally {
      if (requestVersion === this.requestVersion) {
        this.loading = false;
        this.renderNow();
      }
    }
  }

  private renderNow(): void {
    this.tui.requestRender();
  }

  private async ensureIdentity(): Promise<boolean> {
    const previous = this.identityKey;
    await this.refresh();
    return previous === undefined || previous === this.identityKey;
  }

  private async loadSection(append = false): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.loading = true;
    this.error = undefined;
    this.renderNow();
    try {
      const tree = await this.inspector.getScopeTree();
      if (requestVersion !== this.requestVersion) return;
      if (this.identityKey !== undefined && tree.identityKey !== this.identityKey) {
        this.scopeTree = tree;
        this.identityKey = tree.identityKey;
        this.level = tree.defaultLevel;
        this.section = 'scopes';
        this.detail = undefined;
        this.records = [];
        this.activity = [];
        this.nextCursor = undefined;
        this.selectedIndex = 0;
        return;
      }
      this.scopeTree = tree;
      this.identityKey = tree.identityKey;
      const cursor = append ? this.nextCursor : undefined;
      let result: KnowledgeInspectorRecordList | KnowledgeInspectorActivityList;
      if (this.section === 'entities') {
        result = await this.inspector.listEntities({
          level: this.level,
          namePrefix: this.query || undefined,
          cursor,
          limit: PAGE_SIZE,
        });
      } else if (this.section === 'pages') {
        result = await this.inspector.listPages({
          level: this.level,
          namePrefix: this.query || undefined,
          cursor,
          limit: PAGE_SIZE,
        });
      } else if (this.section === 'activity') {
        result = await this.inspector.listActivity({ level: this.level, cursor, limit: PAGE_SIZE });
      } else {
        return;
      }
      if (requestVersion !== this.requestVersion || result.identityKey !== this.identityKey) return;
      if (this.section === 'activity') {
        const items = (result as KnowledgeInspectorActivityList).items;
        this.activity = append ? [...this.activity, ...items] : items;
      } else {
        const items = (result as KnowledgeInspectorRecordList).items;
        this.records = append ? [...this.records, ...items] : items;
      }
      this.nextCursor = result.nextCursor;
      if (!append) this.selectedIndex = 0;
    } catch (error) {
      if (requestVersion === this.requestVersion) this.error = formatError(error);
    } finally {
      if (requestVersion === this.requestVersion) {
        this.loading = false;
        this.renderNow();
      }
    }
  }

  private async openRecord(record: KnowledgeInspectorRecordSummary): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.loading = true;
    this.error = undefined;
    this.renderNow();
    try {
      const detail =
        record.type === 'entity'
          ? ({ type: 'entity', value: await this.inspector.getEntity({ handle: record.handle }) } as const)
          : ({ type: 'page', value: await this.inspector.getPage({ handle: record.handle }) } as const);
      if (requestVersion !== this.requestVersion || detail.value.identityKey !== this.identityKey) return;
      this.detail = detail;
      this.selectedIndex = 0;
    } catch (error) {
      if (requestVersion === this.requestVersion) this.error = formatError(error);
    } finally {
      if (requestVersion === this.requestVersion) {
        this.loading = false;
        this.renderNow();
      }
    }
  }

  private async loadMoreFacts(kind: 'facts' | 'incoming'): Promise<void> {
    if (this.detail?.type !== 'entity') return;
    const current = this.detail.value;
    const cursor = kind === 'facts' ? current.factsNextCursor : current.incomingFactsNextCursor;
    if (!cursor) return;
    const requestVersion = ++this.requestVersion;
    this.loading = true;
    this.renderNow();
    try {
      const next = await this.inspector.getEntity({
        handle: current.entity.handle,
        factsCursor: kind === 'facts' ? cursor : undefined,
        incomingFactsCursor: kind === 'incoming' ? cursor : undefined,
      });
      if (
        requestVersion !== this.requestVersion ||
        next.identityKey !== this.identityKey ||
        this.detail?.type !== 'entity'
      ) {
        return;
      }
      this.detail = {
        type: 'entity',
        value: {
          ...next,
          facts: kind === 'facts' ? [...current.facts, ...next.facts] : current.facts,
          factsNextCursor: kind === 'facts' ? next.factsNextCursor : current.factsNextCursor,
          incomingFacts:
            kind === 'incoming' ? [...current.incomingFacts, ...next.incomingFacts] : current.incomingFacts,
          incomingFactsNextCursor: kind === 'incoming' ? next.incomingFactsNextCursor : current.incomingFactsNextCursor,
        },
      };
    } catch (error) {
      if (requestVersion === this.requestVersion) this.error = formatError(error);
    } finally {
      if (requestVersion === this.requestVersion) {
        this.loading = false;
        this.renderNow();
      }
    }
  }

  private listLength(): number {
    if (this.section === 'scopes') return this.scopeTree?.roots.length ?? 0;
    const count = this.section === 'activity' ? this.activity.length : this.records.length;
    return count + (this.nextCursor ? 1 : 0);
  }

  private move(delta: number): void {
    const length = this.detail ? this.detailTargets.length : this.listLength();
    if (length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + length) % length;
    this.renderNow();
  }

  private async selectCurrent(): Promise<void> {
    if (!(await this.ensureIdentity())) return;
    if (this.detail) {
      const target = this.detailTargets[this.selectedIndex];
      if (target?.type === 'record') await this.openRecord(target.record);
      else if (target?.type === 'more-facts') await this.loadMoreFacts('facts');
      else if (target?.type === 'more-incoming') await this.loadMoreFacts('incoming');
      return;
    }
    if (this.section === 'scopes') {
      const root = this.scopeTree?.roots[this.selectedIndex];
      if (!root?.available) return;
      this.level = root.level;
      this.section = 'entities';
      this.selectedIndex = 0;
      await this.loadSection();
      return;
    }
    const items = this.section === 'activity' ? this.activity : this.records;
    if (this.selectedIndex === items.length && this.nextCursor) {
      await this.loadSection(true);
      return;
    }
    if (this.section === 'activity') {
      const record = this.activity[this.selectedIndex]?.record;
      if (record) await this.openRecord(record);
      return;
    }
    const record = this.records[this.selectedIndex];
    if (record) await this.openRecord(record);
  }

  private async changeSection(delta: number): Promise<void> {
    const index = SECTIONS.indexOf(this.section);
    this.section = SECTIONS[(index + delta + SECTIONS.length) % SECTIONS.length]!;
    this.detail = undefined;
    this.selectedIndex = 0;
    this.query = '';
    this.records = [];
    this.activity = [];
    this.nextCursor = undefined;
    if (this.section === 'scopes') await this.refresh();
    else await this.loadSection();
  }

  handleInput(data: string): void {
    const kb = getKeybindings();
    if (kb.matches(data, 'tui.select.cancel')) {
      this.onClose();
    } else if (matchesKey(data, 'shift+tab')) {
      void this.changeSection(-1);
    } else if (matchesKey(data, 'tab')) {
      void this.changeSection(1);
    } else if (kb.matches(data, 'tui.select.up') || data === 'k') {
      this.move(-1);
    } else if (kb.matches(data, 'tui.select.down') || data === 'j') {
      this.move(1);
    } else if (kb.matches(data, 'tui.select.confirm')) {
      void this.selectCurrent();
    } else if (data === '\x7f' || data === '\b') {
      if (this.detail) {
        this.detail = undefined;
        this.selectedIndex = 0;
        this.renderNow();
      } else if (this.query && (this.section === 'entities' || this.section === 'pages')) {
        this.query = this.query.slice(0, -1);
        void this.loadSection();
      } else if (this.section !== 'scopes') {
        this.section = 'scopes';
        this.selectedIndex = 0;
        void this.refresh();
      }
    } else if (
      !this.detail &&
      (this.section === 'entities' || this.section === 'pages') &&
      /^[\x20-\x7e]$/.test(data)
    ) {
      this.query += data;
      void this.loadSection();
    }
  }

  invalidate(): void {}

  private breadcrumb(width: number): string {
    const scopeId = this.scopeTree?.roots.find(root => root.level === this.level)?.id ?? 'unavailable';
    const recordName = this.detail?.type === 'entity' ? this.detail.value.entity.name : this.detail?.value.page.name;
    const suffix = recordName ? ` / ${recordName}` : '';
    const prefix = `Knowledge / ${this.level}:`;
    const idWidth = Math.max(6, width - visibleWidth(prefix + suffix) - 2);
    return truncateAnsi(
      `${theme.bold('Knowledge')} / ${this.level}:${middleTruncate(scopeId, idWidth)}${suffix}`,
      width,
    );
  }

  private renderTabs(width: number): string {
    const tabs = SECTIONS.map(section =>
      section === this.section ? theme.bold(theme.fg('accent', `[${section}]`)) : theme.fg('muted', section),
    ).join('  ');
    return truncateAnsi(tabs, width);
  }

  private renderScopes(width: number): string[] {
    if (!this.scopeTree) return [];
    return this.scopeTree.roots.map((root, index) => {
      const marker = index === this.selectedIndex ? '→' : ' ';
      const availability = root.available ? '' : ` — ${root.reason ?? 'unavailable'}`;
      const id = root.id ?? 'unavailable';
      const prefix = `${marker} ${root.level.padEnd(8)} `;
      return truncateAnsi(
        `${prefix}${middleTruncate(id, Math.max(1, width - prefix.length - availability.length))}${availability}`,
        width,
      );
    });
  }

  private renderRecordList(width: number): string[] {
    const lines = this.records.map((record, index) => {
      const marker = index === this.selectedIndex ? '→' : ' ';
      const kind = record.kind ? ` (${record.kind})` : '';
      const badge = scopeLabel(record, this.level);
      return truncateAnsi(`${marker} ${record.name}${kind} ${theme.fg('muted', badge)}`, width);
    });
    if (this.nextCursor) lines.push(`${this.selectedIndex === this.records.length ? '→' : ' '} Load more…`);
    if (!this.loading && lines.length === 0) lines.push(theme.fg('muted', `No ${this.section} found.`));
    return lines;
  }

  private renderActivity(width: number): string[] {
    const lines = this.activity.map((item, index) => {
      const marker = index === this.selectedIndex ? '→' : ' ';
      const target = item.record?.name ?? `${item.recordType} (unavailable)`;
      const badge = item.record ? scopeLabel(item.record, this.level) : `[${item.scope.level}]`;
      return truncateAnsi(`${marker} ${item.action}: ${target} ${theme.fg('muted', badge)}`, width);
    });
    if (this.nextCursor) lines.push(`${this.selectedIndex === this.activity.length ? '→' : ' '} Load more…`);
    if (!this.loading && lines.length === 0) lines.push(theme.fg('muted', 'No knowledge activity found.'));
    return lines;
  }

  private selectableLine(text: string, target: Target, width: number): string {
    const index = this.detailTargets.push(target) - 1;
    return truncateAnsi(`${index === this.selectedIndex ? '→' : ' '} ${text}`, width);
  }

  private renderEntityDetail(detail: KnowledgeInspectorEntityDetail, width: number): string[] {
    this.detailTargets = [];
    const lines = [
      `${theme.bold(detail.entity.name)}  ${detail.entity.kind ?? 'entity'}  ${scopeLabel(detail.entity, this.level)}  v${detail.entity.version}`,
      '',
      theme.bold(`Facts (${detail.facts.length})`),
      ...detail.facts.slice(0, 8).map(fact => truncateAnsi(`  • ${fact.text} [${fact.scope.level}]`, width)),
    ];
    if (detail.factsNextCursor) lines.push(this.selectableLine('Load more facts…', { type: 'more-facts' }, width));
    lines.push('', theme.bold(`Incoming (${detail.incomingFacts.length})`));
    lines.push(
      ...detail.incomingFacts.slice(0, 6).map(fact => truncateAnsi(`  • ${fact.text} [${fact.scope.level}]`, width)),
    );
    if (detail.incomingFactsNextCursor) {
      lines.push(this.selectableLine('Load more incoming facts…', { type: 'more-incoming' }, width));
    }
    lines.push('', theme.bold('Related entities'));
    for (const related of detail.relatedEntities) {
      lines.push(
        this.selectableLine(
          `${related.name} ${scopeLabel(related, this.level)}`,
          { type: 'record', record: related },
          width,
        ),
      );
    }
    if (detail.relatedEntities.length === 0) lines.push(theme.fg('muted', '  No related entities.'));
    return lines;
  }

  private renderPageDetail(detail: KnowledgeInspectorPageDetail, width: number): string[] {
    this.detailTargets = [];
    const lines = [
      `${theme.bold(detail.page.name)}  ${scopeLabel(detail.page, this.level)}  v${detail.page.version}`,
      '',
      theme.bold('Body'),
    ];
    const bodyLines = wrapTextWithAnsi(detail.body, Math.max(MIN_CONTENT_WIDTH, width - 2)).slice(0, MAX_BODY_LINES);
    lines.push(...bodyLines.map(line => truncateAnsi(`  ${line}`, width)));
    if (detail.bodyTruncated || bodyLines.length === MAX_BODY_LINES)
      lines.push(theme.fg('muted', '  … preview truncated'));
    lines.push('', theme.bold('Links'));
    for (const link of detail.links) {
      lines.push(
        link.entity
          ? this.selectableLine(`${link.label} → ${link.entity.name}`, { type: 'record', record: link.entity }, width)
          : truncateAnsi(`  ${link.label} (unresolved)`, width),
      );
    }
    if (detail.links.length === 0) lines.push(theme.fg('muted', '  No links.'));
    return lines;
  }

  render(width: number): string[] {
    const contentWidth = Math.max(MIN_CONTENT_WIDTH, width - 4);
    const lines = [this.breadcrumb(contentWidth), this.renderTabs(contentWidth), ''];
    if (this.query && !this.detail) lines.push(truncateAnsi(`Filter: ${this.query}`, contentWidth), '');
    if (this.error) lines.push(theme.fg('error', truncateAnsi(`Error: ${this.error}`, contentWidth)), '');
    if (this.detail?.type === 'entity') lines.push(...this.renderEntityDetail(this.detail.value, contentWidth));
    else if (this.detail?.type === 'page') lines.push(...this.renderPageDetail(this.detail.value, contentWidth));
    else if (this.section === 'scopes') lines.push(...this.renderScopes(contentWidth));
    else if (this.section === 'activity') lines.push(...this.renderActivity(contentWidth));
    else lines.push(...this.renderRecordList(contentWidth));
    if (this.loading) lines.push('', theme.fg('muted', 'Loading…'));
    lines.push('', theme.fg('dim', 'Tab sections · ↑↓/jk select · Enter open · Backspace back · Esc close'));
    return lines.map(line => truncateAnsi(line, contentWidth));
  }
}
