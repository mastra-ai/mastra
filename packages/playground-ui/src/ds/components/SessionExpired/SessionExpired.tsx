import { LogIn } from 'lucide-react';

import { useSSOLogin } from '@/domains/auth/hooks/use-auth-actions';

import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Icon } from '../../icons/Icon';

export interface SessionExpiredProps {
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Additional CSS classes */
  className?: string;
}

export function SessionExpired({ title, description, className }: SessionExpiredProps) {
  const { mutate: login, isPending } = useSSOLogin();

  const handleLogin = () => {
    login(
      { redirectUri: window.location.href },
      {
        onSuccess: data => {
          window.location.href = data.url;
        },
      },
    );
  };

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
