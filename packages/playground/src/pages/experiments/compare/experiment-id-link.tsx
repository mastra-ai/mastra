import { Button } from '@mastra/playground-ui/components/Button';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

const dotClass = { baseline: 'bg-badge-purple-indicator', contender: 'bg-badge-blue-indicator' } as const;

export function ExperimentIdLink({
  experimentId,
  name,
  role,
  className,
  trailing,
}: {
  experimentId: string;
  name?: string | null;
  /** Colours a leading dot like the comparison column badges. */
  role?: keyof typeof dotClass;
  className?: string;
  /** Rendered on the right edge, e.g. a role badge. */
  trailing?: ReactNode;
}) {
  const { Link, paths } = useLinkComponent();
  const label = name || experimentId.slice(0, 8);
  return (
    <Button
      render={<Link href={paths.experimentLink(experimentId)} />}
      variant="ghost"
      size="sm"
      className={cn('max-w-48 min-w-0', className)}
      aria-label={`Open experiment ${label}`}
    >
      {role && <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', dotClass[role])} />}
      <span className="min-w-0 truncate">{label}</span>
      {trailing && <span className="ml-auto flex shrink-0">{trailing}</span>}
    </Button>
  );
}
