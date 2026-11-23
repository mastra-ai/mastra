import { Button } from '@/ds/components/Button';
import { IconArrowDown } from '@/ds/icons/central/IconArrowDown';
import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';
import { cn } from '@/lib/utils';

export type SideDialogNavProps = {
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  className?: string;
};

export function SideDialogNav({ onNext, onPrevious, className }: SideDialogNavProps) {
  const handleOnNext = () => {
    onNext?.();
  };

  const handleOnPrevious = () => {
    onPrevious?.();
  };

  return (
    <div className={cn('flex items-center gap-3', '[&_svg]:size-[1.1em] [&_svg]:text-muted-foreground', className)}>
      {(onNext || onPrevious) && (
        <div className={cn('flex items-baseline gap-3')}>
          <Button onClick={handleOnPrevious} disabled={!onPrevious} icon={<IconArrowUp />}>
            Previous
          </Button>
          <Button onClick={handleOnNext} disabled={!onNext} icon={<IconArrowDown />}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
