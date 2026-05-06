import type { InputTokenDetails, OutputTokenDetails, UsageStats } from '@mastra/core/observability';

type TokenDetailsObject = InputTokenDetails | OutputTokenDetails;

export type TokenUsageView = {
  inputValue: number;
  outputValue: number;
  total: number;
  showSplit: boolean;
  inputPct: number;
  outputPct: number;
  inputDetails: TokenDetailsObject | undefined;
  outputDetails: TokenDetailsObject | undefined;
};

function hasNumericDetails(details: TokenDetailsObject | undefined): details is TokenDetailsObject {
  return !!details && Object.values(details).some(v => typeof v === 'number');
}

export function getTokenUsageView(usage: UsageStats | undefined | null): TokenUsageView | null {
  if (!usage) return null;

  const hasInput = typeof usage.inputTokens === 'number';
  const hasOutput = typeof usage.outputTokens === 'number';

  if (!hasInput && !hasOutput) return null;

  const inputValue = usage.inputTokens ?? 0;
  const outputValue = usage.outputTokens ?? 0;
  const total = inputValue + outputValue;
  const showSplit = total > 0;

  return {
    inputValue,
    outputValue,
    total,
    showSplit,
    inputPct: showSplit ? (inputValue / total) * 100 : 0,
    outputPct: showSplit ? (outputValue / total) * 100 : 0,
    inputDetails: hasInput && hasNumericDetails(usage.inputDetails) ? usage.inputDetails : undefined,
    outputDetails: hasOutput && hasNumericDetails(usage.outputDetails) ? usage.outputDetails : undefined,
  };
}
