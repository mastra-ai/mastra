import { Txt } from '@/ds/components/Txt/Txt';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EntryProps = {
  label: ReactNode;
  children: ReactNode;
  description?: string;
  layout?: 'stacked' | 'inline';
  className?: string;
};

export const Entry = ({ label, children, description, layout = 'stacked', className }: EntryProps) => {
  if (layout === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 py-3 border-b border-border1 last:border-b-0',
          className,
        )}
      >
        <div className="flex-1 min-w-0">
          <Txt as="p" variant="ui-md" className="text-neutral6 font-medium">
            {label}
          </Txt>
          {description && (
            <Txt as="p" variant="ui-sm" className="text-neutral3 mt-0.5">
              {description}
            </Txt>
          )}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div>
        <Txt as="p" variant="ui-md" className="text-neutral6 font-medium">
          {label}
        </Txt>
        {description && (
          <Txt as="p" variant="ui-sm" className="text-neutral3 mt-0.5">
            {description}
          </Txt>
        )}
      </div>
      {children}
    </div>
  );
};
