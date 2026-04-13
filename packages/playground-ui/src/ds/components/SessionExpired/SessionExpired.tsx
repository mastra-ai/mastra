import { useMastraClient } from '@mastra/react';
import { LogIn } from 'lucide-react';
import { useState, useCallback } from 'react';

import { Icon } from '../../icons/Icon';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';

export interface SessionExpiredProps {
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Additional CSS classes */
  className?: string;
}

export function SessionExpired({ title, description, className }: SessionExpiredProps) {
  const [isPending, setIsPending] = useState(false);
  const client = useMastraClient();

  const handleLogin = useCallback(async () => {
    try {
      setIsPending(true);
      const { baseUrl = '', apiPrefix } = (client as any).options || {};
      const raw = (apiPrefix || '/api').trim();
      const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');
      const params = new URLSearchParams({ redirect_uri: window.location.href });
      const url = `${baseUrl}${prefix}/auth/sso/login?${params}`;

      const response = await fetch(url, {
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

  return (
    <EmptyState
      className={className}
      iconSlot={
        <Icon size="lg" className="text-neutral3">
          <LogIn />
        </Icon>
      }
      titleSlot={title ?? 'Session Expired'}
      descriptionSlot={description ?? 'Your session has expired. Please log in again to continue.'}
      actionSlot={
        <Button variant="default" onClick={handleLogin} disabled={isPending}>
          {isPending ? 'Redirecting...' : 'Log in'}
        </Button>
      }
    />
  );
}
