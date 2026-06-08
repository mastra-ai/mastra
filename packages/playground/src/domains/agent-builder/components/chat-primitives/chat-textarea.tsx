import { cn, Textarea } from '@mastra/playground-ui';
import type { TextareaProps } from '@mastra/playground-ui';
import { forwardRef } from 'react';

export type ChatTextareaProps = Omit<TextareaProps, 'size' | 'variant' | 'rows'>;

export const ChatTextarea = forwardRef<HTMLTextAreaElement, ChatTextareaProps>(({ className, ...props }, ref) => {
  return (
    <Textarea
      ref={ref}
      size="md"
      variant="unstyled"
      rows={1}
      className={cn(
        'min-h-[44px] resize-none text-ui-md bg-transparent text-neutral6 placeholder:text-neutral3',
        'outline-none focus:outline-none focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});

ChatTextarea.displayName = 'ChatTextarea';
