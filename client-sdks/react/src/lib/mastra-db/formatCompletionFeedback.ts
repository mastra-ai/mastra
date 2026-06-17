type CompletionScorerResult = {
  duration?: number;
  passed: boolean;
  reason?: string;
  score: number;
  scorerId: string;
  scorerName: string;
};

type CompletionResult = {
  complete: boolean;
  completionReason?: string;
  scorers: CompletionScorerResult[];
  timedOut: boolean;
  totalDuration: number;
};

// Browser-safe copy of the core completion-feedback formatter.
// Keep this local so @mastra/react does not pull @mastra/core/loop into client bundles.
const formatBaseCompletionFeedback = (
  result: CompletionResult,
  maxIterationReached: boolean,
  formatScorerHeading: (scorer: CompletionScorerResult) => string,
  incompleteMessage: string,
) => {
  const lines: string[] = [];

  lines.push('#### Completion Check Results');
  lines.push('');
  lines.push(`Overall: ${result.complete ? '✅ COMPLETE' : '❌ NOT COMPLETE'}`);
  lines.push(`Duration: ${result.totalDuration}ms`);
  if (result.timedOut) {
    lines.push('⚠️ Scoring timed out');
  }
  lines.push('');

  for (const scorer of result.scorers) {
    lines.push(formatScorerHeading(scorer));
    lines.push(`Score: ${scorer.score} ${scorer.passed ? '✅' : '❌'}`);
    if (scorer.reason) {
      lines.push(`Reason: ${scorer.reason}`);
    }
    lines.push('');
  }

  if (result.complete) {
    lines.push('✅ The task is complete.');
  } else if (maxIterationReached) {
    lines.push('⚠️ Max iterations reached.');
  } else {
    lines.push(incompleteMessage);
  }

  return lines.join('\n');
};

export const formatCompletionFeedback = (result: CompletionResult, maxIterationReached: boolean): string => {
  return formatBaseCompletionFeedback(
    result,
    maxIterationReached,
    scorer => `###### ${scorer.scorerName} (${scorer.scorerId})`,
    '🔄 Will continue working on the task.',
  );
};

export const formatStreamCompletionFeedback = (result: CompletionResult, maxIterationReached: boolean): string => {
  return formatBaseCompletionFeedback(
    result,
    maxIterationReached,
    scorer => `**${scorer.scorerName}** (${scorer.scorerId})`,
    '🔄 The task is not yet complete. Please continue working based on the feedback above.',
  );
};
