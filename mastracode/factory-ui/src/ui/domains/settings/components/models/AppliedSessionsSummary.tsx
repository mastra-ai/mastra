import { Txt } from '@mastra/playground-ui/components/Txt';

function skippedReasonSummary(reasons: Array<{ reason: string }>) {
  const counts = new Map<string, number>();
  for (const { reason } of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => `${reason.replaceAll('-', ' ')} (${count})`).join(', ');
}

export function AppliedSessionsSummary({
  result,
}: {
  result: { applied: string[]; skipped: Array<{ reason: string }> };
}) {
  const switched = result.applied.length;
  return (
    <Txt variant="meta">
      {switched > 0 ? `Switched ${switched} session${switched === 1 ? '' : 's'}` : 'No running sessions to switch'}
      {result.skipped.length > 0 && (
        <>
          . {result.skipped.length} skipped: {skippedReasonSummary(result.skipped)}
        </>
      )}
    </Txt>
  );
}
