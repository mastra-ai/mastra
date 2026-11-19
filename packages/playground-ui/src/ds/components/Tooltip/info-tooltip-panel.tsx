import type { ComponentProps, ReactNode } from 'react';

import { illustrationPlateStyle } from '@/ds/primitives/illustration-plate';
import { cn } from '@/lib/utils';

type InfoTooltipPanelProps = Omit<ComponentProps<'figure'>, 'title'> & {
  title: ReactNode;
  caption: ReactNode;
};

function InfoTooltipPanel({ title, caption, children, className, ...props }: InfoTooltipPanelProps) {
  return (
    <figure className={cn('row-span-3 grid grid-rows-subgrid justify-items-start text-start', className)} {...props}>
      <figcaption className="text-column text-foreground">{title}</figcaption>
      <div aria-hidden className={cn(illustrationPlateStyle, 'justify-self-stretch')}>
        {children}
      </div>
      <p className="text-caption text-muted-foreground">{caption}</p>
    </figure>
  );
}

export { InfoTooltipPanel };
export type { InfoTooltipPanelProps };
