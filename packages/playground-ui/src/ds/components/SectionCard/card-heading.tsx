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
  const danger = tone === 'danger';
  return (
    <>
      <Txt as="h3" variant="heading" tone="ink" id={id} className={cn(danger && 'text-accent2', className)}>
        {title}
      </Txt>
      {description != null && (
        <p
          className={cn(
            'mt-1 max-w-[62ch]',
            danger ? 'text-caption text-accent2/70' : 'text-caption text-muted-foreground',
            descriptionClassName,
          )}
        >
          {description}
        </p>
      )}
    </>
  );
}
