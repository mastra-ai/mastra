import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

export function StoryAdminLocked({
  what,
  label,
  className,
  children,
}: {
  what: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const reason = `Only Factory admins change ${what}`;
  return (
    <Button
      variant="ghost"
      size="sm"
      tooltip={reason}
      aria-label={`${label}. ${reason}`}
      className={cn('cursor-help', className)}
    >
      {children}
      <Lock aria-hidden />
    </Button>
  );
}
