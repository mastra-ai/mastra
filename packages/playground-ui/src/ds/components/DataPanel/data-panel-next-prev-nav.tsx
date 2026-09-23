import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';

export interface DataPanelNextPrevNavProps {
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
  variant?: ButtonProps['variant'];
}

/** Two independent previous/next buttons, laid out by the parent `HeaderActions` gap. */
export function DataPanelNextPrevNav({
  onPrevious,
  onNext,
  previousLabel = 'Go to previous',
  nextLabel = 'Go to next',
  variant = 'ghost',
}: DataPanelNextPrevNavProps) {
  return (
    <>
      <Button size="sm" variant={variant} tooltip={previousLabel} onClick={onPrevious} disabled={!onPrevious}>
        <ArrowUpIcon />
      </Button>
      <Button size="sm" variant={variant} tooltip={nextLabel} onClick={onNext} disabled={!onNext}>
        <ArrowDownIcon />
      </Button>
    </>
  );
}
