import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useBeforeUnload, useBlocker, useNavigate, useSearchParams } from 'react-router';

import { useFactorySkillsQuery } from '../../../hooks/useFactorySkills';
import { useSourceSuggestions } from '../../../hooks/useSourceSuggestions';
import { BoardSettingsHostContext } from '../../domains/boardCanvas/boardSettingsHost';
import type { BoardSettingsHost, BoardSettingsLeaveGuard } from '../../domains/boardCanvas/boardSettingsHost';
import {
  boardConfigPath,
  boardIntakePath,
  INTAKE_ORDER_ANCHOR,
  parseBoardConfigPath,
} from '../../domains/boardConfig/boardConfigPaths';
import { ChatHeaderSidebarTrigger } from '../../domains/chat/components/ChatHeaderSidebarTrigger';
import { boardPath } from '../../domains/factory/boardCatalog';
import { rememberedBoardPath } from '../../domains/factory/services/boardViews';
import { SettingsHrefLink } from '../../domains/settings/components/SettingsHrefLink';
import { newSkillPath, settingsSectionPath, skillPath } from '../../domains/settings/settingsSections';
import { HrefLink } from '../../ui/HrefLink';

function useRouterLeaveGuard(boardId: string, changed: () => boolean): BoardSettingsLeaveGuard {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!changed()) return false;
    const factoryId = parseBoardConfigPath(currentLocation.pathname)?.factoryId;
    const next = parseBoardConfigPath(nextLocation.pathname);
    if (!next) return true;
    // Routing has no save bar, so leaving for it counts as leaving the board's settings.
    return next.factoryId !== factoryId || next.boardId !== boardId || next.intake === true;
  });
  // Reloading or closing the tab would drop the edits too.
  useBeforeUnload(event => {
    if (changed()) event.preventDefault();
  });
  return {
    blocked: blocker.state === 'blocked',
    stay: () => blocker.reset?.(),
    leave: () => blocker.proceed?.(),
  };
}

/** Factory's board settings links and data, read from its router, skills and integrations. */
export function RouterBoardSettingsHost({ factoryId, children }: { factoryId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const skills = useFactorySkillsQuery(factoryId).data;
  const sourceSuggestions = useSourceSuggestions(factoryId);

  const host = useMemo(
    (): BoardSettingsHost => ({
      configHref: (boardId, phaseKey, focus) => boardConfigPath(factoryId, boardId, phaseKey, focus),
      routingHref: (boardId, options) =>
        boardIntakePath(factoryId, boardId, options?.intakeOrder ? { anchor: INTAKE_ORDER_ANCHOR } : {}),
      boardHref: (boardId, options) =>
        options?.view === 'default' ? boardPath(factoryId, boardId) : rememberedBoardPath(factoryId, boardId),
      homeHref: () => `/factories/${factoryId}`,
      skillHref: skillName => skillPath(factoryId, skillName),
      skillsHref: () => settingsSectionPath(factoryId, 'skills'),
      newSkillHref: () => newSkillPath(factoryId),
      navigate: (href, options) => void navigate(href, options),
      searchParams,
      tabsLeading: <ChatHeaderSidebarTrigger />,
      LinkComponent: HrefLink,
      SettingsLinkComponent: SettingsHrefLink,
      skills,
      sourceSuggestions,
      useLeaveGuard: useRouterLeaveGuard,
    }),
    [factoryId, navigate, searchParams, skills, sourceSuggestions],
  );

  return <BoardSettingsHostContext.Provider value={host}>{children}</BoardSettingsHostContext.Provider>;
}
