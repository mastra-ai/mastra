import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CardHeadingProps {
  title: ReactNode;
  description?: ReactNode;
  tone?: 'default' | 'danger';
  id?: string;
  className?: string;
  descriptionClassName?: string;
}

export function CardHeading({
  title,
  description,
  tone = 'default',
  id,
  className,
  descriptionClassName,
}: CardHeadingProps) {
  return (
    <>
      <h3
        id={id}
        className={cn(
          'text-heading text-foreground',
          tone === 'danger' && 'text-destructive-subtle-foreground',
          className,
        )}
      >
        {title}
      </h3>
      {description != null && (
        <p className={cn('mt-1 max-w-[62ch] text-caption text-muted-foreground', descriptionClassName)}>
          {description}
        </p>
      )}
    </>
  );
}
