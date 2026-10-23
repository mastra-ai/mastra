import { CodeEditor } from '@/ds/components/CodeEditor';
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
    <CodeEditor
      value={JSON.stringify(value ?? null, null, 2)}
      language="json"
      editable={false}
      lineNumbers={false}
      showCopyButton={false}
      variant="embedded"
      aria-label="JSON payload"
      data-slot="span-payload-json"
      className={cn(!bare && cn(raisedSurfaceStyle, 'rounded-lg p-3'), className)}
    />
  );
}
