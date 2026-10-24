import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import { ButtonLabel, buttonVariants } from '../Button/Button';
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
        className: cn(buttonVariants({ variant: 'link' }), 'min-w-0 [&>svg]:size-icon-sm [&>svg]:shrink-0', className),
        children: (
          <>
            {icon}
            <ButtonLabel variant="link">{children}</ButtonLabel>
          </>
        ),
      },
      props,
    ),
  });
}
