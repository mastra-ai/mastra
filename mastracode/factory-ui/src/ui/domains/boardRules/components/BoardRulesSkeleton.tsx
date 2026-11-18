import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { useSearchParams } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useIntakeOrderQuery } from '../../../../hooks/useIntakeOrder';
import { boardRulesPath, RULES_INTO_PARAM, RULES_LEAVING_PARAM } from '../../boardConfig/boardConfigPaths';
import { arrivalFooter, isOpenedLane, LANE_SECTIONS } from '../ruleLanes';
import { IntakeChain } from './IntakeChain';
import { IntoFilter } from './IntoFilter';
import { LaneCard, LaneEnd, LaneSection } from './RuleLaneFrame';

export function BoardRulesSkeleton({
  factoryId,
  boardId,
  board,
}: {
  factoryId: string;
  boardId: string;
  board: InstalledBoardInfo | undefined;
}) {
  const order = useIntakeOrderQuery(factoryId);
  const [params] = useSearchParams();
  const into = params.get(RULES_INTO_PARAM) ?? undefined;
  const leaving = params.has(RULES_LEAVING_PARAM);
  const pendingText = <SkeletonText line="text-caption" className="w-48 motion-reduce:before:animate-none" />;

  return (
    <div role="status" aria-label="Loading rules" className="flex flex-col gap-8">
      {leaving || into !== undefined ? (
        <div inert>
          <IntoFilter
            count={undefined}
            pending
            board={board}
            into={into}
            leaving={leaving}
            showAll={boardRulesPath(factoryId, boardId)}
          />
        </div>
      ) : (
        LANE_SECTIONS.map(section => (
          <LaneSection
            key={section.title}
            title={section.title}
            events={section.events}
            chain={<IntakeChain factoryId={factoryId} boardKey={boardId} />}
          >
            {section.events.map(event => (
              <LaneCard key={event} event={event}>
                <ol inert className="flex min-w-0 flex-col">
                  <LaneEnd
                    fallback={isOpenedLane(event) && order.data ? arrivalFooter(order.data, boardId) : pendingText}
                    onAdd={() => undefined}
                  />
                </ol>
              </LaneCard>
            ))}
          </LaneSection>
        ))
      )}
    </div>
  );
}
