import { Button } from '@mastra/playground-ui/components/Button';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useMatch } from 'react-router';

/** The sidebar lists datasets; the open dataset's items and the experiments run on it switch from this row. */
export function DatasetViewTabs({ datasetId }: { datasetId: string }) {
  const { Link } = useLinkComponent();
  const showsExperiments = Boolean(useMatch('/datasets/:datasetId/experiments'));
  const base = `/datasets/${encodeURIComponent(datasetId)}`;
  const views = [
    { label: 'Items', href: base, isActive: !showsExperiments },
    { label: 'Experiments', href: `${base}/experiments`, isActive: showsExperiments },
  ];

  return (
    <nav aria-label="Dataset views" className="flex min-w-0 items-center gap-1">
      {views.map(view => (
        <Button
          key={view.label}
          variant={view.isActive ? 'default' : 'ghost'}
          size="sm"
          aria-current={view.isActive ? 'page' : undefined}
          render={<Link href={view.href} />}
        >
          {view.label}
        </Button>
      ))}
    </nav>
  );
}
