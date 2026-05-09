import type { InputTokenDetails, OutputTokenDetails, UsageStats } from '@mastra/core/observability';
import { Fragment } from 'react';
import { getTokenUsageView } from './span-token-usage.utils';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { cn } from '@/lib/utils';

export type TokenUsage = UsageStats;

type TokenDetailsObject = InputTokenDetails | OutputTokenDetails;

const detailKeyLabels: Record<string, string> = {
  text: 'Text',
  cacheRead: 'Cache read',
  cacheWrite: 'Cache write',
  audio: 'Audio',
  image: 'Image',
  reasoning: 'Reasoning',
};

type SpanTokenUsageProps = {
  usage: UsageStats;
  className?: string;
};

const INPUT_COLOR = 'oklch(0.78 0.16 320)';
const OUTPUT_COLOR = 'oklch(0.55 0.18 320)';

export function SpanTokenUsage({ usage, className }: SpanTokenUsageProps) {
  const view = getTokenUsageView(usage);
  if (!view) return null;

  const { inputValue, outputValue, total, showSplit, inputPct, outputPct, inputDetails, outputDetails } = view;

  return (
    <div
      className={cn('border-b border-border1 mt-2 mb-8 pb-3 grid grid-cols-1 4xl:grid-cols-2 4xl:gap-12', className)}
    >
      {showSplit && (
        <div className="mb-2">
          <div className="flex items-baseline text-neutral2 gap-3">
            <span className="text-ui-md">Tokens Used</span>
            <span className="text-neutral4 text-ui-md font-semibold">{total.toLocaleString()}</span>
            <span className="ml-auto text-ui-sm">
              {Math.round(inputPct)}% Input vs {Math.round(outputPct)}% Output
            </span>
          </div>
          <div className="p-1.5 rounded-md bg-surface4 mt-2">
            <div className="relative w-full h-1.5 rounded-sm overflow-hidden">
              <div
                className="absolute h-1.5 top-0 left-0"
                style={{ width: `${inputPct}%`, backgroundColor: INPUT_COLOR }}
              />
              <div
                className="absolute h-1.5 top-0"
                style={{ left: `${inputPct}%`, width: `${outputPct}%`, backgroundColor: OUTPUT_COLOR }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 grid-cols-2">
        <UsageColumn label="Input" color={INPUT_COLOR} value={inputValue} details={inputDetails} />
        <UsageColumn label="Output" color={OUTPUT_COLOR} value={outputValue} details={outputDetails} />
      </div>
    </div>
  );
}

function UsageColumn({
  label,
  color,
  value,
  details,
}: {
  label: string;
  color: string;
  value?: number;
  details?: TokenDetailsObject;
}) {
  return (
    <div>
      <div className="flex items-baseline text-neutral2 gap-3 mb-2">
        <span className="text-ui-md">{label}</span>
        {typeof value === 'number' && (
          <span className="flex items-baseline gap-1.5">
            <span className="text-neutral4 text-ui-md font-semibold">{value.toLocaleString()}</span>
            <span className="size-2 rounded-full self-center" style={{ backgroundColor: color }} />
          </span>
        )}
      </div>
      {details && <DetailsList details={details} />}
    </div>
  );
}

function DetailsList({ details }: { details: TokenDetailsObject }) {
  return (
    <DataKeysAndValues density="dense">
      {Object.entries(details).map(([detailKey, detailValue]) => {
        if (typeof detailValue !== 'number') return null;
        return (
          <Fragment key={detailKey}>
            <DataKeysAndValues.Key>{detailKeyLabels[detailKey] || detailKey}</DataKeysAndValues.Key>
            <DataKeysAndValues.Value className="text-right">{detailValue.toLocaleString()}</DataKeysAndValues.Value>
          </Fragment>
        );
      })}
    </DataKeysAndValues>
  );
}
