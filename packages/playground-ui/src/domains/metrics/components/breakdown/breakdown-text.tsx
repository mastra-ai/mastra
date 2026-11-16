import { Txt } from '@/ds/components/Txt';

/** A muted text cell (a project, a resource) that truncates, with the full text on hover. */
export function BreakdownText({ text }: { text: string }) {
  return (
    <Txt as="span" variant="body-sm" tone="muted" className="truncate" title={text}>
      {text}
    </Txt>
  );
}
