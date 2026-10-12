import { Notice } from '@mastra/playground-ui/components/Notice';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { previousPeriodLabels } from '../overview-period';
import type { OverviewRange } from '../overview-period';

export interface Regression {
  key: string;
  name: string;
  href: string;
  reasons: string[];
}

export function AttentionStrip({ regressions, range }: { regressions: Regression[]; range: OverviewRange }) {
  const { Link } = useLinkComponent();
  if (regressions.length === 0) return null;
  return (
    <section aria-label="Needs attention">
      <Notice variant="warning" title={`Needs attention · worse than the ${previousPeriodLabels[range]}`}>
        <ul className="flex flex-col gap-1">
          {regressions.map(regression => (
            <li key={regression.key} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <Link href={regression.href} className="text-label text-foreground underline-offset-2 hover:underline">
                {regression.name}
              </Link>
              <span className="tabular-nums">{regression.reasons.join(' · ')}</span>
            </li>
          ))}
        </ul>
      </Notice>
    </section>
  );
}
