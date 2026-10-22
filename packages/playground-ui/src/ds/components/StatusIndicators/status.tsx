import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../../lib/utils';
import { statusDotClass } from './status-dot-styles';
import type { StatusPresentation } from './status-dot-styles';

export type StatusProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  presentation: StatusPresentation;
};

export function Status({ presentation, className, ...props }: StatusProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...props}>
      <span className={statusDotClass(presentation)} aria-hidden />
      {presentation.label}
    </span>
  );
}
