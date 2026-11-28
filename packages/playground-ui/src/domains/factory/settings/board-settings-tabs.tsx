import { CanvasViewTabs } from '..';

import { useBoardSettingsHost } from './board-settings-host';

/** The board's view tabs, pointed at this app's routes, after the sidebar toggle. */
export function BoardSettingsTabs({ boardId, active }: { boardId: string; active: 'settings' | 'routing' }) {
  const host = useBoardSettingsHost();
  return (
    <CanvasViewTabs
      leading={host.tabsLeading}
      cardsHref={host.boardHref(boardId)}
      settingsHref={host.configHref(boardId)}
      routingHref={host.routingHref(boardId)}
      active={active}
      LinkComponent={host.LinkComponent}
    />
  );
}
