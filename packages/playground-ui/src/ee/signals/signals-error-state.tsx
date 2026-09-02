import { TriangleAlert } from 'lucide-react';
import { Button } from '@/ds/components/Button';

export function SignalsErrorState({
  message,
  onRetry,
  onClear,
}: {
  message: string;
  onRetry: () => void;
  onClear?: () => void;
}) {
  return (
    <section className="bg-surface-secondary m-4 rounded-lg border border-(--border-subtle) p-6 lg:m-6" role="alert">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="text-error mt-0.5 size-5 shrink-0" />
        <div>
          <h1 className="text-sm font-semibold text-(--text-primary)">{message}</h1>
          <p className="mt-1 text-xs text-(--text-secondary)">Check the connection and try again.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onRetry} size="sm" type="button" variant="outline">
              Retry
            </Button>
            {onClear ? (
              <Button onClick={onClear} size="sm" type="button" variant="ghost">
                Clear filter
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
