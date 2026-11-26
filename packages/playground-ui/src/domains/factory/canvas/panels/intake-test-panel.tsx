import type { ReactNode } from 'react';
import { SidePanel } from '../canvas-frame';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

/** "Where would this go?" for one item: which board takes it and what every rule answered. Nothing is filed. */
export function IntakeTestPanel({
  subject,
  error,
  result,
  onClose,
}: {
  /** A GitHub/Linear URL, or a work item id. */
  subject: string;
  /** Why the test failed. */
  error: string | undefined;
  /** The answer once it is in; gets the panel's close button for its header. */
  result: ((close: ReactNode) => ReactNode) | undefined;
  onClose: () => void;
}) {
  const close = (
    <Button variant="ghost" size="icon-sm" tooltip="Close" aria-label="Close" onClick={onClose}>
      <IconCrossMedium />
    </Button>
  );

  return (
    <SidePanel label="Where would this go?">
      {result ? (
        result(close)
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <Txt as="h2" variant="card-title-strong" className="min-w-0 break-words">
              {subject}
            </Txt>
            {close}
          </div>
          <TestStatus blank={subject.trim() === ''} error={error} />
          <Txt as="p" variant="caption" tone="muted">
            Links from GitHub and GitLab repositories linked to this project are read once and never filed. For Linear,
            Jira and incident.io, paste a link to an item Factory already has, or use Why? on a Not routed item.
          </Txt>
        </>
      )}
    </SidePanel>
  );
}

/** Why there is no answer yet: nothing to test, the test failed, or it is still running. */
function TestStatus({ blank, error }: { blank: boolean; error: string | undefined }) {
  if (blank) {
    return (
      <Txt as="p" variant="body-sm" tone="muted" role="status">
        No item to test.
      </Txt>
    );
  }
  if (error !== undefined) return <Notice variant="destructive">{error}</Notice>;
  return (
    <Txt as="p" variant="body-sm" tone="muted" role="status">
      Checking where it would go…
    </Txt>
  );
}
