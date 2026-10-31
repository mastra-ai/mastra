import { Container, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem, TUI } from '@earendil-works/pi-tui';
import type { BackgroundActivity } from '../background-activity.js';
import { theme } from '../theme.js';
import type { Filterable, MenuChrome, MenuHint } from './menu-chrome.js';
import { MenuList } from './menu-list.js';

export interface BackgroundActivitySelectorOptions {
  tui: TUI;
  activities: BackgroundActivity[];
  getActivity: (taskId: string) => BackgroundActivity | undefined;
  onCancel: () => void;
  onAbort: (activity: BackgroundActivity) => void;
}

export class BackgroundActivitySelectorComponent extends Container implements MenuChrome {
  focused = false;
  private readonly list: MenuList;
  private readonly getActivity: (taskId: string) => BackgroundActivity | undefined;
  private readonly onAbort: (activity: BackgroundActivity) => void;

  constructor(options: BackgroundActivitySelectorOptions) {
    super();
    const byId = new Map(options.activities.map(activity => [activity.taskId, activity]));
    this.getActivity = options.getActivity;
    this.onAbort = options.onAbort;
    const items: SelectItem[] = options.activities.map(activity => ({
      value: activity.taskId,
      label: `${statusIcon(activity.status)} ${activity.toolName}`,
    }));
    this.list = new MenuList(items, 10);
    const detailText = new Text('', 2, 0);
    const updateDetail = (activity: BackgroundActivity) => {
      const state = activity.status === 'accepted' ? 'running' : activity.status;
      detailText.setText(theme.fg('dim', `${state} · task ${activity.taskId}`));
      options.tui.requestRender();
    };

    this.list.onSelect = () => {};
    this.list.onSelectionChange = item => {
      const activity = this.getActivity(item.value) ?? byId.get(item.value);
      if (activity) updateDetail(activity);
    };
    this.list.onCancel = options.onCancel;
    this.addChild(this.list);
    this.addChild(new Spacer(1));
    this.addChild(detailText);

    const first = options.activities[0];
    if (first) updateDetail(first);
  }

  menuTitle(): string {
    return 'Background activity';
  }

  menuHints(): readonly MenuHint[] {
    return [{ key: 'd', label: 'abort running' }];
  }

  /** Letters are shortcuts here (d aborts), so typing does not filter. */
  menuFilterTarget(): Filterable | undefined {
    return undefined;
  }

  handleInput(data: string): void {
    if (!this.focused) return;
    if (data.toLowerCase() === 'd') {
      const item = this.list.getSelectedItem();
      const activity = item ? this.getActivity(item.value) : undefined;
      if (activity?.status === 'accepted') this.onAbort(activity);
      return;
    }
    this.list.handleInput(data);
  }
}

function statusIcon(status: BackgroundActivity['status']): string {
  if (status === 'accepted') return theme.fg('warning', '◌');
  if (status === 'failed') return theme.fg('error', '✗');
  if (status === 'cancelled') return theme.fg('muted', '■');
  return theme.fg('success', '✓');
}
