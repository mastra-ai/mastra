import type { ScoreRowData } from '@mastra/core/evals';
import { DataKeysAndValues, DataPanel, ButtonsGroup } from '@mastra/playground-ui';
import { format } from 'date-fns/format';
import { FileInputIcon, FileOutputIcon, GaugeIcon, ReceiptText } from 'lucide-react';

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
  const isCodeBased = isCodeBasedScorer(score);
  const naText = isCodeBased ? 'N/A — code-based scorer does not use prompts' : 'N/A — step not configured';

  return (
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
        <DataKeysAndValues numOfCol={2}>
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
              <DataKeysAndValues.Key>Trace</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>{score.traceId}</DataKeysAndValues.Value>
            </>
          )}
          {score.spanId && (
            <>
              <DataKeysAndValues.Key>Span</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>{score.spanId}</DataKeysAndValues.Value>
            </>
          )}
        </DataKeysAndValues>

        <div className="grid gap-3 mt-3">
          <DataPanel.CodeSection
            title={`Score: ${score.score == null || Number.isNaN(score.score) ? 'n/a' : score.score}`}
            dialogTitle={buildDialogTitle('Score', <GaugeIcon />, score)}
            icon={<GaugeIcon />}
            codeStr={
              score.reason ||
              (isCodeBased ? 'N/A — code-based scorer does not generate a reason' : 'N/A — step not configured')
            }
            simplified={true}
          />
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
  );
}
