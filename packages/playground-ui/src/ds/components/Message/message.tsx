import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MessageProps extends ComponentProps<'div'> {
  from: 'user' | 'assistant';
  avatar?: ReactNode;
  footer?: ReactNode;
  pending?: boolean;
}

export function Message({ from, avatar, footer, pending, children, className, ...props }: MessageProps) {
  const isUser = from === 'user';

  return (
    <div
      {...props}
      data-slot="message"
      data-from={from}
      data-message-pending={pending || undefined}
      className={cn(
        'group/message max-w-full min-w-0',
        isUser && 'my-3 ml-auto flex w-fit max-w-[70%] items-start gap-2',
        !isUser && footer && 'mb-3',
        className,
      )}
    >
      {avatar}
      <div className={cn('min-w-0', isUser && 'flex flex-col items-end')}>
        <div
          data-slot="message-content"
          className={cn(
            'max-w-full min-w-0 text-body break-words',
            isUser && 'rounded-xl border border-transparent bg-fill-subtle px-4 py-2 text-text1',
            isUser && pending && 'border-dashed border-border1',
            !isUser && footer && '[&>:last-child]:mb-0',
          )}
        >
          {children}
        </div>
        {footer && <div className="mt-1 max-w-full">{footer}</div>}
      </div>
    </div>
  );
}

export interface MessageActionsProps extends ComponentProps<'div'> {
  visibility?: 'hover' | 'always';
}

export function MessageActions({ visibility = 'hover', children, className, ...props }: MessageActionsProps) {
  return (
    <div
      {...props}
      data-slot="message-actions"
      className={cn(
        'flex flex-wrap items-center gap-1 group-data-[from=user]/message:flex-row-reverse',
        'motion-safe:transition-opacity [&_button]:pointer-coarse:min-h-11 [&_button]:pointer-coarse:min-w-11',
        visibility === 'hover' &&
          'group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-fine:opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MessageMetadata({ className, ...props }: ComponentProps<'span'>) {
  return <span {...props} className={cn('text-icon3 inline-flex items-center gap-1 text-meta', className)} />;
}
