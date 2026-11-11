import { ListTreeIcon, LogsIcon, MessagesSquareIcon } from 'lucide-react';
import { MetricsCard } from '../../../ds/components/MetricsCard';
import { TraceIcon } from '../../../ds/icons/TraceIcon';
import { onCardHover } from './on-card-hover';

type CardActionButtonProps = {
  onClick: () => void;
};

/** Icon button in a MetricsCard top bar that opens the Traces page pre-filtered
 *  to whatever dimensions the card knows about. Waits for the card's hover. */
export function OpenInTracesButton({ onClick }: CardActionButtonProps) {
  return (
    <MetricsCard.Action label="View in traces" className={onCardHover} onClick={onClick}>
      <TraceIcon />
    </MetricsCard.Action>
  );
}

/** Icon button in a MetricsCard top bar that opens the Logs page scoped to
 *  errors for the card's current dimensions. Waits for the card's hover. */
export function OpenErrorsInLogsButton({ onClick }: CardActionButtonProps) {
  return (
    <MetricsCard.Action label="View errors in logs" className={onCardHover} onClick={onClick}>
      <LogsIcon />
    </MetricsCard.Action>
  );
}

/** Icon button in a MetricsCard top bar that opens the Logs page scoped to
 *  the card's current dimensions, whatever their status. Waits for the card's hover. */
export function OpenInLogsButton({ onClick }: CardActionButtonProps) {
  return (
    <MetricsCard.Action label="View in logs" className={onCardHover} onClick={onClick}>
      <LogsIcon />
    </MetricsCard.Action>
  );
}

/** Icon button in a MetricsCard top bar that opens the Spans page scoped to
 *  the card's current dimensions. Waits for the card's hover. */
export function OpenInSpansButton({ onClick }: CardActionButtonProps) {
  return (
    <MetricsCard.Action label="View in spans" className={onCardHover} onClick={onClick}>
      <ListTreeIcon />
    </MetricsCard.Action>
  );
}

/** Icon button in a MetricsCard top bar that opens the Threads page scoped to
 *  the card's current dimensions. Waits for the card's hover. */
export function OpenInThreadsButton({ onClick }: CardActionButtonProps) {
  return (
    <MetricsCard.Action label="View in threads" className={onCardHover} onClick={onClick}>
      <MessagesSquareIcon />
    </MetricsCard.Action>
  );
}
