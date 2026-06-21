import { Box, Container, Text, visibleWidth } from '@earendil-works/pi-tui';
import type { TUI } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { BOX_INDENT, getTermWidth, theme } from '../theme.js';
import { truncateAnsi } from './ansi.js';
import type {
  CompactToolLabelColor,
  IToolExecutionComponent,
  QuietToolDisplayMode,
  ToolResult,
} from './tool-execution-interface.js';

type SlackConversation = {
  id?: string;
  name?: string;
  type?: string;
};

type SlackMessage = {
  ts?: string;
  threadTs?: string;
  user?: string;
  username?: string;
  isCurrentUser?: boolean;
  botId?: string;
  text?: string;
};

type SlackSubscriptionChannel = {
  id?: string;
  name?: string;
  type?: string;
  latestTs?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'skipped';
  lastSyncError?: string;
};

type SlackReadResult = {
  channel?: SlackConversation;
  messages?: SlackMessage[];
  slackMessageRef?: {
    channelId?: string;
    channelName?: string;
    channelType?: string;
    messageTs?: string;
    threadTs?: string;
  };
  subscribed?: boolean;
  workspaceName?: string;
  workspaceId?: string;
  channels?: SlackSubscriptionChannel[];
  channelCount?: number;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'skipped';
  message?: string;
};

const SLACK_TOOL_NAMES = new Set(['slack_read_conversation', 'slack_read_thread', 'slack_list_subscriptions']);
const SLACK_TITLE = '#c084fc';
const SLACK_AUTHOR = '#c084fc';
const SLACK_CURRENT_USER = '#fbbf24';
export function isSlackReadTool(toolName: string): boolean {
  return SLACK_TOOL_NAMES.has(toolName);
}

export class SlackToolExecutionComponent extends Container implements IToolExecutionComponent {
  private contentBox: Box;
  private toolName: string;
  private args: unknown;
  private result?: ToolResult;
  private isPartial = true;

  constructor(toolName: string, args: unknown, ui: TUI) {
    super();
    void ui;
    this.toolName = toolName;
    this.args = args;
    this.contentBox = new Box(BOX_INDENT, 0, (text: string) => text);
    this.addChild(this.contentBox);
    this.rebuild();
  }

  updateArgs(args: unknown, rebuild = true): void {
    this.args = args;
    if (rebuild) this.rebuild();
  }

  refresh(): void {
    this.rebuild();
  }

  updateResult(result: ToolResult, isPartial = false): void {
    this.result = result;
    this.isPartial = isPartial;
    this.rebuild();
  }

  setExpanded(_expanded: boolean): void {
    // Slack context cards are intentionally always fully expanded.
    this.rebuild();
  }

  setQuietModeDisplay(_mode: QuietToolDisplayMode): void {
    // Slack read results are already compact, high-signal chat cards. Keep them readable even in quiet mode.
    this.rebuild();
  }

  setQuietPreviewLineLimit(_limit: number): void {}

  setCompactToolModeColor(_color: string | undefined): void {}

  getChatSpacingKind() {
    return 'normal-tool' as const;
  }

  getCompactToolGroupKey(): string | undefined {
    return undefined;
  }

  getCompactToolGroupSummary(): string | undefined {
    return this.getSummary();
  }

  hasQuietStreamingPreview(): boolean {
    return false;
  }

  getOwnCompactToolLabelColor(): CompactToolLabelColor | undefined {
    return this.result?.isError ? 'error' : 'toolTitle';
  }

  setCompactToolGroupLabelColor(_color: CompactToolLabelColor | undefined): void {}
  setCompactToolContinuation(_continuation: boolean, _previousSummary?: string): void {}
  setCompactToolHasFollowingContinuation(_hasFollowingContinuation: boolean): void {}

  isComplete(): boolean {
    return !this.isPartial;
  }

  private rebuild(): void {
    this.contentBox.clear();
    this.renderFull();
  }

  private renderFull(): void {
    const border = (char: string) => theme.bold(chalk.hex(theme.getTheme().toolBorderSuccess)(char));
    const status = this.getStatusIndicator();
    const summary = this.getSummary();
    const footerText = `${theme.bold(chalk.hex(SLACK_TITLE)('slack'))}${summary ? ` ${theme.fg('toolArgs', summary)}` : ''}${status}`;

    if (!this.result || this.isPartial) {
      const argsSummary = this.formatArgsSummary();
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      if (argsSummary) this.contentBox.addChild(new Text(`${border('│')} ${theme.fg('muted', argsSummary)}`, 0, 0));
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    if (this.result.isError) {
      this.contentBox.addChild(new Text(border('╭──'), 0, 0));
      this.contentBox.addChild(new Text(`${border('│')} ${theme.fg('error', this.getRawOutput())}`, 0, 0));
      this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
      return;
    }

    const parsed = this.parseResult();
    const messages = parsed?.messages ?? [];
    this.contentBox.addChild(new Text(border('╭──'), 0, 0));

    if (this.toolName === 'slack_list_subscriptions') {
      for (const line of this.formatSubscriptions(parsed)) this.contentBox.addChild(new Text(`${border('│')} ${line}`, 0, 0));
    } else if (messages.length === 0) {
      this.contentBox.addChild(new Text(`${border('│')} ${theme.fg('muted', 'No Slack messages returned')}`, 0, 0));
    } else {
      for (const line of this.formatMessages(messages)) this.contentBox.addChild(new Text(`${border('│')} ${line}`, 0, 0));
    }

    this.contentBox.addChild(new Text(`${border('╰──')} ${footerText}`, 0, 0));
  }

  private formatSubscriptions(parsed: SlackReadResult | undefined): string[] {
    const maxLineWidth = Math.max(20, getTermWidth() - BOX_INDENT * 2 - 4);
    if (!parsed?.subscribed) return [theme.fg('muted', parsed?.message ?? 'This thread is not subscribed to Slack.')];

    const lines: string[] = [];
    const workspace = parsed.workspaceName ?? parsed.workspaceId ?? 'Slack workspace';
    const total = parsed.channelCount ?? parsed.channels?.length ?? 0;
    lines.push(`${chalk.hex(SLACK_AUTHOR).bold(workspace)} ${theme.fg('muted', `${total} subscription${total === 1 ? '' : 's'}`)}`);
    if (parsed.lastSyncAt) lines.push(`  ${theme.fg('muted', `last sync ${formatDateTime(parsed.lastSyncAt)}${parsed.lastSyncStatus ? ` · ${parsed.lastSyncStatus}` : ''}`)}`);

    const channels = parsed.channels ?? [];
    if (channels.length === 0) {
      lines.push(theme.fg('muted', 'No channels or DMs selected.'));
      return lines;
    }

    for (const channel of channels) {
      const label = formatChannelLabel(channel.name ?? channel.id ?? 'unknown', channel.type);
      const status = channel.lastSyncStatus ? ` · ${channel.lastSyncStatus}` : '';
      const lastSync = channel.lastSyncAt ? `last sync ${formatDateTime(channel.lastSyncAt)}` : 'not synced yet';
      const latest = channel.latestTs ? ` · latest ${formatSlackTimestamp(channel.latestTs) || channel.latestTs}` : '';
      const detail = `${lastSync}${status}${latest}`;
      lines.push(truncateAnsi(`${chalk.hex(SLACK_AUTHOR).bold(label)} ${theme.fg('muted', detail)}`, maxLineWidth));
      if (channel.lastSyncError) lines.push(`  ${theme.fg('error', truncateAnsi(channel.lastSyncError, maxLineWidth - 2))}`);
    }

    return lines;
  }

  private formatMessages(messages: SlackMessage[]): string[] {
    const maxLineWidth = Math.max(20, getTermWidth() - BOX_INDENT * 2 - 4);
    const lines: string[] = [];
    for (const message of messages) {
      const author = message.username || message.user || message.botId || 'unknown';
      const authorLabel = message.isCurrentUser ? `${author} (you)` : author;
      const authorColor = message.isCurrentUser ? SLACK_CURRENT_USER : SLACK_AUTHOR;
      const time = formatSlackTimestamp(message.ts);
      const header = `${chalk.hex(authorColor).bold(authorLabel)}${time ? theme.fg('muted', ` ${time}`) : ''}`;
      lines.push(truncateAnsi(header, maxLineWidth));
      const text = normalizeSlackText(message.text || '(no text)');
      for (const textLine of wrapText(text, Math.max(20, maxLineWidth - 2))) {
        lines.push(`  ${theme.fg('toolOutput', truncateAnsi(textLine, maxLineWidth - 2))}`);
      }
    }
    return lines;
  }

  private getSummary(): string {
    const parsed = this.parseResult();
    if (this.toolName === 'slack_list_subscriptions') {
      const workspace = parsed?.workspaceName ?? parsed?.workspaceId ?? '';
      const count = parsed?.channelCount;
      const countText = count === undefined ? '' : `${count} subscription${count === 1 ? '' : 's'}`;
      return [workspace, countText].filter(Boolean).join(' · ');
    }

    const channel = parsed?.channel;
    const ref = parsed?.slackMessageRef;
    const channelName = channel?.name ?? ref?.channelName ?? channel?.id ?? ref?.channelId ?? this.getArg('channel');
    const label = channelName ? formatChannelLabel(channelName, channel?.type ?? ref?.channelType) : '';
    const count = parsed?.messages?.length;
    const countText = count === undefined ? '' : `${count} message${count === 1 ? '' : 's'}`;
    return [this.toolName === 'slack_read_thread' ? 'thread' : label, this.toolName === 'slack_read_thread' ? label : countText]
      .filter(Boolean)
      .join(' · ');
  }

  private parseResult(): SlackReadResult | undefined {
    if (!this.result) return undefined;
    const raw = this.getRawOutput();
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === 'object' && parsed !== null) return parsed as SlackReadResult;
    } catch {
      return undefined;
    }
    return undefined;
  }

  private getRawOutput(): string {
    return this.result?.content
      .filter(part => part.type === 'text' && part.text)
      .map(part => part.text!)
      .join('\n')
      .trim() ?? '';
  }

  private getArg(key: string): string {
    if (!this.args || typeof this.args !== 'object') return '';
    const value = (this.args as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
  }

  private formatArgsSummary(): string {
    const channel = this.getArg('channel');
    const aroundTs = this.getArg('aroundTs');
    const threadTs = this.getArg('threadTs');
    return [channel, aroundTs ? `around ${aroundTs}` : '', threadTs ? `thread ${threadTs}` : ''].filter(Boolean).join(' · ');
  }

  private getStatusIndicator(): string {
    return this.isPartial
      ? theme.fg('muted', ' ⋯')
      : this.result?.isError
        ? theme.fg('error', ' ✗')
        : theme.fg('success', ' ✓');
  }
}

function formatChannelLabel(channel: string, type?: string): string {
  if (type === 'im' || type === 'mpim') return channel.replace(/^#/, '');
  return channel.startsWith('#') ? channel : `#${channel}`;
}

function formatSlackTimestamp(ts?: string): string {
  if (!ts) return '';
  const seconds = Number(ts.split('.')[0]);
  if (!Number.isFinite(seconds)) return ts;
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(seconds * 1000));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function normalizeSlackText(text: string): string {
  return text
    .replace(/<@([A-Z0-9]+)>/g, '@$1')
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2')
    .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const sourceLine of text.split('\n')) {
    let current = '';
    for (const word of sourceLine.split(/(\s+)/)) {
      if (visibleWidth(current + word) > width && current.trim()) {
        lines.push(current.trimEnd());
        current = word.trimStart();
      } else {
        current += word;
      }
    }
    lines.push(current.trimEnd());
  }
  return lines.filter(Boolean);
}
