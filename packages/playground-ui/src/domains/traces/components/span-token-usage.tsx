import type { UsageStats } from '@mastra/core/observability';
import type { ReactNode } from 'react';
import { getModelFacts, getTokenUsageRows } from './span-token-usage.utils';
import { ProviderLogo } from '@/domains/llm';
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

type SpanModelSummaryProps = {
  span: Parameters<typeof getModelFacts>[0];
  className?: string;
};

/** What a model span ran on, how it ended, how fast it answered and the tokens it used. */
export function SpanModelSummary({ span, className }: SpanModelSummaryProps) {
  const { model, provider, finishReason, firstToken, speed } = getModelFacts(span);
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- Built SDK declarations type attributes.usage as unknown.
  const usage = span.attributes?.usage as UsageStats | undefined;
  const hasTokens = getTokenUsageRows(usage) !== null;
  if (!model && !finishReason && !firstToken && !speed && !hasTokens) return null;

  return (
    <DataKeysAndValues className={className}>
      {model && (
        <Row label="Model">
          <span className="flex min-w-0 items-center gap-1.5">
            {provider && <ProviderLogo providerId={provider} size="xs" />}
            <span className="truncate">{provider ? `${provider}/${model}` : model}</span>
          </span>
        </Row>
      )}
      {finishReason && <Row label="Finish reason">{finishReason}</Row>}
      {firstToken && <Row label="First token">{firstToken}</Row>}
      {speed && <Row label="Speed">{speed}</Row>}
      <TokenUsageRows usage={usage} />
    </DataKeysAndValues>
  );
}
