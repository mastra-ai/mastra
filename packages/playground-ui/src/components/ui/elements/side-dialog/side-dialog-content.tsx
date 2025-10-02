import { cn } from '@/lib/utils';

export type SideDialogContentProps = {
  children?: React.ReactNode;
  className?: string;
  isCentered?: boolean;
  isFullHeight?: boolean;
  variant?: 'default' | 'confirmation';
};

export function SideDialogContent({ children, className, isCentered, isFullHeight, variant }: SideDialogContentProps) {
  return (
    <div className={cn('p-[3rem] py-[2rem] overflow-y-scroll', className)}>
      <div
        className={cn('grid gap-[2rem] max-w-[50rem] w-full mx-auto pb-[1rem] ', {
          'items-center justify-center h-full content-center': isCentered,
          'min-h-full': isFullHeight,
          'content-start': !isFullHeight && !isCentered,
        })}
      >
        {children}
      </div>
    </div>
  );
}

export type SideDialogSectionProps = {
  children?: React.ReactNode;
};

export function SideDialogSection({ children }: SideDialogSectionProps) {
  return (
    <div
      className={cn(
        'grid text-[0.875rem] text-icon5 gap-[1rem] justify-items-start',
        '[&>h3]:text-icon3 [&>h3]:text-[1rem] [&>h3]:font-semibold [&>h3]:border-b [&>h3]:border-border1 [&>h3]:pb-[1rem] [&>h3]:pr-[1rem] [&>h3]:inline-flex [&>h3]:gap-[.5rem] [&>h3]:items-center',
        '[&>h3>svg]:w-[1em] [&>h3>svg]:h-[1em] [&>h3>svg]:text-icon3',
      )}
    >
      {children}
    </div>
  );
}

type SideDialogKeyValueListProps = {
  items: { key: string; value: React.ReactNode }[];
  className?: string;
};

export function SideDialogKeyValueList({ items, className }: SideDialogKeyValueListProps) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-[2rem] gap-y-[.5rem] text-[0.875rem] content-start', className)}>
      {items.map((item, index) => (
        <>
          <dt className="text-icon3">{item.key}:</dt>
          <dd className="text-icon4">{item.value}</dd>
        </>
      ))}
    </dl>
  );
}
