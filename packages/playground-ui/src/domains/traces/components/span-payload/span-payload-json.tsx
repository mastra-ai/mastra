import { Code } from '@/ds/components/Code/code';
import { cn } from '@/lib/utils';

export interface SpanPayloadJsonProps {
  value: unknown;
  className?: string;
}

/** Fallback renderer: pretty-printed JSON for any payload core does not describe in more detail. */
export function SpanPayloadJson({ value, className }: SpanPayloadJsonProps) {
  return (
    <Code
      code={JSON.stringify(value ?? null, null, 2)}
      lang="json"
      data-slot="span-payload-json"
      className={cn(
        'max-h-[30vh] overflow-y-auto rounded-lg border border-border1 bg-surface3 p-3 font-mono text-ui-sm text-wrap break-all text-neutral4 ',
        className,
      )}
    />
  );
}
