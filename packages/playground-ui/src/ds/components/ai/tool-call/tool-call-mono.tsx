import type { ComponentProps } from 'react';
import { CopyButton } from '@/ds/components/CopyButton';
import { cn } from '@/lib/utils';

export interface ToolCallMonoProps extends ComponentProps<'pre'> {
  copyText: string;
}

/** Monospace body block of an expanded call — arguments, command, output — with a hover copy. */
export const ToolCallMono = ({ copyText, className, children, ...props }: ToolCallMonoProps) => (
  <div className="group/block relative max-w-full min-w-0">
    <pre
      className={cn(
        'm-0 max-h-60 max-w-full overflow-auto rounded-md bg-fill px-3 py-2 font-mono text-caption break-words whitespace-pre-wrap',
        className,
      )}
      {...props}
    >
      {children}
    </pre>
    <CopyButton
      content={copyText}
      size="sm"
      variant="ghost"
      className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/block:opacity-100 focus-visible:opacity-100"
    />
  </div>
);

/** A shell command as the body shows it: `$` in the margin, the copy takes the command alone. */
export const ToolCallCommand = ({ command }: { command: string }) => (
  <ToolCallMono copyText={command} className="text-foreground">
    <span className="text-muted-foreground select-none">$ </span>
    {command}
  </ToolCallMono>
);
