import { SidePanel } from '../canvas-frame';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

/** The rule panel while there is no rule to show: loading, failed, or gone. */
export function RulePanelMessage({
  text,
  error = false,
  onClose,
}: {
  text: string;
  error?: boolean;
  onClose: () => void;
}) {
  return (
    <SidePanel label="Rule">
      <div className="flex items-start justify-between gap-2">
        <PanelMessageText text={text} error={error} />
        <Button variant="ghost" size="icon-sm" tooltip="Close" aria-label="Close" onClick={onClose}>
          <IconCrossMedium />
        </Button>
      </div>
    </SidePanel>
  );
}

function PanelMessageText({ text, error }: { text: string; error: boolean }) {
  if (error) {
    return (
      <Notice variant="destructive" className="min-w-0 flex-1">
        {text}
      </Notice>
    );
  }
  return (
    <Txt as="p" variant="body-sm" tone="muted" role="status">
      {text}
    </Txt>
  );
}
