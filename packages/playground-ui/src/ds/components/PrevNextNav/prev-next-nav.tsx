import { Button } from '@/ds/components/Button';
import { IconArrowDown } from '@/ds/icons/central/IconArrowDown';
import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';

export type PrevNextNavProps = {
  onPrevious?: () => void;
  onNext?: () => void;
  previousAriaLabel?: string;
  nextAriaLabel?: string;
};

export function PrevNextNav({
  onPrevious,
  onNext,
  previousAriaLabel = 'Previous',
  nextAriaLabel = 'Next',
}: PrevNextNavProps) {
  return (
    <div className="flex items-center gap-1">
      <Button onClick={onPrevious} disabled={!onPrevious} aria-label={previousAriaLabel} icon={<IconArrowUp />}>
        Prev
      </Button>
      <Button onClick={onNext} disabled={!onNext} aria-label={nextAriaLabel} icon={<IconArrowDown />}>
        Next
      </Button>
    </div>
  );
}
