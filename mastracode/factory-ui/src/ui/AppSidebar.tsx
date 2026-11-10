import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useBoardQuery } from '../hooks/useBoardEditor';
import { BoardConfigNavigation } from './domains/boardConfig/components/BoardConfigNavigation';
import { useBoardDraftName } from './domains/boardConfig/BoardDraftProvider';
import { useBoardConfigRoute } from './domains/boardConfig/hooks/useBoardConfigRoute';
import type { BoardConfigLocation } from './domains/boardConfig/boardConfigPaths';
import { rememberedBoardPath } from './domains/factory/services/boardViews';

import { SidebarSettingsLink } from './domains/auth/components/SidebarSettingsLink';
import { FactorySection } from './domains/factory/components/FactorySection';
import { SidebarGlobalSearchButton } from './domains/search/components/SidebarGlobalSearchButton';
import { SettingsNavigation } from './domains/settings/components/SettingsNavigation';
import { useSettingsOpen } from './domains/settings/hooks/useSettingsOpen';
import { FactorySwitcher } from './domains/workspaces/components/FactorySwitcher';
import { SessionsSection } from './domains/workspaces/components/SessionsSection';
import { SidebarNewSessionButton } from './domains/workspaces/components/SidebarNewSessionButton';

const MAIN_VIEW = 'main';
const BOARD_CONFIG_VIEW = 'board-config';

export function AppSidebar() {
  const settingsOpen = useSettingsOpen();
  const pageHeaderOwnsToggle = useSidebar().desktopState === 'collapsed';

  return (
    <Sidebar aria-label="Main sidebar" className="h-full">
      <Sidebar.CommandHeader>
        <FactorySwitcher />
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <SidebarGlobalSearchButton />
          {!pageHeaderOwnsToggle && <Sidebar.Trigger />}
        </div>
      </Sidebar.CommandHeader>
      <Sidebar.Nav aria-label={settingsOpen ? 'Settings sections' : 'Main'}>
        {settingsOpen ? <SettingsNavigation /> : <MainNavigation />}
      </Sidebar.Nav>
      <Sidebar.Footer aria-label="Account and settings">
        <Sidebar.NavList>
          <SidebarSettingsLink />
        </Sidebar.NavList>
      </Sidebar.Footer>
    </Sidebar>
  );
}

/** The main navigation, which steps aside for a board's configuration pages while one is open. */
function MainNavigation() {
  const navigate = useNavigate();
  const boardConfig = useBoardConfigRoute();
  // The configuration view keeps its last board while it slides out after leaving.
  const [shownConfig, setShownConfig] = useState(boardConfig);
  if (boardConfig && !sameLocation(boardConfig, shownConfig)) setShownConfig(boardConfig);

  return (
    <Sidebar.NavStack
      value={boardConfig ? BOARD_CONFIG_VIEW : MAIN_VIEW}
      rootValue={MAIN_VIEW}
      // The URL decides the view; going back means leaving the configuration for its board.
      onValueChange={() => {
        if (boardConfig) void navigate(rememberedBoardPath(boardConfig.factoryId, boardConfig.boardId));
      }}
      className="min-h-0 flex-1"
    >
      <Sidebar.NavStack.Root className="flex min-h-0 flex-col gap-4">
        <SidebarNewSessionButton />
        <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Navigation">
          <FactorySection />
          <SessionsSection />
        </section>
      </Sidebar.NavStack.Root>
      {shownConfig && <BoardConfigView {...shownConfig} />}
    </Sidebar.NavStack>
  );
}

function BoardConfigView(location: BoardConfigLocation) {
  const board = useBoardQuery(location.factoryId, location.boardId).data?.board;
  const name = useBoardDraftName(location.factoryId, location.boardId, board);

  return (
    <Sidebar.NavStack.View
      value={BOARD_CONFIG_VIEW}
      // The switcher below names the board; the back row says what the view is and, to assistive tech, where it leads.
      title="Board settings"
      backLabel={`Back to ${name || 'board'}`}
      // The view accompanies a page of form fields: Escape there belongs to the fields, not to leaving.
      closeOnEscape={false}
    >
      <BoardConfigNavigation {...location} />
    </Sidebar.NavStack.View>
  );
}

function sameLocation(a: BoardConfigLocation, b: BoardConfigLocation | undefined) {
  return a.factoryId === b?.factoryId && a.boardId === b.boardId && a.phaseKey === b.phaseKey && a.skills === b.skills;
}
