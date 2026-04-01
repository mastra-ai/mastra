import { cn } from '@/lib/utils';

export interface DataDetailsPanelKeyValueListProps {
  className?: string;
  children: React.ReactNode;
}

function Root({ className, children }: DataDetailsPanelKeyValueListProps) {
  return <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5', className)}>{children}</dl>;
}

export interface DataDetailsPanelKeyValueListKeyProps {
  className?: string;
  children: React.ReactNode;
}

function Key({ className, children }: DataDetailsPanelKeyValueListKeyProps) {
  return <dt className={cn('text-ui-smd  text-neutral2 shrink-0 py-0.5', className)}>{children}</dt>;
}

export interface DataDetailsPanelKeyValueListValueProps {
  className?: string;
  children: React.ReactNode;
}

function Value({ className, children }: DataDetailsPanelKeyValueListValueProps) {
  return <dd className={cn('text-ui-smd text-neutral3 truncate min-w-0 py-0.5', className)}>{children}</dd>;
}

export interface DataDetailsPanelKeyValueListHeaderProps {
  className?: string;
  children: React.ReactNode;
}

function Header({ className, children }: DataDetailsPanelKeyValueListHeaderProps) {
  return (
    <dt className={cn('col-span-2 text-ui-sm uppercase tracking-widest text-neutral2 py-3', className)}>{children}</dt>
  );
}

export const DataDetailsPanelKeyValueList = Object.assign(Root, {
  Key,
  Value,
  Header,
});
