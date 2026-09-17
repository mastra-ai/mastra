import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';

export interface DataPanelNextPrevNavProps {
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
  variant?: ButtonProps['variant'];
}

export function DataPanelNextPrevNav({
  onPrevious,
  onNext,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  variant,
}: DataPanelNextPrevNavProps) {
  return (
    <ButtonsGroup spacing="close">
      <Button size="md" variant={variant} tooltip={previousLabel} onClick={onPrevious} disabled={!onPrevious}>
        <ArrowUpIcon />
      </Button>
      <Button size="md" variant={variant} tooltip={nextLabel} onClick={onNext} disabled={!onNext}>
        <ArrowDownIcon />
      </Button>
    </ButtonsGroup>
  );
}
