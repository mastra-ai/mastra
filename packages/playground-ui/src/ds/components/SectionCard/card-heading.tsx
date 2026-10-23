import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
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
      <Txt
        as="h3"
        variant="heading"
        tone="ink"
        id={id}
        className={cn(tone === 'danger' && 'text-destructive-subtle-foreground', className)}
      >
        {title}
      </Txt>
      {description != null && (
        <Txt variant="caption" tone="muted" className={cn('mt-1 max-w-[62ch]', descriptionClassName)}>
          {description}
        </Txt>
      )}
    </>
  );
}
