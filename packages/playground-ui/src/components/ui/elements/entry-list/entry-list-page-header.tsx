import { cn } from '@/lib/utils';

type EntryListPageHeaderProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
};

export function EntryListPageHeader({ title, description, icon, children }: EntryListPageHeaderProps) {
  return (
    <div
      className={cn(
        'grid z-[1] top-0 gap-y-[0.5rem] text-icon4 bg-surface2 py-[3rem]',
        '3xl:h-full 3xl:content-start 3xl:grid-rows-[auto_1fr] h-full 3xl:overflow-y-auto',
      )}
    >
      <div className="grid gap-[1rem] w">
        <div className={cn('flex gap-[.75em] items-center', '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:text-icon4')}>
          {icon}
          <h1 className="text-icon6 text-[1.25rem]">{title}</h1>
        </div>
        <p className="m-0 text-[0.875rem]">{description}</p>
      </div>
      {children}
    </div>
  );
}
