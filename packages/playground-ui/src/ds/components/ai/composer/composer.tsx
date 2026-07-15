import * as React from 'react';

import { Button } from '../../Button';
import type { ButtonProps } from '../../Button';
import { Textarea } from '../../Textarea';
import type { TextareaProps } from '../../Textarea';
import { cn } from '@/lib/utils';

export const Composer = React.forwardRef<HTMLFormElement, React.FormHTMLAttributes<HTMLFormElement>>(
  ({ className, ...props }, ref) => (
    <form ref={ref} data-slot="composer" className={cn('relative flex w-full flex-col gap-2', className)} {...props} />
  ),
);
Composer.displayName = 'Composer';

export const ComposerBox = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="composer-box"
      className={cn(
        'relative flex w-full flex-col rounded-xl border border-border1 bg-surface3 transition-colors focus-within:border-neutral6/20',
        className,
      )}
      {...props}
    />
  ),
);
ComposerBox.displayName = 'ComposerBox';

export const ComposerAttachments = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="composer-attachments"
      className={cn('flex flex-wrap gap-2 px-3 pt-3', className)}
      {...props}
    />
  ),
);
ComposerAttachments.displayName = 'ComposerAttachments';

export const ComposerAttachment = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="composer-attachment" className={cn('group relative', className)} {...props} />
  ),
);
ComposerAttachment.displayName = 'ComposerAttachment';

type ComposerAttachmentRemoveProps = Omit<ButtonProps, 'type'>;

export const ComposerAttachmentRemove = React.forwardRef<HTMLButtonElement, ComposerAttachmentRemoveProps>(
  ({ className, variant = 'outline', size = 'icon-xs', ...props }, ref) => (
    <Button
      ref={ref}
      data-slot="composer-attachment-remove"
      className={cn('text-icon3 hover:text-icon6 absolute -top-1.5 -right-1.5 bg-surface4', className)}
      variant={variant}
      size={size}
      {...props}
      type="button"
    />
  ),
);
ComposerAttachmentRemove.displayName = 'ComposerAttachmentRemove';

export const ComposerInput = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = 'unstyled', ...props }, ref) => (
    <Textarea
      ref={ref}
      data-slot="composer-input"
      variant={variant}
      className={cn('border-0 pr-24 focus-visible:outline-none', className)}
      {...props}
    />
  ),
);
ComposerInput.displayName = 'ComposerInput';

export const ComposerActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="composer-actions"
      className={cn('absolute right-2 bottom-2 flex items-center gap-1', className)}
      {...props}
    />
  ),
);
ComposerActions.displayName = 'ComposerActions';

type ComposerActionButtonProps = Omit<ButtonProps, 'type'>;

export const ComposerActionButton = React.forwardRef<HTMLButtonElement, ComposerActionButtonProps>(
  ({ variant = 'ghost', size = 'icon-sm', ...props }, ref) => (
    <Button ref={ref} data-slot="composer-action" variant={variant} size={size} {...props} type="button" />
  ),
);
ComposerActionButton.displayName = 'ComposerActionButton';

type ComposerSubmitButtonProps = Omit<ButtonProps, 'type'>;

export const ComposerSubmitButton = React.forwardRef<HTMLButtonElement, ComposerSubmitButtonProps>(
  ({ size = 'icon-sm', ...props }, ref) => (
    <Button ref={ref} data-slot="composer-submit" size={size} {...props} type="submit" />
  ),
);
ComposerSubmitButton.displayName = 'ComposerSubmitButton';
