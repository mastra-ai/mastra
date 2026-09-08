import { cva } from 'class-variance-authority';
import type { ComponentPropsWithoutRef, HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { CommentContext, useCommentVariant } from './comment-context';
import type { CommentVariant } from './comment-context';
import { Txt } from '@/ds/components/Txt';
import type { TxtProps } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

const commentVariants = cva('flex flex-col', {
  variants: {
    variant: {
      default: 'gap-2',
      embed: 'gap-1 rounded-xl border border-border1 bg-surface3 p-3',
      thread: '',
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
  thread: '',
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

const commentItemLayout: Record<CommentVariant, string> = {
  default: 'flex flex-col gap-1',
  embed: 'flex flex-col gap-1',
  thread: 'relative flex gap-2 rounded-lg px-2 hover:bg-surface3/60',
};

export interface CommentItemProps extends HTMLAttributes<HTMLElement> {
  /** Same author moments after the row above: the header is dropped and the row tightens. */
  continued?: boolean;
  /** The comment a link pointed at. */
  highlighted?: boolean;
}

export const CommentItem = forwardRef<HTMLElement, CommentItemProps>(
  ({ className, continued = false, highlighted = false, ...props }, ref) => {
    const variant = useCommentVariant();
    // A thread row is a stream entry among runs and moves, not a list item.
    const Root = variant === 'thread' ? 'div' : 'li';

    return (
      <Root
        // Cast needed: `Root` is polymorphic, so TS narrows the expected ref to a single element type.
        ref={ref as never}
        data-slot="comment-item"
        className={cn(
          'group/comment-item',
          commentItemLayout[variant],
          variant === 'thread' && (continued ? 'py-0.5' : 'py-1.5'),
          highlighted && 'bg-accent1/10',
          className,
        )}
        {...props}
      />
    );
  },
);
CommentItem.displayName = 'CommentItem';

export type CommentItemAvatarProps = ComponentPropsWithoutRef<'div'>;

/** Fixed gutter: left empty on a continuation row, it keeps the body aligned under the avatar above. */
export const CommentItemAvatar = forwardRef<HTMLDivElement, CommentItemAvatarProps>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="comment-item-avatar" className={cn('w-6 shrink-0 pt-0.5', className)} {...props} />
));
CommentItemAvatar.displayName = 'CommentItemAvatar';

export type CommentItemContentProps = ComponentPropsWithoutRef<'div'>;

/** Everything beside the gutter, stacked and free to shrink so long words wrap instead of widening the row. */
export const CommentItemContent = forwardRef<HTMLDivElement, CommentItemContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="comment-item-content" className={cn('min-w-0 flex-1', className)} {...props} />
  ),
);
CommentItemContent.displayName = 'CommentItemContent';

const commentItemHeaderLayout: Record<CommentVariant, string> = {
  default: 'flex items-center gap-2',
  embed: 'flex items-center gap-2',
  thread: 'flex items-baseline gap-1.5',
};

export type CommentItemHeaderProps = ComponentPropsWithoutRef<'div'>;

export const CommentItemHeader = forwardRef<HTMLDivElement, CommentItemHeaderProps>(({ className, ...props }, ref) => {
  const variant = useCommentVariant();

  return (
    <div
      ref={ref}
      data-slot="comment-item-header"
      className={cn(commentItemHeaderLayout[variant], className)}
      {...props}
    />
  );
});
CommentItemHeader.displayName = 'CommentItemHeader';

const commentItemAuthorSize: Record<CommentVariant, TxtProps['variant']> = {
  default: 'ui-md',
  embed: 'ui-md',
  thread: 'ui-sm',
};

const commentItemAuthorTone: Record<CommentVariant, string> = {
  default: 'font-medium text-neutral6',
  embed: 'font-medium text-neutral6',
  thread: 'truncate font-medium text-neutral6',
};

export type CommentItemAuthorProps = ComponentPropsWithoutRef<'span'>;

export const CommentItemAuthor = forwardRef<HTMLElement, CommentItemAuthorProps>(({ className, ...props }, ref) => {
  const variant = useCommentVariant();

  return (
    <Txt
      ref={ref}
      as="span"
      variant={commentItemAuthorSize[variant]}
      data-slot="comment-item-author"
      className={cn(commentItemAuthorTone[variant], className)}
      {...props}
    />
  );
});
CommentItemAuthor.displayName = 'CommentItemAuthor';

const commentItemTimestampTone: Record<CommentVariant, string> = {
  default: 'text-ui-sm leading-ui-sm text-neutral3',
  embed: 'text-ui-sm leading-ui-sm text-neutral3',
  thread: 'text-ui-xs leading-ui-xs text-neutral2 shrink-0',
};

export type CommentItemTimestampProps = ComponentPropsWithoutRef<'time'>;

export const CommentItemTimestamp = forwardRef<HTMLTimeElement, CommentItemTimestampProps>(
  ({ className, ...props }, ref) => {
    const variant = useCommentVariant();

    return (
      <time
        ref={ref}
        data-slot="comment-item-timestamp"
        className={cn(commentItemTimestampTone[variant], className)}
        {...props}
      />
    );
  },
);
CommentItemTimestamp.displayName = 'CommentItemTimestamp';

const commentItemBodySize: Record<CommentVariant, TxtProps['variant']> = {
  default: 'ui-md',
  embed: 'ui-md',
  thread: 'ui-sm',
};

const commentItemBodyTone: Record<CommentVariant, string> = {
  default: 'whitespace-pre-wrap text-neutral6 border-l border-border1 pl-3',
  embed: 'whitespace-pre-wrap text-neutral6',
  thread: '',
};

export type CommentItemBodyProps = ComponentPropsWithoutRef<'p'>;

export const CommentItemBody = forwardRef<HTMLElement, CommentItemBodyProps>(({ className, ...props }, ref) => {
  const variant = useCommentVariant();

  return (
    <Txt
      ref={ref}
      // Rendered markdown brings its own blocks, which a paragraph cannot hold.
      as={variant === 'thread' ? 'div' : 'p'}
      variant={commentItemBodySize[variant]}
      data-slot="comment-item-body"
      className={cn(commentItemBodyTone[variant], className)}
      {...props}
    />
  );
});
CommentItemBody.displayName = 'CommentItemBody';

const commentItemActionsLayout: Record<CommentVariant, string> = {
  default:
    'flex items-center gap-1 opacity-0 group-focus-within/comment-item:opacity-100 group-hover/comment-item:opacity-100 motion-safe:transition-opacity',
  embed: '',
  // Hung over the row's own top edge, so it never reflows the body it floats above.
  // `pointer-fine` only: a touch screen has no hover to reveal it with.
  thread:
    'bg-surface2 border-border1 absolute -top-2 right-2 flex items-center gap-0.5 rounded-lg border px-0.5 transition-opacity duration-200 ease-out motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-focus-within/comment-item:opacity-100 pointer-fine:group-hover/comment-item:opacity-100',
};

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
        className={cn(commentItemActionsLayout[variant], className)}
        {...props}
      />
    );
  },
);
CommentItemActions.displayName = 'CommentItemActions';
