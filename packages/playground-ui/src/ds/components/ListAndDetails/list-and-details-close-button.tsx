import { XIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';

export type ListAndDetailsCloseButtonProps = {
  onClick: () => void;
  'aria-label'?: string;
  label?: string;
};

export function ListAndDetailsCloseButton({
  onClick,
  'aria-label': ariaLabel = 'Close panel',
  label = 'Close',
}: ListAndDetailsCloseButtonProps): React.JSX.Element {
  return (
    <Button variant="secondary" size="default" onClick={onClick} aria-label={ariaLabel}>
      <XIcon />
      {label}
    </Button>
  );
}
