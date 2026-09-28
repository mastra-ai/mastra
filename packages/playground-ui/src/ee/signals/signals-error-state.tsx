import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';

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
    <div role="alert" className="h-full">
      <EmptyState
        as="h2"
        variant="fill"
        tone="error"
        titleSlot={message}
        descriptionSlot="Check the connection and try again."
        actionSlot={
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<RotateCcw />} onClick={onRetry} size="sm" type="button">
              Retry
            </Button>
            {onClear ? (
              <Button icon={<X />} onClick={onClear} size="sm" type="button" variant="ghost">
                Clear filter
              </Button>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
