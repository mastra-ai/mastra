import { CanvasViewTabs } from '@mastra/playground-ui/domains/factory';

import { HrefLink } from '../../../ui/HrefLink';
import { ChatHeaderSidebarTrigger } from '../../chat/components/ChatHeaderSidebarTrigger';
import { boardConfigPath, boardIntakePath } from '../../boardConfig/boardConfigPaths';
import { rememberedBoardPath } from '../../factory/services/boardViews';

/** The board's view tabs, pointed at this app's routes, after the sidebar toggle. */
export function BoardSettingsTabs({
  factoryId,
  boardId,
  active,
}: {
  factoryId: string;
  boardId: string;
  active: 'settings' | 'routing';
}) {
  return (
    <CanvasViewTabs
      leading={<ChatHeaderSidebarTrigger />}
      cardsHref={rememberedBoardPath(factoryId, boardId)}
      settingsHref={boardConfigPath(factoryId, boardId)}
      routingHref={boardIntakePath(factoryId, boardId)}
      active={active}
      LinkComponent={HrefLink}
    />
  );
}
