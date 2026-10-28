import { Container, Text } from '@earendil-works/pi-tui';
import type { BackgroundActivity } from '../background-activity.js';
import { BOX_INDENT, theme } from '../theme.js';

export class GlobalBackgroundNoticeComponent extends Container {
  private activities: BackgroundActivity[] = [];

  setActivities(activities: BackgroundActivity[]): void {
    this.activities = activities;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();
    if (this.activities.length === 0) return;

    const accepted = this.activities.filter(activity => activity.status === 'accepted').length;
    const completed = this.activities.filter(activity => activity.status === 'completed').length;
    const failed = this.activities.filter(activity => activity.status === 'failed').length;
    const cancelled = this.activities.filter(activity => activity.status === 'cancelled').length;
    const parts = [
      accepted > 0 ? theme.fg('warning', `◌ ${accepted} running`) : undefined,
      completed > 0 ? theme.fg('success', `✓ ${completed} completed`) : undefined,
      failed > 0 ? theme.fg('error', `✗ ${failed} failed`) : undefined,
      cancelled > 0 ? theme.fg('muted', `■ ${cancelled} cancelled`) : undefined,
    ].filter(Boolean);

    this.addChild(
      new Text(
        `Background ${parts.join('  ')} ${theme.fg('dim', '· Ctrl+G open · Alt+G clear finished')}`,
        BOX_INDENT,
        0,
      ),
    );
  }
}
