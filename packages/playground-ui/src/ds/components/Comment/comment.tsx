import { cva } from 'class-variance-authority';
import type { ComponentPropsWithoutRef } from 'react';
import { forwardRef } from 'react';

import { CommentContext, useCommentVariant } from './comment-context';
import type { CommentVariant } from './comment-context';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

const commentVariants = cva('flex flex-col', {
  variants: {
    variant: {
      default: 'gap-2',
      embed: 'gap-1 rounded-xl border border-border1 bg-surface3 p-3',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface CommentProps extends ComponentPropsWithoutRef<'div'> {
  variant?: CommentVariant;
}

export const Comment = forwardRef<HTMLDivElement, CommentProps>(({ className, variant = 'default', ...props }, ref) => (
  <CommentContext.Provider value={variant}>
    <div
      ref={ref}
      data-slot="comment"
      data-variant={variant}
      className={cn(commentVariants({ variant }), className)}
      {...props}
    />
  </CommentContext.Provider>
));
Comment.displayName = 'Comment';

const commentListGap: Record<CommentVariant, string> = {
  default: 'gap-3',
  embed: 'gap-2',
};

export type CommentListProps = ComponentPropsWithoutRef<'ul'>;

export const CommentList = forwardRef<HTMLUListElement, CommentListProps>(({ className, ...props }, ref) => {
  const variant = useCommentVariant();

  return (
    <ul
      ref={ref}
      data-slot="comment-list"
      className={cn('flex flex-col', commentListGap[variant], className)}
      {...props}
    />
  );
});
CommentList.displayName = 'CommentList';

export type CommentItemProps = ComponentPropsWithoutRef<'li'>;

export const CommentItem = forwardRef<HTMLLIElement, CommentItemProps>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-slot="comment-item"
    className={cn('group/comment-item flex flex-col gap-1', className)}
    {...props}
  />
));
CommentItem.displayName = 'CommentItem';

export type CommentItemHeaderProps = ComponentPropsWithoutRef<'div'>;

export const CommentItemHeader = forwardRef<HTMLDivElement, CommentItemHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="comment-item-header" className={cn('flex items-center gap-2', className)} {...props} />
));
CommentItemHeader.displayName = 'CommentItemHeader';

export type CommentItemAuthorProps = ComponentPropsWithoutRef<'span'>;

export const CommentItemAuthor = forwardRef<HTMLElement, CommentItemAuthorProps>(({ className, ...props }, ref) => (
  <Txt
    ref={ref}
    as="span"
    variant="ui-md"
    data-slot="comment-item-author"
    className={cn('font-medium text-neutral6', className)}
    {...props}
  />
));
CommentItemAuthor.displayName = 'CommentItemAuthor';

export type CommentItemTimestampProps = ComponentPropsWithoutRef<'time'>;

export const CommentItemTimestamp = forwardRef<HTMLTimeElement, CommentItemTimestampProps>(
  ({ className, ...props }, ref) => (
    <time
      ref={ref}
      data-slot="comment-item-timestamp"
      className={cn('text-ui-sm leading-ui-sm text-neutral3', className)}
      {...props}
    />
  ),
);
CommentItemTimestamp.displayName = 'CommentItemTimestamp';

const commentItemBodyRule: Record<CommentVariant, string> = {
  default: 'border-l border-border1 pl-3',
  embed: '',
};

export type CommentItemBodyProps = ComponentPropsWithoutRef<'p'>;

export const CommentItemBody = forwardRef<HTMLElement, CommentItemBodyProps>(({ className, ...props }, ref) => {
  const variant = useCommentVariant();

  return (
    <Txt
      ref={ref}
      variant="ui-md"
      data-slot="comment-item-body"
      className={cn('whitespace-pre-wrap text-neutral6', commentItemBodyRule[variant], className)}
      {...props}
    />
  );
});
CommentItemBody.displayName = 'CommentItemBody';

export type CommentItemActionsProps = ComponentPropsWithoutRef<'div'>;

/** Hidden in the `embed` variant, which drops per-item actions. */
export const CommentItemActions = forwardRef<HTMLDivElement, CommentItemActionsProps>(
  ({ className, ...props }, ref) => {
    const variant = useCommentVariant();
    if (variant === 'embed') return null;

    return (
      <div
        ref={ref}
        data-slot="comment-item-actions"
        className={cn(
          'flex items-center gap-1 opacity-0 group-focus-within/comment-item:opacity-100 group-hover/comment-item:opacity-100',
          'motion-safe:transition-opacity',
          className,
        )}
        {...props}
      />
    );
  },
);
CommentItemActions.displayName = 'CommentItemActions';
