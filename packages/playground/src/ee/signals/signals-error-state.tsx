import { Button } from '@mastra/playground-ui/components/Button';
import { TriangleAlert } from 'lucide-react';

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
    <section className="border-border1 bg-surface2 m-4 rounded-lg border p-6 lg:m-6" role="alert">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-500" />
        <div>
          <h1 className="text-neutral6 text-sm font-semibold">{message}</h1>
          <p className="text-neutral3 mt-1 text-xs">Check the connection and try again.</p>
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
