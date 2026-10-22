import { Code } from '@/ds/components/Code/code';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export interface SpanPayloadJsonProps {
  value: unknown;
  /** Drops the surface and padding, for JSON that sits in an already framed container. */
  bare?: boolean;
  className?: string;
}

/** Fallback renderer: pretty-printed JSON for any payload core does not describe in more detail. */
export function SpanPayloadJson({ value, bare = false, className }: SpanPayloadJsonProps) {
  return (
    <Code
      code={JSON.stringify(value ?? null, null, 2)}
      lang="json"
      data-slot="span-payload-json"
      className={cn(
        !bare && cn(raisedSurfaceStyle, 'rounded-lg p-3'),
        'text-wrap break-all text-muted-foreground',
        className,
        'text-caption',
      )}
    />
  );
}
