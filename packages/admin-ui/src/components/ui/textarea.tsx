import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-neutral9 shadow-sm placeholder:text-neutral3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1 focus-visible:ring-offset-2 focus-visible:ring-offset-surface1 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
