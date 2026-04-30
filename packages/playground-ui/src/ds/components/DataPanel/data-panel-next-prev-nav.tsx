import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { ButtonWithTooltip } from '@/ds/components/Button/ButtonWithTooltip';
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
      <ButtonWithTooltip size="md" tooltipContent={previousLabel} onClick={onPrevious} disabled={!onPrevious}>
        <ArrowUpIcon />
      </ButtonWithTooltip>
      <ButtonWithTooltip size="md" tooltipContent={nextLabel} onClick={onNext} disabled={!onNext}>
        <ArrowDownIcon />
      </ButtonWithTooltip>
    </ButtonsGroup>
  );
}
