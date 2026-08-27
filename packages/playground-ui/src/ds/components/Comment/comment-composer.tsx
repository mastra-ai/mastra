import { ArrowUp } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { forwardRef } from 'react';

import { useCommentVariant } from './comment-context';
import type { CommentVariant } from './comment-context';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import type { InputGroupButtonProps, InputGroupInputProps } from '@/ds/components/InputGroup';
import type { ControlSize } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

export type CommentComposerProps = ComponentPropsWithoutRef<'form'>;

export const CommentComposer = forwardRef<HTMLFormElement, CommentComposerProps>(({ className, ...props }, ref) => (
  <form ref={ref} data-slot="comment-composer" className={cn('flex w-full items-center gap-2', className)} {...props} />
));
CommentComposer.displayName = 'CommentComposer';

const composerSize: Record<CommentVariant, ControlSize> = {
  default: 'md',
  embed: 'sm',
};

const composerInputVariant: Record<CommentVariant, 'default' | 'outline'> = {
  default: 'outline',
  embed: 'default',
};

export interface CommentComposerInputProps extends InputGroupInputProps {
  /** Layout classes for the surrounding InputGroup. */
  groupClassName?: string;
  children?: ReactNode;
}

export const CommentComposerInput = forwardRef<HTMLInputElement, CommentComposerInputProps>(
  ({ groupClassName, children, ...props }, ref) => {
    const variant = useCommentVariant();

    return (
      <InputGroup size={composerSize[variant]} variant={composerInputVariant[variant]} className={groupClassName}>
        <InputGroupInput ref={ref} data-slot="comment-composer-input" {...props} />
        {children}
      </InputGroup>
    );
  },
);
CommentComposerInput.displayName = 'CommentComposerInput';

export type CommentComposerSendProps = Omit<InputGroupButtonProps, 'children'>;

export const CommentComposerSend = forwardRef<HTMLButtonElement, CommentComposerSendProps>(
  ({ 'aria-label': ariaLabel = 'Send comment', type = 'submit', ...props }, ref) => (
    <InputGroupAddon align="inline-end">
      <InputGroupButton ref={ref} data-slot="comment-composer-send" type={type} aria-label={ariaLabel} {...props}>
        <ArrowUp />
      </InputGroupButton>
    </InputGroupAddon>
  ),
);
CommentComposerSend.displayName = 'CommentComposerSend';
