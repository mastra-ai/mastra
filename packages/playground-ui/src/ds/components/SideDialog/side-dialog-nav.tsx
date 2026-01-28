import { Button } from '@/ds/components/Button';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
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
    <div
      className={cn('flex items-center gap-4', '[&_svg]:w-[1.1em] [&_svg]:h-[1.1em] [&_svg]:text-neutral3', className)}
    >
      {(onNext || onPrevious) && (
        <div className={cn('flex gap-4 items-baseline')}>
          <Button onClick={handleOnPrevious} disabled={!onPrevious}>
            Previous
            <ArrowUpIcon />
          </Button>
          <Button onClick={handleOnNext} disabled={!onNext}>
            Next
            <ArrowDownIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
