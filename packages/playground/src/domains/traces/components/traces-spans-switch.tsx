import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Link } from 'react-router';

type ObservabilityView = 'traces' | 'spans';

const VIEWS: { id: ObservabilityView; label: string; to: string }[] = [
  { id: 'traces', label: 'Traces', to: '/traces' },
  { id: 'spans', label: 'Spans', to: '/spans' },
];

// The header row is inset less than the action row below it; `px-2` lines the switch up with the
// filter bar, and with the breadcrumbs on every other page.
const SWITCH_CLASS = 'flex shrink-0 items-center gap-1 px-2';

export function TracesSpansSwitch({ current }: { current: ObservabilityView }) {
  return (
    <nav aria-label="Observability views" className={SWITCH_CLASS}>
      {VIEWS.map(view => {
        const isCurrent = view.id === current;
        return (
          <Button
            key={view.id}
            render={<Link to={view.to} />}
            size="sm"
            // Both borderless (unlike `ghost`), so the selected one keeps the same box and nothing shifts.
            variant={isCurrent ? 'subtle' : 'default'}
            aria-current={isCurrent ? 'page' : undefined}
          >
            {view.label}
          </Button>
        );
      })}
    </nav>
  );
}

/** Holds the switch's place while the store capabilities that decide whether it shows are loading. */
export function TracesSpansSwitchSkeleton() {
  return (
    <div role="status" aria-label="Loading views" className={SWITCH_CLASS}>
      {VIEWS.map(view => (
        <Skeleton key={view.id} className="h-control-sm w-16 rounded-full" />
      ))}
    </div>
  );
}
