import { Txt } from '@mastra/playground-ui/components/Txt';

function skippedReasonSummary(reasons: Array<{ reason: string }>) {
  const counts = new Map<string, number>();
  for (const { reason } of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => `${reason.replaceAll('-', ' ')} (${count})`).join(', ');
}

function switchedSessionsText(switched: number): string {
  if (switched === 0) return 'No sessions switched';
  return `Switched ${switched} ${switched === 1 ? 'session' : 'sessions'}`;
}

export function AppliedSessionsSummary({
  result,
}: {
  result: { applied: string[]; skipped: Array<{ reason: string }> };
}) {
  return (
    <Txt variant="meta">
      {switchedSessionsText(result.applied.length)}
      {result.skipped.length > 0 && (
        <>
          . {result.skipped.length} skipped: {skippedReasonSummary(result.skipped)}
        </>
      )}
    </Txt>
  );
}
