import type { ComponentPropsWithoutRef } from 'react';
import { statusDotClass, type StatusPresentation } from './status-dot-styles';
import { cn } from '@/lib/utils';

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
