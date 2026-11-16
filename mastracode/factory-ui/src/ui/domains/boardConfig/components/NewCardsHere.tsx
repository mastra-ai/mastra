import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useBoardRulesQuery } from '../../../../hooks/useIntakeRoutes';
import { useIntakeOrderQuery } from '../../../../hooks/useIntakeOrder';
import { newItemRules, ordinal } from '../../boardRules/ruleLanes';
import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import { boardRulesPath } from '../boardConfigPaths';

/**
 * What this board takes when a new item arrives: how many of its rules can file one, and where it sits in the intake
 * order. Rules below an arrival lane's first rule taking every item are never reached, so they aren't counted.
 */
export function NewCardsHere({ factoryId, board }: { factoryId: string; board: InstalledBoardInfo }) {
  const rulesQuery = useBoardRulesQuery(factoryId, board.id);
  const orderQuery = useIntakeOrderQuery(factoryId);
  const { count } = newItemRules(rulesQuery.data?.intakeRoutes ?? []);
  const at = (orderQuery.data?.boards ?? []).findIndex(entry => entry.boardKey === board.id);
  const failed = rulesQuery.isError || orderQuery.isError;

  return (
    <SettingsSubsection
      title="New items"
      action={
        <Button size="sm" variant="ghost" render={<Link to={boardRulesPath(factoryId, board.id)} />}>
          Edit rules
        </Button>
      }
    >
      <Txt
        as="p"
        variant="caption"
        tone="muted"
        role={failed ? 'alert' : 'status'}
        className="flex flex-wrap gap-x-3 gap-y-1"
      >
        {rulesQuery.isPending || orderQuery.isPending ? (
          'Loading rules…'
        ) : failed ? (
          'Rules didn’t load.'
        ) : (
          <>
            <span>{ruleCount(count)}</span>
            <span>{at === -1 ? 'Not in the intake order' : `Checked ${ordinal(at + 1)}`}</span>
          </>
        )}
      </Txt>
    </SettingsSubsection>
  );
}

function ruleCount(count: number) {
  if (count === 0) return 'No rules for new items';
  return count === 1 ? '1 rule for new items' : `${count} rules for new items`;
}
