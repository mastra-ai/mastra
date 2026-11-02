import { Txt } from '@mastra/playground-ui/components/Txt';

/** A routing row's refused save, or else what the row still lacks. */
export function RoutingNote({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return (
      <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground wrap-anywhere">
        {error}
      </Txt>
    );
  }
  if (!hint) return null;
  return (
    <Txt as="p" variant="meta" tone="muted" className="wrap-anywhere">
      {hint}
    </Txt>
  );
}
