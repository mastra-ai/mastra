'use client';

import type { ClientScoreRowData } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { GaugeIcon, ReceiptText } from 'lucide-react';

export type ExperimentScorePanelProps = {
  /** Always mount the panel and pass `undefined` to close it, so the drawer can animate out. */
  score?: ClientScoreRowData;
  onNext?: () => void;
  onPrevious?: () => void;
  onClose: () => void;
  /** When provided, a Trace button appears in the header; hidden when `score.traceId` is absent. */
  onShowTrace?: () => void;
};

function isCodeBasedScorer(score: ClientScoreRowData): boolean {
  const scorer = score.scorer as Record<string, unknown> | undefined;
  if (scorer?.hasJudge === false) return true;
  if (scorer?.hasJudge === true) return false;
  return !score.preprocessPrompt && !score.analyzePrompt && !score.generateScorePrompt && !score.generateReasonPrompt;
}

export function ExperimentScorePanel({ score, onNext, onPrevious, onClose, onShowTrace }: ExperimentScorePanelProps) {
  return (
    <DataPanel open={!!score} onClose={onClose} title={score ? `Score ${score.scorerId}` : 'Score'} depth={2}>
      {score && (
        <ExperimentScorePanelBody
          score={score}
          onNext={onNext}
          onPrevious={onPrevious}
          onClose={onClose}
          onShowTrace={onShowTrace}
        />
      )}
    </DataPanel>
  );
}

function ExperimentScorePanelBody({
  score,
  onNext,
  onPrevious,
  onClose,
  onShowTrace,
}: Omit<ExperimentScorePanelProps, 'score'> & { score: ClientScoreRowData }) {
  const isCodeBased = isCodeBasedScorer(score);
  const naText = isCodeBased ? 'N/A — code-based scorer' : 'N/A — step not configured';

  return (
    <>
      <DataPanel.Header>
        <DataPanel.Heading>
          Score <b>{score.scorerId}</b>
        </DataPanel.Heading>
        <DataPanel.HeaderActions>
          {(onPrevious || onNext) && (
            <DataPanel.NextPrevNav
              onPrevious={onPrevious}
              onNext={onNext}
              previousLabel="Previous score"
              nextLabel="Next score"
            />
          )}
          {onShowTrace && score.traceId && (
            <Button size="sm" variant="ghost" onClick={onShowTrace} icon={<TraceIcon />}>
              Trace
            </Button>
          )}
          <DataPanel.CloseButton onClick={onClose} tooltip="Close score panel" />
        </DataPanel.HeaderActions>
      </DataPanel.Header>

      <DataPanel.Content>
        <div className="grid gap-3">
          <DataPanel.CodeSection
            title={`Score: ${score.score}`}
            icon={<GaugeIcon />}
            codeStr={score.reason || naText}
            simplified
          />

          {!isCodeBased && (
            <>
              <DataPanel.CodeSection
                title="Preprocess Prompt"
                icon={<ReceiptText />}
                codeStr={score.preprocessPrompt || naText}
                simplified
              />
              <DataPanel.CodeSection
                title="Analyze Prompt"
                icon={<ReceiptText />}
                codeStr={score.analyzePrompt || naText}
                simplified
              />
              <DataPanel.CodeSection
                title="Generate Score Prompt"
                icon={<ReceiptText />}
                codeStr={score.generateScorePrompt || naText}
                simplified
              />
              <DataPanel.CodeSection
                title="Generate Reason Prompt"
                icon={<ReceiptText />}
                codeStr={score.generateReasonPrompt || naText}
                simplified
              />
            </>
          )}
        </div>
      </DataPanel.Content>
    </>
  );
}
