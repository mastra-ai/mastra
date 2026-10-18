import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { isValidElement, type ReactNode } from 'react';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface NoticeButtonProps extends useRender.ComponentProps<'button'> {
  icon?: ReactNode;
}

function nativeButtonProps(render: NoticeButtonProps['render']) {
  if (!render || (isValidElement(render) && render.type === 'button')) return { type: 'button' as const };
  return {};
}

export function NoticeButton({ render, icon, className, children, ...props }: NoticeButtonProps) {
  return useRender({
    defaultTagName: 'button',
    render,
    props: mergeProps<'button'>(
      nativeButtonProps(render),
      {
        className: cn(
          'inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-xs text-label text-foreground',
          'underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground',
          transitions.colors,
          'outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-focus',
          'disabled:cursor-not-allowed disabled:text-muted-foreground [&>svg]:size-icon-sm [&>svg]:shrink-0',
          className,
        ),
        children: (
          <>
            {icon}
            {children}
          </>
        ),
      },
      props,
    ),
  });
}
