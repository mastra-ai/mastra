import type { ComponentProps, ReactNode } from 'react';
import { Avatar } from '@/ds/components/Avatar';
import { Button } from '@/ds/components/Button';
import { Status } from '@/ds/components/StatusIndicators';
import type { StatusPresentation } from '@/ds/components/StatusIndicators';
import { Txt } from '@/ds/components/Txt';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export type ConnectionRequestStatus = 'request' | 'waiting' | 'connected' | 'failed' | 'declined' | 'expired';

export interface ConnectionRequestCardProps extends Omit<ComponentProps<'div'>, 'children'> {
  displayName: string;
  logoUrl?: string;
  status: ConnectionRequestStatus;
  accountLabel?: string;
  children: ReactNode;
  onConnect?: () => void;
  onDecline?: () => void;
  onRetry?: () => void;
}

type OutcomeStatus = Exclude<ConnectionRequestStatus, 'request'>;

const outcomes = {
  waiting: { tone: 'progress', label: displayName => `Waiting for ${displayName}` },
  connected: {
    tone: 'success',
    label: (_displayName, accountLabel) => (accountLabel ? `Connected as ${accountLabel}` : 'Connected'),
  },
  failed: { tone: 'error', label: displayName => `Couldn’t connect ${displayName}` },
  declined: { tone: 'neutral', glyph: 'ring', label: () => 'Not now' },
  expired: { tone: 'neutral', glyph: 'ring', label: () => 'Link expired' },
} satisfies Record<
  OutcomeStatus,
  Pick<StatusPresentation, 'tone' | 'glyph'> & { label: (displayName: string, accountLabel?: string) => string }
>;

function OutcomeStatusLine({
  status,
  displayName,
  accountLabel,
}: {
  status: OutcomeStatus;
  displayName: string;
  accountLabel?: string;
}) {
  const { label, ...look } = outcomes[status];
  const text = label(displayName, accountLabel);
  return <Status role="status" presentation={{ ...look, label: text, description: text }} />;
}

export function ConnectionRequestCard({
  displayName,
  logoUrl,
  status,
  accountLabel,
  children,
  onConnect,
  onDecline,
  onRetry,
  className,
  ...props
}: ConnectionRequestCardProps) {
  return (
    <div
      data-slot="connection-request"
      className={cn(raisedSurfaceStyle, 'grid w-full gap-3 rounded-xl p-4', className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <Avatar src={logoUrl} name={displayName} />
        <Txt as="p" variant="subheading" tone="ink">
          {displayName}
        </Txt>
      </div>
      <Txt as="p" variant="body" tone="muted">
        {children}
      </Txt>
      {status === 'request' ? (
        <div className="flex flex-wrap items-center gap-2">
          {onConnect && (
            <Button type="button" variant="primary" size="sm" onClick={onConnect}>
              Connect
            </Button>
          )}
          {onDecline && (
            <Button type="button" size="sm" onClick={onDecline}>
              Not now
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-body-sm text-muted-foreground">
          <OutcomeStatusLine status={status} displayName={displayName} accountLabel={accountLabel} />
          {status === 'expired' && onRetry && (
            <Button type="button" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
