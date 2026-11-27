import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg bg-fill-subtle', className)}>
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
