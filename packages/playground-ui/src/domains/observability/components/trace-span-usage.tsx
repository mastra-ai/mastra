import { cn } from '@/lib/utils';
import { ArrowRightIcon, ArrowRightToLineIcon, CoinsIcon } from 'lucide-react';
import type { InputTokenDetails, OutputTokenDetails } from '@mastra/core/observability';
import { SpanRecord } from '@mastra/core/storage';

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

// Helper to check if a value is a token details object
function isTokenDetailsObject(value: UsageValue): value is TokenDetailsObject {
  return typeof value === 'object' && value !== null;
}

// Labels for detail keys
const detailKeyLabels: Record<string, string> = {
  text: 'Text',
  cacheRead: 'Cache Read',
  cacheWrite: 'Cache Write',
  audio: 'Audio',
  image: 'Image',
  reasoning: 'Reasoning',
};

type TraceSpanUsageProps = {
  traceUsage?: TokenUsage;
  traceSpans?: SpanRecord[];
  className?: string;
  spanUsage?: TokenUsage;
};

export function TraceSpanUsage({ traceUsage, traceSpans = [], spanUsage, className }: TraceSpanUsageProps) {
  if (!traceUsage && !spanUsage) {
    console.warn('No usage data available');
    return null;
  }

  if (traceUsage && spanUsage) {
    console.warn('Only one of traceUsage or spanUsage should be provided');
    return null;
  }

  const generationSpans = traceSpans.filter(span => span.spanType === 'model_generation');

  // Determine if we're using v5 format (inputTokens/outputTokens) or legacy format (promptTokens/completionTokens)
  const hasV5Format = generationSpans.some(span => {
    const usage = span.attributes?.usage as TokenUsage | undefined;
    return usage && 'inputTokens' in usage;
  });

  const tokensByProvider = generationSpans.reduce(
    (acc: Record<string, TokenUsage>, span: SpanRecord) => {
      const spanUsage = (span.attributes?.usage || {}) as Partial<V5TokenUsage & LegacyTokenUsage>;
      const model = (span?.attributes?.model as string) || '';
      const provider = (span?.attributes?.provider as string) || '';
      const spanModelProvider = `${provider}${provider && model ? ' / ' : ''}${model}`;

      if (!acc?.[spanModelProvider]) {
        if (hasV5Format) {
          acc[spanModelProvider] = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            reasoningTokens: 0,
            cachedInputTokens: 0,
          };
        } else {
          acc[spanModelProvider] = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        }
      }

      // Aggregate based on the format being used
      if ('inputTokens' in acc[spanModelProvider] && hasV5Format) {
        const inputTokens = spanUsage.inputTokens ?? 0;
        const outputTokens = spanUsage.outputTokens ?? 0;
        const reasoningTokens = spanUsage.reasoningTokens ?? 0;
        const cachedInputTokens = spanUsage.cachedInputTokens ?? 0;
        const v5Acc = acc[spanModelProvider] as V5TokenUsage;
        v5Acc.inputTokens += inputTokens;
        v5Acc.outputTokens += outputTokens;
        v5Acc.reasoningTokens = (v5Acc.reasoningTokens ?? 0) + reasoningTokens;
        v5Acc.cachedInputTokens = (v5Acc.cachedInputTokens ?? 0) + cachedInputTokens;
        v5Acc.totalTokens += spanUsage.totalTokens || inputTokens + outputTokens;
      } else if ('promptTokens' in acc[spanModelProvider] && !hasV5Format) {
        const promptTokens = spanUsage.promptTokens ?? 0;
        const completionTokens = spanUsage.completionTokens ?? 0;
        const legacyAcc = acc[spanModelProvider];
        legacyAcc.promptTokens += promptTokens;
        legacyAcc.completionTokens += completionTokens;
        legacyAcc.totalTokens += spanUsage.totalTokens || promptTokens + completionTokens;
      }

      return acc;
    },
    {} as Record<string, TokenUsage>,
  );

  const traceTokensBasedOnSpans = Object.keys(tokensByProvider).reduce(
    (acc, provider) => {
      const providerUsage = tokensByProvider[provider];
      if (hasV5Format) {
        const v5Usage = providerUsage as V5TokenUsage;
        const v5Acc = acc as V5TokenUsage;
        v5Acc.inputTokens = (v5Acc.inputTokens || 0) + v5Usage.inputTokens;
        v5Acc.outputTokens = (v5Acc.outputTokens || 0) + v5Usage.outputTokens;
        v5Acc.reasoningTokens = (v5Acc.reasoningTokens || 0) + (v5Usage?.reasoningTokens ?? 0);
        v5Acc.cachedInputTokens = (v5Acc.cachedInputTokens || 0) + (v5Usage?.cachedInputTokens ?? 0);
        v5Acc.totalTokens = (v5Acc.totalTokens || 0) + v5Usage.totalTokens;
      } else {
        const legacyUsage = providerUsage as LegacyTokenUsage;
        const legacyAcc = acc as LegacyTokenUsage;
        legacyAcc.promptTokens = (legacyAcc.promptTokens || 0) + legacyUsage.promptTokens;
        legacyAcc.completionTokens = (legacyAcc.completionTokens || 0) + legacyUsage.completionTokens;
        legacyAcc.totalTokens = (legacyAcc.totalTokens || 0) + legacyUsage.totalTokens;
      }
      return acc;
    },
    hasV5Format
      ? ({ inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0, cachedInputTokens: 0 } as V5TokenUsage)
      : ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 } as LegacyTokenUsage),
  );

  const tokensByProviderValid = JSON.stringify(traceUsage) === JSON.stringify(traceTokensBasedOnSpans);

  const legacyTokenPresentations: Record<string, { label: string; icon: React.ReactNode }> = {
    promptTokens: {
      label: 'Prompt Tokens',
      icon: <ArrowRightIcon />,
    },
    completionTokens: {
      label: 'Completion Tokens',
      icon: <ArrowRightToLineIcon />,
    },
  };

  const v5TokenPresentations: Record<string, { label: string; icon: React.ReactNode }> = {
    inputTokens: {
      label: 'Input Tokens',
      icon: <ArrowRightIcon />,
    },
    outputTokens: {
      label: 'Output Tokens',
      icon: <ArrowRightToLineIcon />,
    },
    reasoningTokens: {
      label: 'Reasoning Tokens',
      icon: <ArrowRightToLineIcon />,
    },
    cachedInputTokens: {
      label: 'Cached Input Tokens',
      icon: <ArrowRightToLineIcon />,
    },
    inputDetails: {
      label: 'Input Details',
      icon: <ArrowRightIcon />,
    },
    outputDetails: {
      label: 'Output Details',
      icon: <ArrowRightToLineIcon />,
    },
  };
  const commonTokenPresentations: Record<string, { label: string; icon: React.ReactNode }> = {
    totalTokens: {
      label: 'Total LLM Tokens',
      icon: <CoinsIcon />,
    },
  };

  let tokenPresentations = {
    ...commonTokenPresentations,
    ...v5TokenPresentations,
    ...legacyTokenPresentations,
  };

  let usageKeyOrder: string[] = [];
  if (hasV5Format) {
    usageKeyOrder = [
      'totalTokens',
      'inputTokens',
      'outputTokens',
      'reasoningTokens',
      'cachedInputTokens',
      'inputDetails',
      'outputDetails',
    ];
  } else {
    usageKeyOrder = ['totalTokens', 'promptTokens', 'completionTokens'];
  }

  const usageAsArray = Object.entries(traceUsage || spanUsage || {})
    .filter((entry): entry is [string, number | TokenDetailsObject] => {
      const value = entry[1];
      return typeof value === 'number' || isTokenDetailsObject(value);
    })
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => usageKeyOrder.indexOf(a.key) - usageKeyOrder.indexOf(b.key));

  return (
    <div className={cn('flex gap-[1.5rem] flex-wrap', className)}>
      {usageAsArray.map(({ key, value }) => {
        const isObject = isTokenDetailsObject(value);

        return (
          <div
            className={cn('bg-white/5 p-[.75rem] px-[1rem] rounded-lg text-[0.875rem] flex-grow', {
              'min-h-[5.5rem]': traceUsage,
            })}
            key={key}
          >
            <div
              className={cn(
                'grid grid-cols-[1.5rem_1fr_auto] gap-[.5rem] items-center',
                '[&>svg]:w-[1.5em] [&>svg]:h-[1.5em] [&>svg]:opacity-70',
              )}
            >
              {tokenPresentations?.[key]?.icon}
              <span className="text-[0.875rem]">{tokenPresentations?.[key]?.label}</span>
              {!isObject && <b className="text-[1rem]">{value}</b>}
            </div>
            {isObject && (
              <div className="text-[0.875rem] mt-[0.5rem] pl-[2rem]">
                {Object.entries(value).map(([detailKey, detailValue]) => {
                  if (typeof detailValue !== 'number') return null;
                  return (
                    <dl
                      key={detailKey}
                      className="grid grid-cols-[1fr_auto] gap-x-[1rem] gap-y-[.25rem] justify-between text-neutral3"
                    >
                      <dt>{detailKeyLabels[detailKey] || detailKey}</dt>
                      <dd>{detailValue}</dd>
                    </dl>
                  );
                })}
              </div>
            )}
            {!isObject && tokensByProviderValid && (
              <div className="text-[0.875rem] mt-[0.5rem] pl-[2rem]">
                {Object.entries(tokensByProvider).map(([provider, providerTokens]) => {
                  const tokenValue = providerTokens?.[key as keyof typeof providerTokens];
                  if (typeof tokenValue !== 'number') return null;
                  return (
                    <dl
                      key={provider}
                      className="grid grid-cols-[1fr_auto] gap-x-[1rem] gap-y-[.25rem]  justify-between text-neutral3"
                    >
                      <dt>{provider}</dt>
                      <dd>{tokenValue}</dd>
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
