'use client';

import type { ClientScoreRowData } from '@mastra/client-js';
import { Button, Column, MainHeader, PrevNextNav, SideDialog, Sections } from '@mastra/playground-ui';
import { GaugeIcon, FileCodeIcon, FileOutputIcon, ReceiptText, XIcon } from 'lucide-react';

export type ExperimentScorePanelProps = {
  score: ClientScoreRowData;
  onNext?: () => void;
  onPrevious?: () => void;
  onClose: () => void;
};

function isCodeBasedScorer(score: ClientScoreRowData): boolean {
  const scorer = score.scorer as Record<string, unknown> | undefined;
  if (scorer?.hasJudge === false) return true;
  if (scorer?.hasJudge === true) return false;
  return !score.preprocessPrompt && !score.analyzePrompt && !score.generateScorePrompt && !score.generateReasonPrompt;
}

export function ExperimentScorePanel({ score, onNext, onPrevious, onClose }: ExperimentScorePanelProps) {
  const isCodeBased = isCodeBasedScorer(score);
  const naText = isCodeBased ? 'N/A — code-based scorer' : 'N/A — step not configured';

  return (
    <>
      <Column.Toolbar>
        <PrevNextNav
          onPrevious={onPrevious}
          onNext={onNext}
          previousAriaLabel="View previous score details"
          nextAriaLabel="View next score details"
        />
        <Button onClick={onClose} aria-label="Close score details">
          <XIcon />
        </Button>
      </Column.Toolbar>

      <Column.Content>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title size="smaller">
              <GaugeIcon /> {score.scorerId}
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>

        <Sections>
          <SideDialog.CodeSection
            title={`Score: ${score.score}`}
            icon={<GaugeIcon />}
            codeStr={score.reason || naText}
            simplified
          />

          <SideDialog.CodeSection
            title="Input"
            icon={<FileCodeIcon />}
            codeStr={JSON.stringify(score.input ?? null, null, 2)}
          />

          <SideDialog.CodeSection
            title="Output"
            icon={<FileOutputIcon />}
            codeStr={JSON.stringify(score.output ?? null, null, 2)}
          />

          {!isCodeBased && (
            <>
              <SideDialog.CodeSection
                title="Preprocess Prompt"
                icon={<ReceiptText />}
                codeStr={score.preprocessPrompt || naText}
                simplified
              />
              <SideDialog.CodeSection
                title="Analyze Prompt"
                icon={<ReceiptText />}
                codeStr={score.analyzePrompt || naText}
                simplified
              />
              <SideDialog.CodeSection
                title="Generate Score Prompt"
                icon={<ReceiptText />}
                codeStr={score.generateScorePrompt || naText}
                simplified
              />
              <SideDialog.CodeSection
                title="Generate Reason Prompt"
                icon={<ReceiptText />}
                codeStr={score.generateReasonPrompt || naText}
                simplified
              />
            </>
          )}
        </Sections>
      </Column.Content>
    </>
  );
}
