import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { XIcon } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export type NotificationProps = {
  children: React.ReactNode;
  className?: string;
  isVisible?: boolean;
  autoDismiss?: boolean;
  dismissTime?: number;
  dismissible?: boolean;
  type?: 'info' | 'error';
};

export function Notification({
  children,
  className,
  isVisible,
  autoDismiss = true,
  dismissTime = 5000,
  dismissible = true,
  type = 'info',
}: NotificationProps) {
  const [localIsVisible, setLocalIsVisible] = useState(isVisible);

  useEffect(() => {
    if (dismissible && autoDismiss && isVisible) {
      const timer = setTimeout(() => {
        setLocalIsVisible(false);
      }, dismissTime);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, isVisible, dismissTime]);

  useEffect(() => {
    setLocalIsVisible(isVisible);
  }, [isVisible]);

  if (!localIsVisible) return null;

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto] gap-[0.5rem] rounded-lg bg-white/5 p-[1.5rem] py-[1rem] text-[0.875rem] text-icon3 items-center',
        {
          'bg-red-900/10 border border-red-900': type === 'error',
        },
        className,
      )}
    >
      <div
        className={cn(
          'flex gap-[0.5rem] items-start',
          '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-70 [&>svg]:translate-y-[0.2em]',
          {
            '[&>svg]:text-red-400': type === 'error',
          },
        )}
      >
        {children}
      </div>
      {dismissible && (
        <Button onClick={() => setLocalIsVisible(false)}>
          <XIcon />
          <VisuallyHidden>Dismiss</VisuallyHidden>
        </Button>
      )}
    </div>
  );
}
