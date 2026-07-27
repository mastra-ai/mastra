import { Box, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem, SelectListTheme, TUI } from '@earendil-works/pi-tui';
import type { BackgroundActivity } from '../background-activity.js';
import { theme } from '../theme.js';
import { WrappingSelectList } from './wrapping-select-list.js';

export interface BackgroundActivitySelectorOptions {
  tui: TUI;
  activities: BackgroundActivity[];
  onSelect: (activity: BackgroundActivity) => void;
  onCancel: () => void;
}

export class BackgroundActivitySelectorComponent extends Box {
  focused = false;
  private readonly list: WrappingSelectList;

  constructor(options: BackgroundActivitySelectorOptions) {
    super(4, 2, text => theme.bg('overlayBg', text));
    const byId = new Map(options.activities.map(activity => [activity.taskId, activity]));
    const items: SelectItem[] = options.activities.map(activity => ({
      value: activity.taskId,
      label: `  ${statusIcon(activity.status)} ${activity.toolName}  ${theme.fg('dim', `thread ${activity.threadId.slice(0, 8)}`)}`,
    }));
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
    const updateDetail = (activity: BackgroundActivity) => {
      const state = activity.status === 'accepted' ? 'running' : activity.status;
      const error = activity.errorSummary ? `\n${theme.fg('error', activity.errorSummary)}` : '';
      detailText.setText(
        `${theme.fg('dim', `${state} · task ${activity.taskId} · thread ${activity.threadId}`)}${error}`,
      );
      options.tui.requestRender();
    };

    this.list.onSelect = item => {
      const activity = byId.get(item.value);
      if (activity) options.onSelect(activity);
    };
    this.list.onSelectionChange = item => {
      const activity = byId.get(item.value);
      if (activity) updateDetail(activity);
    };
    this.list.onCancel = options.onCancel;
    this.addChild(this.list);
    this.addChild(new Spacer(1));
    this.addChild(detailText);
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter open thread · Esc close'), 0, 0));

    const first = options.activities[0];
    if (first) updateDetail(first);
  }

  handleInput(data: string): void {
    if (this.focused) this.list.handleInput(data);
  }
}

function statusIcon(status: BackgroundActivity['status']): string {
  if (status === 'accepted') return theme.fg('warning', '◌');
  if (status === 'failed') return theme.fg('error', '✗');
  return theme.fg('success', '✓');
}
