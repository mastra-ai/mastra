import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/react/hooks/query';
import { RotateCcwIcon } from 'lucide-react';
import { PermissionDenied } from '@/domains/auth/components/permission-denied';
import { SessionExpired } from '@/domains/auth/components/session-expired';
import { Button } from '@/ds/components/Button';
import { MetricsCard } from '@/ds/components/MetricsCard';

/**
 * Fills a chart card's body when its data failed to load. Pass `error` and `onRetry` to explain
 * an expired session or missing permission, and to let the user try a failed request again.
 */
export function ChartCardError({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  if (is401UnauthorizedError(error)) return <SessionExpired />;
  if (is403ForbiddenError(error)) return <PermissionDenied resource="traces" />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <MetricsCard.Error message="Couldn't load this data. Try again in a moment." />
      {onRetry && (
        <Button size="sm" icon={<RotateCcwIcon />} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
