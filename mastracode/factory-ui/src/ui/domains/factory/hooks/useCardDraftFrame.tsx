import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { PanelSubject } from '../../workspace-viewer/components/PanelSubject';
import { CardDraftOverview } from '../components/CardDraftOverview';
import { CardStageBar } from '../components/CardStageBar';
import type { SessionFrameSlots } from '../components/SessionRouteFrame';
import { useDraftCard } from './useDraftCard';

export function useCardDraftFrame(workItemId: string | undefined): SessionFrameSlots | undefined {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { catalog, item, board } = useDraftCard(factoryId, workItemId);
  const factory = useFactoryQuery(factoryId).data;
  if (!workItemId) return undefined;

  return {
    panel:
      item && factory
        ? {
            subject: lead => <PanelSubject lead={lead} title={item.title} />,
            overview: () => (
              <CardDraftOverview
                factory={factory}
                item={item}
                boards={catalog.data}
                boardsFailed={catalog.isLoadingError}
              />
            ),
          }
        : undefined,
    headerCenter:
      item && board && factory ? (
        <CardStageBar item={item} sessionItems={[item]} board={board} factory={factory} />
      ) : undefined,
  };
}
