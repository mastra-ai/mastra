import type { ClientScoreRowData } from '@mastra/client-js';
import { FileInputIcon, FileOutputIcon, GaugeIcon, ReceiptText, SaveIcon } from 'lucide-react';
import { useState } from 'react';
import { ScoreAsItemDialog } from './score-as-item-dialog';
import { Button } from '@/ds/components/Button';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { DataPanel } from '@/ds/components/DataPanel';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/utils/cn';
import { formatTimestampPrecise } from '@/utils/date-format';

function isCodeBasedScorer(score?: ClientScoreRowData): boolean {
  if (!score) return false;
  const scorer = score.scorer as Record<string, unknown> | undefined;
  if (scorer?.hasJudge === false) return true;
  if (scorer?.hasJudge === true) return false;
  return !score.preprocessPrompt && !score.analyzePrompt && !score.generateScorePrompt && !score.generateReasonPrompt;
}

function buildDialogTitle(sectionTitle: string, icon: React.ReactNode, score: ClientScoreRowData) {
  return (
    <>
      <span className="flex items-center gap-1.5 tracking-widest text-placeholder uppercase [&>svg]:size-3.5">
        {icon}
        {sectionTitle}
      </span>
      <span>
        › Score <b className="text-muted-foreground">#{score.id}</b>
      </span>
    </>
  );
}

export interface ScoreDataPanelProps {
  /** Always mount the panel and pass `undefined` to close it, so the drawer can animate out. */
  score?: ClientScoreRowData;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  depth?: 1 | 2 | 3;
}

export function ScoreDataPanel({ score, onClose, onPrevious, onNext, depth }: ScoreDataPanelProps) {
  const { Link, paths } = useLinkComponent();
  const [datasetDialogOpen, setDatasetDialogOpen] = useState(false);
  const isCodeBased = isCodeBasedScorer(score);
  const naText = isCodeBased ? 'N/A — code-based scorer does not use prompts' : 'N/A — step not configured';

  return (
    <>
      <DataPanel open={!!score} onClose={onClose} title={score ? `Score ${score.id}` : 'Score'} depth={depth}>
        {score && (
          <>
            <DataPanel.Header>
              <DataPanel.CloseButton onClick={onClose} />
              <DataPanel.Heading>
                Score
                <DataPanel.CopyId id={score.id} />
              </DataPanel.Heading>
              <DataPanel.HeaderActions>
                <DataPanel.NextPrevNav
                  onPrevious={onPrevious}
                  onNext={onNext}
                  previousLabel="Go to previous score"
                  nextLabel="Go to next score"
                />
              </DataPanel.HeaderActions>
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
                    <DataKeysAndValues.Value>{formatTimestampPrecise(score.createdAt)}</DataKeysAndValues.Value>
                  </>
                )}
                {score.traceId && (
                  <>
                    <DataKeysAndValues.Key>Trace Id</DataKeysAndValues.Key>
                    <DataKeysAndValues.ValueLink href={paths.traceLink(score.traceId)} as={Link}>
                      {score.traceId}
                    </DataKeysAndValues.ValueLink>
                  </>
                )}
                {score.spanId && score.traceId && (
                  <>
                    <DataKeysAndValues.Key>Span Id</DataKeysAndValues.Key>
                    <DataKeysAndValues.ValueLink href={paths.traceLink(score.traceId, score.spanId)} as={Link}>
                      {score.spanId}
                    </DataKeysAndValues.ValueLink>
                  </>
                )}
              </DataKeysAndValues>

              <div className="my-6 flex justify-end">
                <Button size="sm" onClick={() => setDatasetDialogOpen(true)} icon={<SaveIcon />}>
                  Save as Dataset Item
                </Button>
              </div>

              <div className="mb-6 text-muted-foreground">
                <div
                  className={cn(
                    'flex items-baseline gap-2 text-body text-placeholder',
                    '[&>svg]:size-5 [&>svg]:translate-y-1',
                  )}
                >
                  <GaugeIcon />
                  <span className="">Score:</span>
                  <b className="text-muted-foreground tabular-nums">{`${score.score == null || Number.isNaN(score.score) ? 'n/a' : score.score}`}</b>
                </div>
                <div className="mt-2 text-body-sm">
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
          </>
        )}
      </DataPanel>

      {score && (
        <ScoreAsItemDialog score={score} isOpen={datasetDialogOpen} onClose={() => setDatasetDialogOpen(false)} />
      )}
    </>
  );
}
