import { SideDialog, TextAndIcon, KeyValueList, type SideDialogRootProps, getShortId } from '@/components/ui/elements';
import {
  HashIcon,
  GaugeIcon,
  FileInputIcon,
  FileOutputIcon,
  ReceiptText,
  EyeIcon,
  ChevronsLeftRightEllipsisIcon,
  CalculatorIcon,
} from 'lucide-react';

import { ClientScoreRowData } from '@mastra/client-js';
import { useLinkComponent } from '@/lib/framework';
import { Sections } from '@/index';
import { format } from 'date-fns/format';

type ScoreDialogProps = {
  score?: ClientScoreRowData;
  scorerName?: string;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  computeTraceLink: (traceId: string, spanId?: string) => string;
  dialogLevel?: SideDialogRootProps['level'];
  usageContext?: 'scorerPage' | 'SpanDialog';
};

export function ScoreDialog({
  score,
  scorerName,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  computeTraceLink,
  dialogLevel = 1,
  usageContext = 'scorerPage',
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
      <SideDialog.Top>
        {usageContext === 'scorerPage' && (
          <TextAndIcon>
            <GaugeIcon /> {scorerName}
          </TextAndIcon>
        )}
        {usageContext === 'SpanDialog' && (
          <>
            <TextAndIcon>
              <EyeIcon /> {getShortId(score?.traceId)}
            </TextAndIcon>
            {score?.spanId && (
              <>
                ›
                <TextAndIcon>
                  <ChevronsLeftRightEllipsisIcon />
                  {getShortId(score?.spanId)}
                </TextAndIcon>
              </>
            )}
          </>
        )}
        ›
        <TextAndIcon>
          <CalculatorIcon />
          {getShortId(score?.id)}
        </TextAndIcon>
        |
        <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <CalculatorIcon /> Score
          </SideDialog.Heading>
          <TextAndIcon>
            <HashIcon /> {score?.id}
          </TextAndIcon>
        </SideDialog.Header>

        <Sections>
          <KeyValueList
            data={[
              ...(usageContext === 'SpanDialog'
                ? [
                    {
                      label: 'Scorer',
                      value: score?.scorer?.name || '-',
                      key: 'scorer-name',
                    },
                  ]
                : []),
              {
                label: 'Created at',
                value: score?.createdAt ? format(new Date(score?.createdAt), 'MMM d, h:mm:ss aaa') : 'n/a',
                key: 'date',
              },
              ...(usageContext !== 'SpanDialog'
                ? [
                    {
                      label: 'Trace ID',
                      value: score?.traceId ? (
                        <Link href={computeTraceLink(score?.traceId)}>{score?.traceId}</Link>
                      ) : (
                        'n/a'
                      ),
                      key: 'traceId',
                    },
                    {
                      label: 'Span ID',
                      value:
                        score?.traceId && score?.spanId ? (
                          <Link href={computeTraceLink(score?.traceId, score?.spanId)}>{score?.spanId}</Link>
                        ) : (
                          'n/a'
                        ),
                      key: 'spanId',
                    },
                  ]
                : []),
            ]}
            LinkComponent={Link}
          />

          <SideDialog.CodeSection
            title={`Score: ${Number.isNaN(score?.score) ? 'n/a' : score?.score}`}
            icon={<GaugeIcon />}
            codeStr={score?.reason || 'null'}
            simplified={true}
          />

          <SideDialog.CodeSection
            title="Input"
            icon={<FileInputIcon />}
            codeStr={JSON.stringify(score?.input || null, null, 2)}
          />

          <SideDialog.CodeSection
            title="Output"
            icon={<FileOutputIcon />}
            codeStr={JSON.stringify(score?.output || null, null, 2)}
          />

          <SideDialog.CodeSection
            title="Preprocess Prompt"
            icon={<ReceiptText />}
            codeStr={score?.preprocessPrompt || 'null'}
            simplified={true}
          />

          <SideDialog.CodeSection
            title="Analyze Prompt"
            icon={<ReceiptText />}
            codeStr={score?.analyzePrompt || 'null'}
            simplified={true}
          />

          <SideDialog.CodeSection
            title="Generate Score Prompt"
            icon={<ReceiptText />}
            codeStr={score?.generateScorePrompt || 'null'}
            simplified={true}
          />

          <SideDialog.CodeSection
            title="Generate Reason Prompt"
            icon={<ReceiptText />}
            codeStr={score?.generateReasonPrompt || 'null'}
            simplified={true}
          />
        </Sections>
      </SideDialog.Content>
    </SideDialog>
  );
}
