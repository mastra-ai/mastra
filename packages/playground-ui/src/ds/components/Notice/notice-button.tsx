import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import {
  BUTTON_LOADING_PROPS,
  ButtonIcon,
  ButtonLabel,
  buttonLoadingClassName,
  buttonVariants,
} from '../Button/Button';
import { cn } from '@/lib/utils';

export interface NoticeButtonProps extends useRender.ComponentProps<'button'> {
  icon?: ReactNode;
  /** Same as Button's `loading`. */
  loading?: boolean;
}

function nativeButtonProps(render: NoticeButtonProps['render']) {
  if (!render || (isValidElement(render) && render.type === 'button')) return { type: 'button' as const };
  return {};
}

export function NoticeButton({ render, icon, loading, className, children, ...props }: NoticeButtonProps) {
  const recipe = buttonVariants({ variant: 'link' });
  return useRender({
    defaultTagName: 'button',
    render,
    props: mergeProps<'button'>(
      nativeButtonProps(render),
      {
        className: cn(
          loading ? buttonLoadingClassName(recipe) : recipe,
          'min-w-0 text-foreground [&>svg]:size-icon-sm [&>svg]:shrink-0',
          className,
        ),
        children: (
          <>
            {loading ? (
              <ButtonIcon size="sm" loading>
                {icon}
              </ButtonIcon>
            ) : (
              icon
            )}
            <ButtonLabel variant="link">{children}</ButtonLabel>
          </>
        ),
      },
      props,
      loading ? BUTTON_LOADING_PROPS : undefined,
    ),
  });
}
