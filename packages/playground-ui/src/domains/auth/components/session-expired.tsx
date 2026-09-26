import { useMastraClient } from '@mastra/react';
import { LogInIcon, TimerOffIcon } from 'lucide-react';
import { useState } from 'react';

import { makeSSOLoginRequest } from '@/domains/auth/services/sso-login';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import type { EmptyStateProps } from '@/ds/components/EmptyState';
import { toast } from '@/lib/toast';

export type SessionExpiredProps = {
  variant?: EmptyStateProps['variant'];
};

export function SessionExpired({ variant }: SessionExpiredProps) {
  const client = useMastraClient();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const logIn = async () => {
    setIsRedirecting(true);
    try {
      const { url } = await makeSSOLoginRequest(client, { redirectUri: window.location.href });
      window.location.href = url;
    } catch {
      setIsRedirecting(false);
      toast.error('Could not start the login. Try again.');
    }
  };

  return (
    <EmptyState
      variant={variant}
      iconSlot={<TimerOffIcon />}
      titleSlot="Session expired"
      descriptionSlot="Your session expired. Log in again to continue."
      actionSlot={
        <Button icon={<LogInIcon />} variant="default" onClick={logIn} disabled={isRedirecting}>
          {isRedirecting ? 'Redirecting...' : 'Log in'}
        </Button>
      }
    />
  );
}
