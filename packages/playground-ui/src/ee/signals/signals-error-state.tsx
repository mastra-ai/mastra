import { TriangleAlert, X, RotateCcw } from 'lucide-react';
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
    <section className="m-4 rounded-lg border border-border bg-background p-6 lg:m-6" role="alert">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-500" />
        <div>
          <h1 className="text-subheading text-foreground">{message}</h1>
          <p className="mt-1 text-caption text-muted-foreground">Check the connection and try again.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={<RotateCcw />} onClick={onRetry} size="sm" type="button" variant="outline">
              Retry
            </Button>
            {onClear ? (
              <Button icon={<X />} onClick={onClear} size="sm" type="button" variant="ghost">
                Clear filter
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
