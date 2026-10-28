import { EyeIcon, LogsIcon } from 'lucide-react';
import { Button } from '../../../ds/components/Button/Button';

type CardActionButtonProps = {
  onClick: () => void;
};

/** Icon button in a MetricsCard top bar that opens the Traces page pre-filtered
 *  to whatever dimensions the card knows about. */
export function OpenInTracesButton({ onClick }: CardActionButtonProps) {
  return (
    <Button onClick={onClick} variant="ghost" size="icon-md" tooltip="View in traces" aria-label="View in traces">
      <EyeIcon />
    </Button>
  );
}

/** Icon button in a MetricsCard top bar that opens the Logs page scoped to
 *  errors for the card's current dimensions. */
export function OpenErrorsInLogsButton({ onClick }: CardActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size="icon-md"
      tooltip="View errors in logs"
      aria-label="View errors in logs"
    >
      <LogsIcon />
    </Button>
  );
}
