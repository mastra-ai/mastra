import type { ScoreRowData } from '@mastra/core/evals';
import { Button, ButtonsGroup, DataKeysAndValues, DataPanel, Icon, cn } from '@mastra/playground-ui';
import { format } from 'date-fns/format';
import { FileInputIcon, FileOutputIcon, GaugeIcon, ReceiptText, SaveIcon } from 'lucide-react';
import { useState } from 'react';
import { ScoreAsItemDialog } from '@/domains/scores/components/score-as-item-dialog';
import { useLinkComponent } from '@/lib/framework';

function isCodeBasedScorer(score?: ScoreRowData): boolean {
  if (!score) return false;
  const scorer = score.scorer as Record<string, unknown> | undefined;
  if (scorer?.hasJudge === false) return true;
  if (scorer?.hasJudge === true) return false;
  return !score.preprocessPrompt && !score.analyzePrompt && !score.generateScorePrompt && !score.generateReasonPrompt;
}

function buildDialogTitle(sectionTitle: string, icon: React.ReactNode, score: ScoreRowData) {
  return (
    <>
      <span className="flex items-center gap-1.5 text-neutral2 uppercase tracking-widest [&>svg]:size-3.5">
        {icon}
        {sectionTitle}
      </span>
      <span>
        › Score <b className="text-neutral3">#{score.id}</b>
      </span>
    </>
  );
}

export interface ScoreDataPanelProps {
  score: ScoreRowData;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function ScoreDataPanel({ score, onClose, onPrevious, onNext }: ScoreDataPanelProps) {
  const { Link } = useLinkComponent();
  const [datasetDialogOpen, setDatasetDialogOpen] = useState(false);
  const isCodeBased = isCodeBasedScorer(score);
  const naText = isCodeBased ? 'N/A — code-based scorer does not use prompts' : 'N/A — step not configured';

  return (
    <>
      <DataPanel>
        <DataPanel.Header>
          <DataPanel.Heading>
            Score <b># {score.id}</b>
          </DataPanel.Heading>
          <ButtonsGroup className="ml-auto shrink-0">
            <DataPanel.NextPrevNav
              onPrevious={onPrevious}
              onNext={onNext}
              previousLabel="Previous score"
              nextLabel="Next score"
            />
            <DataPanel.CloseButton onClick={onClose} />
          </ButtonsGroup>
        </DataPanel.Header>

        <DataPanel.Content>
          <DataKeysAndValues>
            {score.scorer?.name != null && (
              <>
                <DataKeysAndValues.Key>Scorer</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>{String(score.scorer.name)}</DataKeysAndValues.Value>
              </>
            )}
            {score.createdAt && (
              <>
                <DataKeysAndValues.Key>Created</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  {format(new Date(score.createdAt), 'MMM dd, HH:mm:ss.SSS')}
                </DataKeysAndValues.Value>
              </>
            )}
            {score.traceId && (
              <>
                <DataKeysAndValues.Key>Trace Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueLink href={`/traces/${encodeURIComponent(score.traceId)}`} as={Link}>
                  {score.traceId}
                </DataKeysAndValues.ValueLink>
              </>
            )}
            {score.spanId && score.traceId && (
              <>
                <DataKeysAndValues.Key>Span Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueLink
                  href={`/traces/${encodeURIComponent(score.traceId)}?spanId=${encodeURIComponent(score.spanId)}`}
                  as={Link}
                >
                  {score.spanId}
                </DataKeysAndValues.ValueLink>
              </>
            )}
          </DataKeysAndValues>

          <div className="mt-6 mb-6 flex justify-end ">
            <Button size="sm" onClick={() => setDatasetDialogOpen(true)}>
              <Icon>
                <SaveIcon />
              </Icon>
              Save as Dataset Item
            </Button>
          </div>

          <div className="text-neutral4 mb-6">
            <div
              className={cn(
                'text-neutral2 text-ui-lg flex gap-2 items-baseline',
                '[&>svg]:w-5 [&>svg]:h-5 [&>svg]:translate-y-1',
              )}
            >
              <GaugeIcon />
              <span className="">Score:</span>
              <b className="font-mono text-neutral3">{`${score.score == null || Number.isNaN(score.score) ? 'n/a' : score.score}`}</b>
            </div>
            <div className="text-ui-smd font-mono mt-2">
              {score.reason ||
                (isCodeBased ? 'N/A — code-based scorer does not generate a reason' : 'N/A — step not configured')}
            </div>
          </div>

          <div className="grid gap-4">
            <DataPanel.CodeSection
              title="Input"
              dialogTitle={buildDialogTitle('Input', <FileInputIcon />, score)}
              icon={<FileInputIcon />}
              codeStr={JSON.stringify(score.input ?? null, null, 2)}
            />
            <DataPanel.CodeSection
              title="Output"
              dialogTitle={buildDialogTitle('Output', <FileOutputIcon />, score)}
              icon={<FileOutputIcon />}
              codeStr={JSON.stringify(score.output ?? null, null, 2)}
            />
            <DataPanel.CodeSection
              title="Preprocess Prompt"
              dialogTitle={buildDialogTitle('Preprocess Prompt', <ReceiptText />, score)}
              icon={<ReceiptText />}
              codeStr={score.preprocessPrompt || naText}
              simplified={true}
            />
            <DataPanel.CodeSection
              title="Analyze Prompt"
              dialogTitle={buildDialogTitle('Analyze Prompt', <ReceiptText />, score)}
              icon={<ReceiptText />}
              codeStr={score.analyzePrompt || naText}
              simplified={true}
            />
            <DataPanel.CodeSection
              title="Generate Score Prompt"
              dialogTitle={buildDialogTitle('Generate Score Prompt', <ReceiptText />, score)}
              icon={<ReceiptText />}
              codeStr={score.generateScorePrompt || naText}
              simplified={true}
            />
            <DataPanel.CodeSection
              title="Generate Reason Prompt"
              dialogTitle={buildDialogTitle('Generate Reason Prompt', <ReceiptText />, score)}
              icon={<ReceiptText />}
              codeStr={score.generateReasonPrompt || naText}
              simplified={true}
            />
          </div>
        </DataPanel.Content>
      </DataPanel>

      <ScoreAsItemDialog score={score} isOpen={datasetDialogOpen} onClose={() => setDatasetDialogOpen(false)} />
    </>
  );
}
