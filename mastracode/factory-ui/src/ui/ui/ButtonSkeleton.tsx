import { Button } from '@mastra/playground-ui/components/Button';
import type { ButtonSize, ButtonVariant } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export function ButtonSkeleton({
  variant,
  size,
  className,
  children,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Skeleton
      aria-hidden
      inert
      className={cn('flex w-fit shrink-0 rounded-full motion-reduce:before:animate-none', className)}
    >
      <Button variant={variant} size={size} tabIndex={-1} className="invisible">
        {children}
      </Button>
    </Skeleton>
  );
}
