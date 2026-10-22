'use client';

import type { ClientScoreRowData } from '@mastra/client-js';
import type { ScoreRowData } from '@mastra/core/evals';
import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { SaveAsDatasetItemDialog } from '@/domains/datasets';
import type { DataPanelProps } from '@/ds/components/DataPanel';
import { getShortId } from '@/ds/components/Text';

type ScoreForDatasetItem = ScoreRowData | ClientScoreRowData;

export type ScoreAsItemDialogProps = {
  score?: ScoreForDatasetItem;
  isOpen: boolean;
  onClose: () => void;
  depth?: DataPanelProps['depth'];
};

function getInitialInput(score?: ScoreForDatasetItem): string {
  if (!score) return '{}';
  // input = the full scorer.run() payload: { input, output, groundTruth }
  // groundTruth from the original experiment is not available on ScoreRowData,
  // so we omit it — user can add it manually in the editor
  return safeStringify({ input: score.input, output: score.output, groundTruth: null }, 2);
}

function getInitialGroundTruth(score?: ScoreForDatasetItem): string {
  if (!score) return '';
  // ground truth = expected scorer result — pre-fill with actual score/reason so user can adjust
  return safeStringify({ score: score.score, reason: score.reason ?? null }, 2);
}

export function ScoreAsItemDialog({ score, isOpen, onClose, depth }: ScoreAsItemDialogProps) {
  return (
    <SaveAsDatasetItemDialog
      initialInput={getInitialInput(score)}
      initialGroundTruth={getInitialGroundTruth(score)}
      breadcrumb={getShortId(score?.id)}
      isOpen={isOpen}
      onClose={onClose}
      depth={depth}
      source={score?.traceId ? { type: 'trace', referenceId: score.traceId } : undefined}
    />
  );
}
