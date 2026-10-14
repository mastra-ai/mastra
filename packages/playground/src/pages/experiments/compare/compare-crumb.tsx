import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useDataset, useDatasetExperimentsQueries } from '@mastra/react/hooks/datasets';
import { ChevronDown, StarIcon } from 'lucide-react';
import { ExperimentIdLink } from './experiment-id-link';
import { useComparedExperimentIds } from './use-compared-experiment-ids';

function useExperimentIds() {
  const { datasetId, baselineId, contenderIds } = useComparedExperimentIds();
  const isComplete = Boolean(datasetId && baselineId && contenderIds.length > 0);
  return { datasetId, experimentIds: isComplete && baselineId ? [baselineId, ...contenderIds] : [] };
}

export function CompareCrumb() {
  const { experimentIds } = useExperimentIds();
  return experimentIds.length > 0 ? `Comparing ${experimentIds.length} experiments` : 'Comparing';
}

/** Completes the crumb with the compared dataset: `Comparing 3 experiments on <dataset>`. Falls back to its id. */
export function CompareCrumbDataset() {
  const { datasetId } = useComparedExperimentIds();
  const { Link, paths } = useLinkComponent();
  const { data: dataset, isLoading } = useDataset({
    datasetId: datasetId ?? '',
    queryOptions: { enabled: Boolean(datasetId) },
  });
  if (!datasetId || isLoading) return null;

  return (
    <Txt as="span" variant="caption" tone="muted" className="ml-1 flex min-w-0 items-center gap-1 whitespace-nowrap">
      on
      {/* Positioned so it sits above the switcher, whose hit area covers the whole current crumb. */}
      <Link
        href={paths.datasetLink(datasetId)}
        className="relative max-w-48 min-w-0 truncate text-foreground hover:underline"
      >
        {dataset?.name || datasetId}
      </Link>
    </Txt>
  );
}

/** Icon-only switcher, like the entity crumbs: hovering it lists the compared experiments. */
export function CompareCrumbSwitcher() {
  const { datasetId, experimentIds } = useExperimentIds();
  // Same queries as the page body: served from the cache.
  const { data: experimentsById } = useDatasetExperimentsQueries({ datasetId: datasetId ?? '', experimentIds });
  if (experimentIds.length === 0) return null;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={100}
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Show compared experiments">
            <ChevronDown />
          </Button>
        }
      />
      <HoverCardContent side="bottom" align="end" sideOffset={4} showArrow={false} className="w-72 p-1.5">
        <ul aria-label="Compared experiments" className="grid gap-0.5">
          {experimentIds.map((id, index) => (
            <li key={id} className="grid">
              <ExperimentIdLink
                className="w-full max-w-none justify-start"
                experimentId={id}
                name={experimentsById[id]?.name}
                role={index === 0 ? 'baseline' : 'contender'}
                trailing={
                  index === 0 && (
                    <Badge variant="purple" size="sm" icon={<StarIcon className="fill-current" />}>
                      Baseline
                    </Badge>
                  )
                }
              />
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
