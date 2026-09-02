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
          'font-display text-header-md leading-tight font-normal tracking-normal',
          danger ? 'text-red-9' : 'text-gray-10',
          className,
        )}
      >
        {title}
      </h3>
      {description != null && (
        <p
          className={cn(
            'mt-2 max-w-[62ch] font-sans text-[13.5px] leading-ui-xs',
            danger ? 'text-red-9/70' : 'text-gray-9',
            descriptionClassName,
          )}
        >
          {description}
        </p>
      )}
    </>
  );
}
