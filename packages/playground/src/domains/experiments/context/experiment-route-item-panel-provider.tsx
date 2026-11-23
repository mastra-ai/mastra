import { ExperimentItemPanelProvider } from '@mastra/playground-ui/domains/experiments/context/experiment-item-panel-context';
import type { ExperimentItemPanelProviderProps } from '@mastra/playground-ui/domains/experiments/context/experiment-item-panel-context';
import { useMatch, useNavigate } from 'react-router';

export type ExperimentRouteItemPanelProviderProps = Omit<
  ExperimentItemPanelProviderProps,
  'currentItemId' | 'onOpenItem' | 'onClose'
>;

/** Item panel state bound to the `/experiments/:experimentId/items/:itemId` route. */
export function ExperimentRouteItemPanelProvider(props: ExperimentRouteItemPanelProviderProps) {
  const navigate = useNavigate();
  const match = useMatch('/experiments/:experimentId/items/:itemId');

  return (
    <ExperimentItemPanelProvider
      {...props}
      currentItemId={match?.params.itemId}
      onOpenItem={itemId => void navigate(`/experiments/${props.experimentId}/items/${encodeURIComponent(itemId)}`)}
      onClose={() => void navigate(`/experiments/${props.experimentId}`)}
    />
  );
}
