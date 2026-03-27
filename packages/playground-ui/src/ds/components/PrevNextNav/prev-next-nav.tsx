import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { ButtonsGroup } from '../ButtonsGroup';
import { Button } from '@/ds/components/Button';

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
    <ButtonsGroup spacing="close">
      <Button onClick={onPrevious} disabled={!onPrevious} aria-label={previousAriaLabel}>
        <ArrowUpIcon /> Prev
      </Button>
      <Button onClick={onNext} disabled={!onNext} aria-label={nextAriaLabel}>
        Next
        <ArrowDownIcon />
      </Button>
    </ButtonsGroup>
  );
}
