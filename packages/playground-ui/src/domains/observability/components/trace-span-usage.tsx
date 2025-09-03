import { cn } from '@/lib/utils';
import { ArrowRightIcon, ArrowRightToLineIcon, CoinsIcon } from 'lucide-react';

type TraceSpanUsageProps = {
  traceUsage?: { [key: string]: any };
  traceSpans?: any[];
  className?: string;
  spanUsage?: { [key: string]: any };
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

  const generationSpans = traceSpans.filter(span => span.spanType === 'llm_generation');
  const tokensByProvider = generationSpans.reduce(
    (acc, span) => {
      const spanUsage = span.attributes?.usage || {};
      const spanProvider = `${span.attributes?.provider ? span.attributes?.provider : ''}${span.attributes?.provider && span.attributes?.model ? ' / ' : ''}${span.attributes?.model ? span.attributes?.model : ''}`;

      if (!acc?.[spanProvider]) {
        acc[spanProvider] = { promptTokens: 0, completionTokens: 0 };
      }

      acc[spanProvider].promptTokens += spanUsage.promptTokens || 0;
      acc[spanProvider].completionTokens += spanUsage.completionTokens || 0;

      return acc;
    },
    {} as Record<string, { promptTokens: number; completionTokens: number }>,
  );

  Object.keys(tokensByProvider).forEach(provider => {
    const { promptTokens, completionTokens } = tokensByProvider[provider];
    tokensByProvider[provider] = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
  });

  const traceTokensBasedOnSpans: { promptTokens: number; completionTokens: number; totalTokens: number } = Object.keys(
    tokensByProvider,
  ).reduce(
    (acc, provider) => {
      const { promptTokens, completionTokens, totalTokens } = tokensByProvider[provider];
      acc.promptTokens += promptTokens;
      acc.completionTokens += completionTokens;
      acc.totalTokens += totalTokens;
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );

  const tokensByProviderValid = JSON.stringify(traceUsage) === JSON.stringify(traceTokensBasedOnSpans);

  const tokenPresentations: Record<string, { label: string; icon: React.ReactNode }> = {
    totalTokens: {
      label: 'Total LLM Tokens',
      icon: <CoinsIcon />,
    },
    promptTokens: {
      label: 'Prompt Tokens',
      icon: <ArrowRightIcon />,
    },
    completionTokens: {
      label: 'Completion Tokens',
      icon: <ArrowRightToLineIcon />,
    },
  };

  const usageKeyOrder = ['totalTokens', 'promptTokens', 'completionTokens'];

  const usageAsArray = Object.entries(traceUsage || spanUsage || {})
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => usageKeyOrder.indexOf(a.key) - usageKeyOrder.indexOf(b.key));

  return (
    <div
      className={cn(
        'grid gap-[1.5rem] pr-[1.5rem]',
        {
          'xl:grid-cols-3': usageAsArray.length === 3,
          'xl:grid-cols-2': usageAsArray.length === 2,
        },
        className,
      )}
    >
      {usageAsArray.map(({ key, value }) => (
        <div
          className={cn('bg-white/5 p-[1rem] px-[1.25rem] rounded-lg text-[0.875rem]', {
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
            <b className="text-[1rem]">{value}</b>
          </div>
          {tokensByProviderValid && (
            <div className="text-[0.875rem] mt-[0.5rem] pl-[2rem] ">
              {Object.entries(tokensByProvider).map(([provider, providerTokens]) => (
                <dl
                  key={provider}
                  className="grid grid-cols-[1fr_auto] gap-x-[1rem] gap-y-[.25rem]  justify-between text-icon3"
                >
                  <dt>{provider}</dt>
                  <dd>{providerTokens?.[key as keyof typeof providerTokens]}</dd>
                </dl>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
