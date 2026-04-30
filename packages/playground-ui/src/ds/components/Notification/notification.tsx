import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { XIcon, InfoIcon, AlertTriangleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type NotificationProps = {
  children: React.ReactNode;
  className?: string;
  isVisible?: boolean;
  autoDismiss?: boolean;
  dismissTime?: number;
  dismissible?: boolean;
  type?: 'info' | 'error' | 'success' | 'warning';
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
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (dismissible && autoDismiss && isVisible) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, dismissTime);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, isVisible, dismissTime, dismissible]);

  useEffect(() => {
    if (isVisible) {
      setIsAnimatingOut(false);
      setLocalIsVisible(true);
    }
  }, [isVisible]);

  const handleDismiss = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setLocalIsVisible(false);
      setIsAnimatingOut(false);
    }, 200);
  };

  if (!localIsVisible) return null;

  const typeStyles = {
    info: 'bg-surface4 border-border1',
    error: 'bg-accent2Darker border-accent2/20',
    success: 'bg-accent1Darker border-accent1/30',
    warning: 'bg-accent6Darker border-accent6/30',
  };

  const iconStyles = {
    info: 'text-accent5',
    error: 'text-accent2',
    success: 'text-accent1',
    warning: 'text-accent6',
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border py-2.5 px-3.5 text-ui-md text-neutral4 items-start',
        'shadow-card',
        transitions.all,
        isAnimatingOut
          ? 'animate-out fade-out-0 slide-out-to-right-2 duration-200'
          : 'animate-in fade-in-0 slide-in-from-right-2 duration-300',
        typeStyles[type],
        className,
      )}
    >
      <div className={cn('shrink-0 mt-0.5', iconStyles[type])}>
        {type === 'error' || type === 'warning' ? (
          <AlertTriangleIcon className="h-4 w-4" />
        ) : (
          <InfoIcon className="h-4 w-4" />
        )}
      </div>
      <div className="flex gap-2 items-start min-w-0">{children}</div>
      {dismissible && (
        <Button
          variant="ghost"
          className={cn('h-6 w-6 p-0 shrink-0', transitions.colors, 'hover:bg-surface5')}
          onClick={handleDismiss}
        >
          <XIcon className="h-4 w-4" />
          <VisuallyHidden>Dismiss</VisuallyHidden>
        </Button>
      )}
    </div>
  );
}
