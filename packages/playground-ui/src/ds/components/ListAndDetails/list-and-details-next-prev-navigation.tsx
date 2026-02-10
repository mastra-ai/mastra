import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '../ButtonsGroup';

export type ListAndDetailsNextPrevNavigationProps = {
  onPrevious?: () => void;
  onNext?: () => void;
  previousAriaLabel?: string;
  nextAriaLabel?: string;
};

export function ListAndDetailsNextPrevNavigation({
  onPrevious,
  onNext,
  previousAriaLabel = 'Previous',
  nextAriaLabel = 'Next',
}: ListAndDetailsNextPrevNavigationProps): React.JSX.Element {
  return (
    <ButtonsGroup spacing="close">
      <Button
        variant="secondary"
        size="default"
        onClick={onPrevious}
        disabled={!onPrevious}
        aria-label={previousAriaLabel}
        hasRightSibling={true}
      >
        <ArrowUpIcon /> Prev
      </Button>
      <Button
        variant="secondary"
        hasLeftSibling={true}
        size="default"
        onClick={onNext}
        disabled={!onNext}
        aria-label={nextAriaLabel}
      >
        Next
        <ArrowDownIcon />
      </Button>
    </ButtonsGroup>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="hidden 3xl:inline">{children}</span>;
}
