import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type DataListNoMatchProps = ComponentPropsWithoutRef<'div'> & {
  message?: string;
};

export function DataListNoMatch({
  message = 'Nothing matches your search',
  className,
  ...props
}: DataListNoMatchProps) {
  return (
    <div
      className={cn('col-span-full flex flex-col items-center justify-center gap-2 py-12 text-neutral3', className)}
      {...props}
    >
      <p className="text-ui-md">{message}</p>
    </div>
  );
}
