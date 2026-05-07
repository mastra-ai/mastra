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
  const danger = tone === 'danger';
  return (
    <>
      <h3
        id={id}
        className={cn(
          'font-serif text-header-md font-normal leading-tight tracking-normal',
          danger ? 'text-accent2' : 'text-neutral4',
          className,
        )}
      >
        {title}
      </h3>
      {description != null && (
        <p
          className={cn(
            'mt-2 max-w-[62ch] font-sans text-[13.5px] leading-ui-xs',
            danger ? 'text-accent2/70' : 'text-neutral-500',
            descriptionClassName,
          )}
        >
          {description}
        </p>
      )}
    </>
  );
}
