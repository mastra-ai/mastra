import type { InputTokenDetails, OutputTokenDetails } from '@mastra/core/observability';
import { ArrowRightIcon, ArrowRightToLineIcon, CoinsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// V5 format (AI SDK v5)
type V5TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  totalTokens: number;
  inputDetails?: InputTokenDetails;
  outputDetails?: OutputTokenDetails;
};

// Legacy format
type LegacyTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type TokenUsage = V5TokenUsage | LegacyTokenUsage;

type TokenDetailsObject = InputTokenDetails | OutputTokenDetails;
type UsageValue = number | TokenDetailsObject | undefined;

function isTokenDetailsObject(value: UsageValue): value is TokenDetailsObject {
  return typeof value === 'object' && value !== null;
}

const detailKeyLabels: Record<string, string> = {
  text: 'Text',
  cacheRead: 'Cache Read',
  cacheWrite: 'Cache Write',
  audio: 'Audio',
  image: 'Image',
  reasoning: 'Reasoning',
};

type SpanTokenUsageProps = {
  usage: TokenUsage;
  className?: string;
};

export function SpanTokenUsage({ usage, className }: SpanTokenUsageProps) {
  if (!usage) return null;
  const isV5 = 'inputTokens' in usage;

  const legacyTokenPresentations: Record<string, { label: string; icon: React.ReactNode }> = {
    promptTokens: { label: 'Prompt Tokens', icon: <ArrowRightIcon /> },
    completionTokens: { label: 'Completion Tokens', icon: <ArrowRightToLineIcon /> },
  };

  const v5TokenPresentations: Record<string, { label: string; icon: React.ReactNode }> = {
    inputTokens: { label: 'Input Tokens', icon: <ArrowRightIcon /> },
    outputTokens: { label: 'Output Tokens', icon: <ArrowRightToLineIcon /> },
    reasoningTokens: { label: 'Reasoning Tokens', icon: <ArrowRightToLineIcon /> },
    cachedInputTokens: { label: 'Cached Input Tokens', icon: <ArrowRightToLineIcon /> },
    inputDetails: { label: 'Input Details', icon: <ArrowRightIcon /> },
    outputDetails: { label: 'Output Details', icon: <ArrowRightToLineIcon /> },
  };

  const commonTokenPresentations: Record<string, { label: string; icon: React.ReactNode }> = {
    totalTokens: { label: 'Total LLM Tokens', icon: <CoinsIcon /> },
  };

  const tokenPresentations = {
    ...commonTokenPresentations,
    ...v5TokenPresentations,
    ...legacyTokenPresentations,
  };

  const usageKeyOrder = isV5
    ? [
        'totalTokens',
        'inputTokens',
        'outputTokens',
        'reasoningTokens',
        'cachedInputTokens',
        'inputDetails',
        'outputDetails',
      ]
    : ['totalTokens', 'promptTokens', 'completionTokens'];

  const usageAsArray = Object.entries(usage)
    .filter((entry): entry is [string, number | TokenDetailsObject] => {
      const value = entry[1];
      return typeof value === 'number' || isTokenDetailsObject(value);
    })
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => usageKeyOrder.indexOf(a.key) - usageKeyOrder.indexOf(b.key));

  return (
    <div className={cn('flex gap-6 flex-wrap', className)}>
      {usageAsArray.map(({ key, value }) => {
        const isObject = isTokenDetailsObject(value);

        return (
          <div className="bg-surface3 p-3 px-4 rounded-lg text-ui-md grow" key={key}>
            <div
              className={cn(
                'grid grid-cols-[1.5rem_1fr_auto] gap-2 items-center',
                '[&>svg]:w-[1.5em] [&>svg]:h-[1.5em] [&>svg]:opacity-70',
              )}
            >
              {tokenPresentations?.[key]?.icon}
              <span className="text-ui-md">{tokenPresentations?.[key]?.label}</span>
              {!isObject && <b className="text-ui-lg">{value}</b>}
            </div>
            {isObject && (
              <div className="text-ui-md mt-2 pl-8">
                {Object.entries(value).map(([detailKey, detailValue]) => {
                  if (typeof detailValue !== 'number') return null;
                  return (
                    <dl
                      key={detailKey}
                      className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 justify-between text-neutral3"
                    >
                      <dt>{detailKeyLabels[detailKey] || detailKey}</dt>
                      <dd>{detailValue}</dd>
                    </dl>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
