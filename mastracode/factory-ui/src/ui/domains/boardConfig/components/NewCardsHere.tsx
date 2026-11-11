import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { catchesEveryArrival, placesNewCards } from '../../settings/components/intakeRoutes';
import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import { NEW_CARD_ROUTES_ANCHOR, settingsSectionPath } from '../../settings/settingsSections';

/**
 * How many intake routes land new cards on this board. Routes are one Factory-wide ordered list, so they are listed
 * and edited in Work Intake; routes below the first one taking every new card never place a card and aren't counted.
 */
export function NewCardsHere({ factoryId, board }: { factoryId: string; board: InstalledBoardInfo }) {
  const query = useIntakeRoutesQuery(factoryId);
  const boards = useBoardCatalog(factoryId).data ?? [];
  const arrivals = (query.data?.intakeRoutes ?? []).filter(route => route.enabled && placesNewCards(route));
  const catchAllIndex = arrivals.findIndex(catchesEveryArrival);
  const reachable = catchAllIndex === -1 ? arrivals : arrivals.slice(0, catchAllIndex + 1);
  // A route joining a pull request to its issue's card adds no card, so it isn't counted.
  const count = reachable.filter(route => !route.target.joinClosedIssue && route.target.boardKey === board.id).length;
  const defaultBoard = boards.find(candidate => candidate.id === DEFAULT_BOARD_ID) ?? boards[0];
  const takesLeftovers = catchAllIndex === -1 && defaultBoard?.id === board.id;

  return (
    <SettingsSubsection
      title="New cards"
      action={
        <Button
          size="sm"
          variant="ghost"
          render={<Link to={settingsSectionPath(factoryId, 'intake', NEW_CARD_ROUTES_ANCHOR)} />}
        >
          Edit routes
        </Button>
      }
    >
      <Txt as="p" variant="caption" tone="muted" role={query.isError ? 'alert' : 'status'}>
        {statusText(query, count, takesLeftovers)}
      </Txt>
    </SettingsSubsection>
  );
}

function statusText(query: { isPending: boolean; isError: boolean }, count: number, takesLeftovers: boolean) {
  if (query.isPending) return 'Loading intake routes…';
  if (query.isError) return 'Intake routes didn’t load.';
  if (count === 0) {
    return takesLeftovers ? 'Cards no intake route takes land here.' : 'No intake route sends new cards here.';
  }
  const routes = count === 1 ? '1 intake route sends' : `${count} intake routes send`;
  return `${routes} new cards here${takesLeftovers ? ', plus cards no route takes' : ''}.`;
}
