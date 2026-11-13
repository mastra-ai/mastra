import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';

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
        <IconExclamationTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive-foreground" />
        <div>
          <Txt as="h1" variant="subheading" tone="ink">
            {message}
          </Txt>
          <Txt variant="caption" tone="muted" className="mt-1">
            Check the connection and try again.
          </Txt>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={<IconArrowRotateCounterClockwise />} onClick={onRetry} size="sm" type="button">
              Retry
            </Button>
            {onClear ? (
              <Button icon={<IconCrossMedium />} onClick={onClear} size="sm" type="button" variant="ghost">
                Clear filter
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
