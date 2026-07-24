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
  return <dt className={cn('shrink-0  py-0.5 text-ui-smd text-neutral2', className)}>{children}</dt>;
}

export interface DataDetailsPanelKeyValueListValueProps {
  className?: string;
  children: React.ReactNode;
}

function Value({ className, children }: DataDetailsPanelKeyValueListValueProps) {
  return <dd className={cn('min-w-0 truncate py-0.5 text-ui-smd text-neutral3', className)}>{children}</dd>;
}

export interface DataDetailsPanelKeyValueListHeaderProps {
  className?: string;
  children: React.ReactNode;
}

function Header({ className, children }: DataDetailsPanelKeyValueListHeaderProps) {
  return (
    <dt className={cn('col-span-2 py-3 text-ui-sm tracking-widest text-neutral2 uppercase', className)}>{children}</dt>
  );
}

export const DataDetailsPanelKeyValueList = Object.assign(Root, {
  Key,
  Value,
  Header,
});
