import { useParams } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useWorkItemQuery } from '../../../../hooks/useWorkItems';
import type { SessionFrameSlots } from '../../chat/components/SessionFrame';
import { PanelSubject } from '../../workspace-viewer/components/PanelSubject';
import { boardOf } from '../boardFlow';
import { CardDraftOverview } from '../components/CardDraftOverview';
import { CardStageBar } from '../components/CardStageBar';

export function useCardDraftFrame(workItemId: string | undefined): SessionFrameSlots | undefined {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const card = useWorkItemQuery(factoryId, workItemId);
  const catalog = useBoardCatalog(factoryId);
  const factory = useFactoryQuery(factoryId).data;
  if (!workItemId) return undefined;

  const item = catalog.isPending ? undefined : (card.data ?? undefined);
  const board = item && boardOf(catalog.data, item);
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
