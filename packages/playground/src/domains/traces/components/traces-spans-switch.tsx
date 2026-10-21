import { Button } from '@mastra/playground-ui/components/Button';
import { Link } from 'react-router';

type ObservabilityView = 'traces' | 'spans';

const VIEWS: { id: ObservabilityView; label: string; to: string }[] = [
  { id: 'traces', label: 'Traces', to: '/traces' },
  { id: 'spans', label: 'Spans', to: '/spans' },
];

export function TracesSpansSwitch({ current }: { current: ObservabilityView }) {
  return (
    <nav aria-label="Observability views" className="flex shrink-0 items-center gap-1">
      {VIEWS.map(view => {
        const isCurrent = view.id === current;
        return (
          <Button
            key={view.id}
            render={<Link to={view.to} />}
            size="sm"
            variant={isCurrent ? 'subtle' : 'ghost'}
            aria-current={isCurrent ? 'page' : undefined}
          >
            {view.label}
          </Button>
        );
      })}
    </nav>
  );
}
