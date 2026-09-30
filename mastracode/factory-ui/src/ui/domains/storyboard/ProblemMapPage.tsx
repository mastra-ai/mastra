import { Button } from '@mastra/playground-ui/components/Button';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { useSidebarHeaderSlots } from '../chat/components/useSidebarHeaderSlots';
import { PROBLEM_MAP_MERMAID } from './problemMap';
import { ProblemMapCanvas } from './ProblemMapCanvas';
import { ProblemMapLegend } from './ProblemMapCard';
import { PrototypeBadge } from './StoryChoices';

function CopyMermaidButton() {
  const { isCopied, handleCopy } = useCopyToClipboard({ text: PROBLEM_MAP_MERMAID, copyMessage: 'Mermaid copied' });
  return (
    <Button size="sm" onClick={handleCopy}>
      {isCopied ? <CheckIcon /> : <CopyIcon />}
      Copy as mermaid
    </Button>
  );
}

export function ProblemMapPage() {
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout {...slots}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Txt as="h1" variant="heading" tone="ink">
            Factory accounts & models — problem map
          </Txt>
          <PrototypeBadge />
          <div className="ml-auto">
            <CopyMermaidButton />
          </div>
        </div>
        <Txt variant="body-sm" tone="muted">
          One row per need raised in the call: what the prototype does about it, the risk that creates, and what answers
          that risk. Hover a node for its source; click a green or blue node to open its story.
        </Txt>
        <ProblemMapLegend />
        <ProblemMapCanvas />
      </div>
    </PageLayout>
  );
}
