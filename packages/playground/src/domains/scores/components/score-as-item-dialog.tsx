'use client';

import type { ScoreRowData } from '@mastra/core/evals';
import { TextAndIcon, getShortId } from '@mastra/playground-ui';
import type { SideDialogRootProps } from '@mastra/playground-ui';
import { CalculatorIcon } from 'lucide-react';
import { SaveAsDatasetItemDialog } from '@/domains/datasets/components/save-as-dataset-item-dialog';

type ScoreAsItemDialogProps = {
  score?: ScoreRowData;
  isOpen: boolean;
  onClose: () => void;
  level?: SideDialogRootProps['level'];
};

function getInitialInput(score?: ScoreRowData): string {
  if (!score) return '{}';
  // input = the full scorer.run() payload: { input, output, groundTruth }
  // groundTruth from the original experiment is not available on ScoreRowData,
  // so we omit it — user can add it manually in the editor
  return JSON.stringify({ input: score.input, output: score.output, groundTruth: null }, null, 2);
}

function getInitialGroundTruth(score?: ScoreRowData): string {
  if (!score) return '';
  // ground truth = expected scorer result — pre-fill with actual score/reason so user can adjust
  return JSON.stringify({ score: score.score, reason: score.reason ?? null }, null, 2);
}

export function ScoreAsItemDialog({ score, isOpen, onClose, level = 2 }: ScoreAsItemDialogProps) {
  return (
    <SaveAsDatasetItemDialog
      initialInput={getInitialInput(score)}
      initialGroundTruth={getInitialGroundTruth(score)}
      breadcrumb={
        <TextAndIcon>
          <CalculatorIcon /> {getShortId(score?.id)}
        </TextAndIcon>
      }
      isOpen={isOpen}
      onClose={onClose}
      level={level}
      source={score?.traceId ? { type: 'trace', referenceId: score.traceId } : undefined}
    />
  );
}
