import { cn } from '@mastra/playground-ui/utils/cn';
import type { LucideIcon } from 'lucide-react';

export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span className={cn('bg-fill-subtle flex size-8 shrink-0 items-center justify-center rounded-lg', className)}>
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
