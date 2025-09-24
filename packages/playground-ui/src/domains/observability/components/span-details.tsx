import { SideDialogCodeSection, SideDialogHeading } from '@/components/ui/elements';
import { ScoreTable } from '@/domains/scores/components/score-table';
import { AISpanRecord } from '@mastra/core';
import { GaugeIcon } from 'lucide-react';

interface SpanDetailsProps {
  span?: AISpanRecord;
  onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void;
}

export function SpanDetails({ span, onScorerTriggered }: SpanDetailsProps) {
  if (!span) {
    return null;
  }

  return (
    <div className="grid gap-[1.5rem] mb-[2rem]">
      <SideDialogCodeSection title="Input" codeStr={JSON.stringify(span.input || null, null, 2)} />
      <SideDialogCodeSection title="Output" codeStr={JSON.stringify(span.output || null, null, 2)} />
      <SideDialogCodeSection title="Metadata" codeStr={JSON.stringify(span.metadata || null, null, 2)} />
      <SideDialogCodeSection title="Attributes" codeStr={JSON.stringify(span.attributes || null, null, 2)} />

      {span?.links?.length > 0 && (
        <div className="pt-[2.5rem] pr-[2.5rem]">
          <SideDialogHeading as="h2" className="pb-[1rem]">
            <GaugeIcon /> Scores
          </SideDialogHeading>

          <div className="bg-surface2 rounded-lg overflow-hidden border-sm border-border1">
            <ScoreTable
              scores={span?.links}
              onItemClick={scorerName => onScorerTriggered(scorerName, span!.traceId, span!.spanId)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
