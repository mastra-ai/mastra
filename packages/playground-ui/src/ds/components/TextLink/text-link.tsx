import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { ArrowUpRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { iconSizeClasses } from '@/ds/icons/icon-size-classes';
import { controlStateColorTransition, focusRingOffset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface TextLinkProps extends useRender.ComponentProps<'a'> {
  icon?: ReactNode;
}

export function TextLink({
  render,
  icon = <ArrowUpRightIcon aria-hidden />,
  className,
  children,
  ...props
}: TextLinkProps) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        className: cn(
          'group/text-link inline-flex w-fit max-w-full min-w-0 items-center gap-1 rounded-xs',
          'text-muted-foreground hover:text-foreground',
          iconSizeClasses.sm,
          '[&>svg]:shrink-0',
          controlStateColorTransition,
          focusRingOffset,
          className,
        ),
        children: (
          <>
            <span
              data-slot="text-link-label"
              className={cn(
                'relative min-w-0 truncate',
                'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current',
                'after:transition-transform after:duration-fast after:ease-out-custom motion-reduce:after:transition-none',
                'group-hover/text-link:after:scale-x-100 group-hover/text-link:after:duration-normal',
              )}
            >
              {children}
            </span>
            {icon}
          </>
        ),
      },
      props,
    ),
  });
}
