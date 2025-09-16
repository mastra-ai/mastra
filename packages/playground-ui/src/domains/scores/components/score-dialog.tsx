import { cn } from '@/lib/utils';
import { SideDialog, SideDialogTop, TextAndIcon, SideDialogCodeSection } from '@/components/ui/elements';
import { HashIcon, GaugeIcon } from 'lucide-react';

import { MastraScorer } from '@mastra/core/scores';
import { ClientScoreRowData } from '@mastra/client-js';

type ScoreDialogProps = {
  score?: ClientScoreRowData;
  scorer?: MastraScorer;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
};

export function ScoreDialog({ scorer, score, isOpen, onClose, onNext, onPrevious }: ScoreDialogProps) {
  return (
    <SideDialog
      dialogTitle="Scorer Score"
      dialogDescription="View and analyze score details"
      isOpen={isOpen}
      onClose={onClose}
      className={cn('w-[calc(100vw-20rem)] max-w-[80%]', '3xl:max-w-[65%]', '4xl:max-w-[55%]')}
    >
      <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
        <div className="flex items-center gap-[1rem] text-icon4 text-[0.875rem]">
          <TextAndIcon>
            <GaugeIcon /> {scorer?.config?.name}
          </TextAndIcon>
          ›
          <TextAndIcon>
            <HashIcon />
            {score?.id}
          </TextAndIcon>
        </div>
      </SideDialogTop>

      <div className="p-[1.5rem] px-[2.5rem] overflow-y-auto grid gap-[1.5rem] content-start">
        <div className="grid gap-[1.5rem] mb-[2rem]">
          <SideDialogCodeSection
            title={`Score: ${score?.score ? score?.score : 'n/a'}`}
            codeStr={score?.reason}
            simplified={true}
          />
          <SideDialogCodeSection title="Input" codeStr={JSON.stringify(score?.input || null, null, 2)} />
          <SideDialogCodeSection title="Output" codeStr={JSON.stringify(score?.output || null, null, 2)} />
          <SideDialogCodeSection
            title="Preprocess Prompt"
            codeStr={score?.preprocessPrompt || 'null'}
            simplified={true}
          />
          <SideDialogCodeSection title="Analyze Prompt" codeStr={score?.analyzePrompt || 'null'} simplified={true} />
          <SideDialogCodeSection
            title="Generate Score Prompt"
            codeStr={score?.generateScorePrompt || 'null'}
            simplified={true}
          />
          <SideDialogCodeSection
            title="Generate Reason Prompt"
            codeStr={score?.generateReasonPrompt || 'null'}
            simplified={true}
          />
        </div>
      </div>
    </SideDialog>
  );
}
