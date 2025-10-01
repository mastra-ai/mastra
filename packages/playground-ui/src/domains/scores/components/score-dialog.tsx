import { SideDialog, TextAndIcon, KeyValueList, type SideDialogRootProps } from '@/components/ui/elements';
import { HashIcon, GaugeIcon } from 'lucide-react';
import { ClientScoreRowData } from '@mastra/client-js';
import { useLinkComponent } from '@/lib/framework';

type ScoreDialogProps = {
  score?: ClientScoreRowData;
  scorerName?: string;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  computeTraceLink: (traceId: string, spanId?: string) => string;
  dialogLevel?: SideDialogRootProps['level'];
};

export function ScoreDialog({
  scorerName,
  score,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  computeTraceLink,
  dialogLevel = 1,
}: ScoreDialogProps) {
  const { Link } = useLinkComponent();

  return (
    <SideDialog
      dialogTitle="Scorer Score"
      dialogDescription="View and analyze score details"
      isOpen={isOpen}
      onClose={onClose}
      level={dialogLevel}
    >
      <SideDialog.Top onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
        <div className="flex items-center gap-[1rem] text-icon4 text-[0.875rem]">
          <TextAndIcon>
            <GaugeIcon /> {scorerName}
          </TextAndIcon>
          ›
          <TextAndIcon>
            <HashIcon />
            {score?.id}
          </TextAndIcon>
        </div>
      </SideDialog.Top>

      <SideDialog.Content>
        {score?.traceId && (
          <KeyValueList
            data={[
              {
                label: 'Trace ID',
                value: <Link href={computeTraceLink(score?.traceId)}>{score?.traceId}</Link>,
                key: 'traceId',
              },
              ...(score?.spanId
                ? [
                    {
                      label: 'Span ID',
                      value: <Link href={computeTraceLink(score?.traceId, score?.spanId)}>{score?.spanId}</Link>,
                      key: 'spanId',
                    },
                  ]
                : []),
            ]}
            LinkComponent={Link}
          />
        )}

        <SideDialog.CodeSection
          title={`Score: ${Number.isNaN(score?.score) ? 'n/a' : score?.score}`}
          codeStr={score?.reason || 'null'}
          simplified={true}
        />

        <SideDialog.CodeSection title="Input" codeStr={JSON.stringify(score?.input || null, null, 2)} />

        <SideDialog.CodeSection title="Output" codeStr={JSON.stringify(score?.output || null, null, 2)} />

        <SideDialog.CodeSection
          title="Preprocess Prompt"
          codeStr={score?.preprocessPrompt || 'null'}
          simplified={true}
        />

        <SideDialog.CodeSection title="Analyze Prompt" codeStr={score?.analyzePrompt || 'null'} simplified={true} />

        <SideDialog.CodeSection
          title="Generate Score Prompt"
          codeStr={score?.generateScorePrompt || 'null'}
          simplified={true}
        />

        <SideDialog.CodeSection
          title="Generate Reason Prompt"
          codeStr={score?.generateReasonPrompt || 'null'}
          simplified={true}
        />
      </SideDialog.Content>
    </SideDialog>
  );
}
