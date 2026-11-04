import { createContext, useContext } from 'react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const SingleLineContext = createContext(false);

export type MetadataProps = ComponentProps<'span'> & {
  singleLine?: boolean;
};

export function Metadata({ singleLine = false, className, ...props }: MetadataProps) {
  return (
    <SingleLineContext.Provider value={singleLine}>
      <span
        {...props}
        data-slot="metadata"
        className={cn(
          singleLine
            ? 'flex max-w-full min-w-0 items-center gap-x-2 overflow-hidden'
            : 'inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1',
          className,
        )}
      />
    </SingleLineContext.Provider>
  );
}

function MetadataItem({ className, ...props }: ComponentProps<'span'>) {
  const singleLine = useContext(SingleLineContext);

  return (
    <span
      {...props}
      data-slot="metadata-item"
      className={cn(
        singleLine
          ? 'min-w-0 truncate'
          : 'inline-flex max-w-full min-w-0 items-center gap-1 wrap-anywhere whitespace-normal',
        className,
      )}
    />
  );
}

Metadata.Item = MetadataItem;
