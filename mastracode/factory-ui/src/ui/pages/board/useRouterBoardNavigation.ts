import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { boardConfigPath } from '../../domains/boardConfig/boardConfigPaths';
import type { BoardNavigation } from '@mastra/playground-ui/domains/factory';
import { factoryAttentionTargetPath } from '../../domains/factory/services/attention';
import { rememberedBoardPath } from '../../domains/factory/services/boardViews';
import { settingsSectionPath } from '../../domains/settings/settingsSections';
import { cardPath, threadPath } from '../../domains/workspaces/services/factoryPaths';
import { HrefLink } from '../../ui/HrefLink';

/** Factory's board links and view state, read from and written to the router. */
export function useRouterBoardNavigation(factoryId: string): BoardNavigation {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  return useMemo(
    () => ({
      LinkComponent: HrefLink,
      navigate: href => void navigate(href),
      cardHref: (cardId, session) => cardPath(factoryId, cardId, session),
      sessionHref: session => threadPath(factoryId, session),
      boardHref: boardId => rememberedBoardPath(factoryId, boardId),
      boardCardHref: (boardId, cardId) =>
        factoryAttentionTargetPath(factoryId, { kind: 'work-item', workItemId: cardId, board: boardId }),
      boardConfigHref: (boardId, phaseId) => boardConfigPath(factoryId, boardId, phaseId),
      newIntakeRuleHref: boardId => boardConfigPath(factoryId, boardId, undefined, { newRule: {} }),
      intakeSettingsHref: () => settingsSectionPath(factoryId, 'intake'),
      searchParams,
      replaceSearchParams: params => setSearchParams(params, { replace: true }),
    }),
    [factoryId, navigate, searchParams, setSearchParams],
  );
}
