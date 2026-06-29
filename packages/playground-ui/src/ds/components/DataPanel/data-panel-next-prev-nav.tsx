import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';

export interface DataPanelNextPrevNavProps {
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
}

export function DataPanelNextPrevNav({
  onPrevious,
  onNext,
  previousLabel = 'Previous',
  nextLabel = 'Next',
}: DataPanelNextPrevNavProps) {
  return (
    <ButtonsGroup spacing="close">
      <Button size="md" tooltip={previousLabel} onClick={onPrevious} disabled={!onPrevious}>
        <ArrowUpIcon />
      </Button>
      <Button size="md" tooltip={nextLabel} onClick={onNext} disabled={!onNext}>
        <ArrowDownIcon />
      </Button>
    </ButtonsGroup>
  );
}
