import { ScoreAsItemDialog } from './score-as-item-dialog';
import { ScoreDataPanelView } from './score-data-panel-view';
import type { ScoreDataPanelViewProps } from './score-data-panel-view';
import { useLinkComponent } from '@/lib/framework';

export type ScoreDataPanelProps = Omit<ScoreDataPanelViewProps, 'onOpenTrace' | 'renderDatasetDialog'>;

/**
 * Studio's score drawer: {@link ScoreDataPanelView} opening the trace and span through Studio's router, with
 * Studio's dataset dialog. A host with its own transport renders `ScoreDataPanelView` with its own callbacks.
 */
export function ScoreDataPanel(props: ScoreDataPanelProps) {
  const { navigate, paths } = useLinkComponent();
  // An app with no trace page (its builder returns '') shows the ids as text.
  const onOpenTrace = paths.traceLink('_')
    ? (traceId: string, spanId?: string) => navigate(paths.traceLink(traceId, spanId))
    : undefined;
  return (
    <ScoreDataPanelView
      {...props}
      onOpenTrace={onOpenTrace}
      renderDatasetDialog={dialog => <ScoreAsItemDialog {...dialog} />}
    />
  );
}
