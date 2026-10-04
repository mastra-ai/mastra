import { useId } from 'react';
import type { ReactNode } from 'react';
import { ApiKeysArt } from './illustrations/api-keys-art';
import { DatabasesArt } from './illustrations/databases-art';
import { DeploysArt } from './illustrations/deploys-art';
import { DisconnectedArt } from './illustrations/disconnected-art';
import { EnvironmentsArt } from './illustrations/environments-art';
import { LockedArt } from './illustrations/locked-art';
import { LogsArt } from './illustrations/logs-art';
import { RateLimitedArt } from './illustrations/rate-limited-art';
import { RequestsArt } from './illustrations/requests-art';
import { ThreadsArt } from './illustrations/threads-art';
import { TracesArt } from './illustrations/traces-art';

const artByName = {
  traces: TracesArt,
  logs: LogsArt,
  'api-keys': ApiKeysArt,
  environments: EnvironmentsArt,
  requests: RequestsArt,
  databases: DatabasesArt,
  threads: ThreadsArt,
  deploys: DeploysArt,
  disconnected: DisconnectedArt,
  locked: LockedArt,
  'rate-limited': RateLimitedArt,
} satisfies Record<string, (props: { id: string }) => ReactNode>;

export type EmptyStateIllustrationName = keyof typeof artByName;

export function EmptyStateIllustration({ name }: { name: EmptyStateIllustrationName }) {
  const id = useId().replace(/[^\w-]/g, '');
  const Art = artByName[name];

  return (
    <div className="group/illustration mb-5 text-foreground group-data-[tone=error]/empty-state:text-destructive-indicator">
      <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" data-illustration={name} className="block size-30">
        <mask id={`${id}-frame`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <circle cx="60" cy="60" r="60" fill="white" />
        </mask>
        <g mask={`url(#${id}-frame)`}>
          <Art id={id} />
        </g>
        <circle cx="60" cy="60" r="60" fill={`url(#${id}-glow)`} fillOpacity="0.09" />
        <defs>
          <linearGradient id={`${id}-glow`} x1="60" y1="0" x2="60" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="currentColor" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
