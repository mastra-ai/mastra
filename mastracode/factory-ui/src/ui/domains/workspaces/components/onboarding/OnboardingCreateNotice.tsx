import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';

/** A create failure wins; otherwise, while Create is off, the one thing still missing. */
export function OnboardingCreateNotice({
  error,
  blockedReason,
  id,
}: {
  error?: string;
  blockedReason?: string;
  id: string;
}) {
  if (error)
    return (
      <Notice variant="destructive" role="alert">
        {error}
      </Notice>
    );
  if (!blockedReason) return null;
  return (
    <Txt id={id} as="p" role="status" variant="meta" tone="muted" className="m-0 text-end max-[899px]:text-center">
      {blockedReason}
    </Txt>
  );
}
