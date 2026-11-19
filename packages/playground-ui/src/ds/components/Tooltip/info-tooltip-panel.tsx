import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type InfoTooltipPanelProps = Omit<ComponentProps<'figure'>, 'title'> & {
  title: ReactNode;
  caption: ReactNode;
};

function InfoTooltipPanel({ title, caption, children, className, ...props }: InfoTooltipPanelProps) {
  return (
    <figure className={cn('row-span-3 grid grid-rows-subgrid justify-items-start text-start', className)} {...props}>
      <figcaption className="text-column text-foreground">{title}</figcaption>
      <div
        aria-hidden
        className="flex flex-col items-center justify-end gap-1 justify-self-stretch rounded-md bg-fill p-3"
      >
        {children}
      </div>
      <p className="text-caption text-muted-foreground">{caption}</p>
    </figure>
  );
}

export { InfoTooltipPanel };
export type { InfoTooltipPanelProps };
