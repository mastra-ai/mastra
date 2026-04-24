import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui';
import { EyeIcon, LogsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

const ICON_LINK_CLASSES =
  'inline-flex items-center justify-center h-7 w-7 rounded-md text-neutral3 hover:text-neutral6 hover:bg-surface3 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-border2';

function IconLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={to} aria-label={label} className={ICON_LINK_CLASSES}>
          {children}
        </Link>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Icon link in a MetricsCard top bar that opens the Traces page pre-filtered
 *  to whatever dimensions the card knows about. */
export function OpenInTracesButton({ href }: { href: string }) {
  return (
    <IconLink to={href} label="View in Traces">
      <EyeIcon className="size-4" />
    </IconLink>
  );
}

/** Icon link in a MetricsCard top bar that opens the Logs page scoped to
 *  errors for the card's current dimensions. */
export function OpenErrorsInLogsButton({ href }: { href: string }) {
  return (
    <IconLink to={href} label="View errors in Logs">
      <LogsIcon className="size-4" />
    </IconLink>
  );
}
