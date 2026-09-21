import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { statusDotClass, type StatusPresentation } from './status-dot-styles';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type StatusProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  presentation: StatusPresentation;
  children?: ReactNode;
};

export function Status({ presentation, children, className, ...props }: StatusProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-foreground', className)} {...props}>
      <span className={statusDotClass(presentation)} aria-hidden />
      {children ?? (
        <Txt as="span" variant="ui-xs">
          {presentation.label}
        </Txt>
      )}
    </span>
  );
}
