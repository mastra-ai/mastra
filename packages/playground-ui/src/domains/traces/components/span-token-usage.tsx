import type { UsageStats } from '@mastra/core/observability';
import type { ReactNode } from 'react';
import { getTokenUsageRows } from './span-token-usage.utils';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { Txt } from '@/ds/components/Txt';

export type TokenUsage = UsageStats;

type SpanTokenUsageProps = {
  usage: UsageStats;
  className?: string;
};

/** Input and output token counts, each followed by its breakdown. */
export function SpanTokenUsage({ usage, className }: SpanTokenUsageProps) {
  const rows = getTokenUsageRows(usage);
  if (!rows) return null;
  return (
    <DataKeysAndValues className={className}>
      <TokenUsageRows usage={usage} />
    </DataKeysAndValues>
  );
}

function TokenUsageRows({ usage }: { usage: UsageStats | undefined }) {
  return getTokenUsageRows(usage)?.map(({ label, total, breakdown }) => (
    <Row key={label} label={`${label} tokens`}>
      {total.toLocaleString()}
      {breakdown && (
        <Txt as="span" variant="caption" tone="muted">
          {` (${breakdown})`}
        </Txt>
      )}
    </Row>
  ));
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <DataKeysAndValues.Key>{label}</DataKeysAndValues.Key>
      <DataKeysAndValues.Value>{children}</DataKeysAndValues.Value>
    </>
  );
}
