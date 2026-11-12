import { Box, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem, SelectListTheme, TUI } from '@earendil-works/pi-tui';
import type { BackgroundActivity } from '../background-activity.js';
import { formatStatusDuration } from '../status-duration.js';
import { theme } from '../theme.js';
import { WrappingSelectList } from './wrapping-select-list.js';

export interface BackgroundActivitySelectorOptions {
  tui: TUI;
  activities: BackgroundActivity[];
  getActivity: (taskId: string) => BackgroundActivity | undefined;
  onCancel: () => void;
  onAbort: (activity: BackgroundActivity) => void;
  /** Enter on a row: a shell shows its output, a subagent toggles its box. */
  onOpen?: (activity: BackgroundActivity) => void;
  /** Rows Enter does nothing for; they show no Enter hint. */
  canOpen?: (activity: BackgroundActivity) => boolean;
  /** False when the shell's sandbox is out of reach (a remote session); shells then offer no Enter or D. */
  canControlProcesses?: boolean;
  now?: () => number;
}

export class BackgroundActivitySelectorComponent extends Box {
  focused = false;
  private readonly list: WrappingSelectList;
  private readonly getActivity: (taskId: string) => BackgroundActivity | undefined;
  private readonly onAbort: (activity: BackgroundActivity) => void;
  private readonly canControlProcesses: boolean;

  constructor(options: BackgroundActivitySelectorOptions) {
    super(4, 2, text => theme.bg('overlayBg', text));
    const byId = new Map(options.activities.map(activity => [activity.taskId, activity]));
    const now = options.now ?? Date.now;
    this.getActivity = options.getActivity;
    this.onAbort = options.onAbort;
    this.canControlProcesses = options.canControlProcesses ?? true;
    const items: SelectItem[] = options.activities.map(activity => {
      const elapsed = formatStatusDuration((activity.completedAt ?? now()) - activity.createdAt, {
        includeSeconds: true,
      });
      return {
        value: activity.taskId,
        label: `  ${statusIcon(activity.status)} ${kindIcon(activity)} ${activity.label ?? activity.toolName}  ${theme.fg('dim', elapsed)}`,
      };
    });
    const selectTheme: SelectListTheme = {
      selectedPrefix: value => theme.fg('accent', value),
      selectedText: value => theme.fg('accent', value),
      description: value => theme.fg('dim', value),
      scrollInfo: value => theme.fg('dim', value),
      noMatch: value => theme.fg('dim', value),
    };

    this.addChild(new Text(theme.bold(theme.fg('accent', 'Background activity')), 0, 0));
    this.addChild(new Spacer(1));
    this.list = new WrappingSelectList(items, 10, selectTheme);
    const detailText = new Text('', 0, 0);
    const hintText = new Text('', 0, 0);
    const canOpen = (activity: BackgroundActivity) =>
      Boolean(options.onOpen) &&
      (activity.kind !== 'process' || this.canControlProcesses) &&
      (options.canOpen?.(activity) ?? true);
    const updateDetail = (activity: BackgroundActivity) => {
      detailText.setText(theme.fg('dim', describeState(activity)));
      const hint = [
        '↑↓ inspect',
        canOpen(activity) ? 'Enter open' : undefined,
        this.canAbort(activity) ? 'D abort running' : undefined,
        'Esc close',
      ]
        .filter(Boolean)
        .join(' · ');
      hintText.setText(theme.fg('dim', hint));
      options.tui.requestRender();
    };

    this.list.onSelect = item => {
      const activity = this.getActivity(item.value) ?? byId.get(item.value);
      if (activity && canOpen(activity)) options.onOpen?.(activity);
    };
    this.list.onSelectionChange = item => {
      const activity = this.getActivity(item.value) ?? byId.get(item.value);
      if (activity) updateDetail(activity);
    };
    this.list.onCancel = options.onCancel;
    this.addChild(this.list);
    this.addChild(new Spacer(1));
    this.addChild(detailText);
    this.addChild(new Spacer(1));
    this.addChild(hintText);

    const first = options.activities[0];
    if (first) updateDetail(first);
  }

  private canAbort(activity: BackgroundActivity): boolean {
    return activity.status === 'accepted' && (activity.kind !== 'process' || this.canControlProcesses);
  }

  handleInput(data: string): void {
    if (!this.focused) return;
    if (data.toLowerCase() === 'd') {
      const item = this.list.getSelectedItem();
      const activity = item ? this.getActivity(item.value) : undefined;
      if (activity && this.canAbort(activity)) this.onAbort(activity);
      return;
    }
    this.list.handleInput(data);
  }
}

function describeState(activity: BackgroundActivity): string {
  if (activity.kind === 'process') {
    const state =
      activity.status === 'accepted'
        ? 'running'
        : activity.status === 'cancelled'
          ? 'killed'
          : `exit ${activity.exitCode ?? '?'}`;
    return `${state} · PID ${activity.pid}`;
  }
  const state = activity.status === 'accepted' ? 'running' : activity.status;
  return `${state} · task ${activity.taskId}`;
}

function kindIcon(activity: BackgroundActivity): string {
  if (activity.kind === 'process') return theme.fg('toolTitle', '$');
  if (activity.toolName === 'subagent') return theme.fg('accent', '◆');
  return theme.fg('muted', '•');
}

function statusIcon(status: BackgroundActivity['status']): string {
  if (status === 'accepted') return theme.fg('warning', '◌');
  if (status === 'failed') return theme.fg('error', '✗');
  if (status === 'cancelled') return theme.fg('muted', '■');
  return theme.fg('success', '✓');
}
