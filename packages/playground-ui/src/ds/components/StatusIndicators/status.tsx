import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { statusDotClass, type StatusPresentation } from './status-dot-styles';
import { Txt } from '@/ds/components/Txt';
import type { TextRole } from '@/ds/tokens';
import { cn } from '@/lib/utils';

export type StatusProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  presentation: StatusPresentation;
  textVariant?: TextRole | 'inherit';
  children?: ReactNode;
};

export function Status({ presentation, textVariant = 'inherit', children, className, ...props }: StatusProps) {
  const inherit = textVariant === 'inherit';

  return (
    <span className={cn('inline-flex items-center gap-2', !inherit && 'text-foreground', className)} {...props}>
      <span className={statusDotClass(presentation)} aria-hidden />
      {children ??
        (inherit ? (
          presentation.label
        ) : (
          <Txt as="span" variant={textVariant}>
            {presentation.label}
          </Txt>
        ))}
    </span>
  );
}
