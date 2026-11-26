import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';

import { useIntakeTestQuery } from '../../../../../hooks/useIntakeDryRun';
import { SidePanel } from '../CanvasChrome';
import { TestResult } from './TestResult';

export interface TestPanelProps {
  factoryId: string;
  boardId: string;
  /** A GitHub/Linear URL, or a work item id (from "Why?" on routing's Not routed list). */
  subject: string;
  /** The pencil on a rule: the parent opens `?rule=<id>&test=<subject>`. */
  onEditRule: (routeId: string) => void;
  onClose: () => void;
}

/** "Where would this go?" for one item: which board takes it and what every rule answered. Nothing is filed. */
export function TestPanel(props: TestPanelProps) {
  return (
    <SidePanel label="Where would this go?">
      <TestBody {...props} />
    </SidePanel>
  );
}

function TestBody({ factoryId, boardId, subject, onEditRule, onClose }: TestPanelProps) {
  const test = useIntakeTestQuery(factoryId, subject);

  const close = (
    <Button variant="ghost" size="icon-sm" tooltip="Close" aria-label="Close" onClick={onClose}>
      <IconCrossMedium />
    </Button>
  );

  if (test.data) {
    return (
      <TestResult result={test.data} factoryId={factoryId} boardId={boardId} close={close} onEditRule={onEditRule} />
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Txt as="h2" variant="card-title-strong" className="min-w-0 break-words">
          {subject}
        </Txt>
        {close}
      </div>
      <TestStatus blank={subject.trim() === ''} error={test.error ?? undefined} />
    </>
  );
}

/** Why there is no answer yet: nothing to test, the test failed, or it is still running. */
function TestStatus({ blank, error }: { blank: boolean; error: Error | undefined }) {
  if (blank) {
    return (
      <Txt as="p" variant="body-sm" tone="muted" role="status">
        No item to test.
      </Txt>
    );
  }
  if (error) return <Notice variant="destructive">{error.message}</Notice>;
  return (
    <Txt as="p" variant="body-sm" tone="muted" role="status">
      Checking where it would go…
    </Txt>
  );
}
