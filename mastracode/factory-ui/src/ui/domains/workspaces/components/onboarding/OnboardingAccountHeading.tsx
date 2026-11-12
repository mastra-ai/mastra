import { Txt } from '@mastra/playground-ui/components/Txt';

/**
 * Names one of two accounts inside the providers part: what the account powers, then whose account it
 * is, on one line.
 */
export function OnboardingAccountHeading({ id, label, detail }: { id: string; label: string; detail: string }) {
  return (
    <Txt as="h4" variant="meta" className="flex flex-wrap items-baseline gap-x-2 px-3 pt-3 pb-1.5">
      <span id={id}>{label}</span>
      <Txt as="span" variant="meta" tone="muted">
        {detail}
      </Txt>
    </Txt>
  );
}
