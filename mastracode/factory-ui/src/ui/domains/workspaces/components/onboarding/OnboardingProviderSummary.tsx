import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

/** A lane's provider at a glance: its icon, its name with an optional badge, then what it means now. */
export function OnboardingProviderSummary({
  icon,
  title,
  badge,
  meta,
}: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  meta: ReactNode;
}) {
  return (
    <>
      <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Txt as="span" variant="label" className="flex min-h-5 flex-wrap items-center gap-x-2">
          {title}
          {badge}
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="block">
          {meta}
        </Txt>
      </span>
    </>
  );
}

export function RecommendedBadge() {
  return (
    <Badge size="xs" emphasis="subtle">
      Recommended
    </Badge>
  );
}
