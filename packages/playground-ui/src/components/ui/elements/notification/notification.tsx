import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Button } from '../buttons/button';
import { XIcon } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

type Notification = {
  children: React.ReactNode;
  className?: string;
  isVisible?: boolean;
  autoDismiss?: boolean;
  dismissTime?: number;
};

export function Notification({ children, className, isVisible, autoDismiss = true, dismissTime = 5000 }: Notification) {
  const [localIsVisible, setLocalIsVisible] = useState(isVisible);

  useEffect(() => {
    if (autoDismiss && isVisible) {
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
        'grid grid-cols-[1fr_auto] gap-[0.5rem] rounded-l bg-white/5 p-[1.5rem] py-[1rem] text-[0.875rem] text-icon3 items-center',
        '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-50',
        className,
      )}
    >
      <div className="flex gap-[0.5rem] items-center">{children}</div>
      <Button variant="ghost" onClick={() => setLocalIsVisible(false)}>
        <XIcon />
        <VisuallyHidden>Dismiss</VisuallyHidden>
      </Button>
    </div>
  );
}
