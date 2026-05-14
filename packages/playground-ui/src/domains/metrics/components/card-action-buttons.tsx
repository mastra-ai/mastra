import { EyeIcon, LogsIcon } from 'lucide-react';
import type { ElementType } from 'react';
import { ButtonWithTooltip } from '../../../ds/components/Button/ButtonWithTooltip';

type CardActionButtonProps = {
  /** Pre-built drilldown URL (typically from `useDrilldown().getTracesHref(...)`). */
  href: string;
  /** Override how the underlying anchor is rendered — pass a router-aware Link
   *  to keep navigation in-app. Defaults to `<a>`. */
  LinkComponent?: ElementType;
};

/** Icon link in a MetricsCard top bar that opens the Traces page pre-filtered
 *  to whatever dimensions the card knows about. */
export function OpenInTracesButton({ href, LinkComponent = 'a' }: CardActionButtonProps) {
  return (
    <ButtonWithTooltip
      as={LinkComponent}
      href={href}
      variant="ghost"
      size="icon-md"
      tooltipContent="View in Traces"
      aria-label="View in Traces"
    >
      <EyeIcon />
    </ButtonWithTooltip>
  );
}

/** Icon link in a MetricsCard top bar that opens the Logs page scoped to
 *  errors for the card's current dimensions. */
export function OpenErrorsInLogsButton({ href, LinkComponent = 'a' }: CardActionButtonProps) {
  return (
    <ButtonWithTooltip
      as={LinkComponent}
      href={href}
      variant="ghost"
      size="icon-md"
      tooltipContent="View errors in Logs"
      aria-label="View errors in Logs"
    >
      <LogsIcon />
    </ButtonWithTooltip>
  );
}
