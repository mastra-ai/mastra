import { useMastraClient } from '@mastra/react';
import { CircleXIcon, LogIn, ShieldX } from 'lucide-react';
import type * as React from 'react';
import { useCallback, useState } from 'react';

import { Icon } from '../../icons/Icon';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { errorFallback, parseError } from '@/lib/errors';
import { is401UnauthorizedError, is403ForbiddenError } from '@/lib/query-utils';

export interface QueryErrorProps {
  /** The error from a failed query. */
  error: unknown;
  /** Heading for the generic arm, e.g. `Failed to load tools`. */
  title: string;
  /** What the user was denied, for the 403 copy: "You don't have permission to access {resource}". */
  resource?: string;
  /** Recovery affordance on the generic arm — a retry button, usually. */
  action?: React.ReactNode;
  className?: string;
}

export function QueryError({ error, title, resource, action, className }: QueryErrorProps) {
  if (is401UnauthorizedError(error)) return <SessionExpired className={className} />;

  if (is403ForbiddenError(error)) {
    return (
      <EmptyState
        className={className}
        iconSlot={
          <Icon size="lg" className="text-neutral3">
            <ShieldX />
          </Icon>
        }
        titleSlot="Permission Denied"
        descriptionSlot={`You don't have permission to access ${resource ?? 'this resource'}. Contact your administrator for access.`}
      />
    );
  }

  return (
    <EmptyState
      className={className}
      iconSlot={
        <Icon size="lg" className="text-negative1">
          <CircleXIcon />
        </Icon>
      }
      titleSlot={title}
      descriptionSlot={error instanceof Error ? parseError(error).error : errorFallback}
      actionSlot={action}
    />
  );
}

function SessionExpired({ className }: { className?: string }) {
  const { login, isPending } = useSsoLogin();

  return (
    <EmptyState
      className={className}
      iconSlot={
        <Icon size="lg" className="text-neutral3">
          <LogIn />
        </Icon>
      }
      titleSlot="Session Expired"
      descriptionSlot="Your session has expired. Please log in again to continue."
      actionSlot={
        <Button variant="default" onClick={login} disabled={isPending}>
          {isPending ? 'Redirecting...' : 'Log in'}
        </Button>
      }
    />
  );
}

function useSsoLogin() {
  const [isPending, setIsPending] = useState(false);
  const client = useMastraClient();

  const login = useCallback(async () => {
    try {
      setIsPending(true);
      const baseUrl = client.options.baseUrl ?? '';
      const raw = (client.options.apiPrefix || '/api').trim();
      const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');
      const params = new URLSearchParams({ redirect_uri: window.location.href });

      const response = await fetch(`${baseUrl}${prefix}/auth/sso/login?${params}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      }
    } finally {
      setIsPending(false);
    }
  }, [client]);

  return { login, isPending };
}
