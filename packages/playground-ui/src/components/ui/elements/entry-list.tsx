import { cn } from '@/lib/utils';

export type EntryListItem = {
  name: string;
  description?: string;
  icon?: any;
  to: string;
};

export type EntryListProps = {
  items?: EntryListItem[];
  className?: string;
  style?: React.CSSProperties;
  linkComponent?: any;
  isLoading?: boolean;
};

export function EntryList({ className, style, items, linkComponent, isLoading }: EntryListProps) {
  const EntryComponent = linkComponent || 'div';

  if (isLoading) {
    return 'Loading...';
  }

  if (!isLoading && items && items.length === 0) {
    return <div className="grid h-full justify-center items-center">No items found.</div>;
  }

  return (
    <ul className={cn(`grid`, className)} style={style}>
      {items?.map(item => {
        const Icon = item.icon;

        return (
          <li
            key={item.name}
            className="px-[0.875rem] py-[0.6875rem] border border-border1 bg-surface3 hover:bg-surface4 rounded-md"
          >
            <EntryComponent
              to={item.to && linkComponent ? item.to : undefined}
              className="flex [&>svg]:w-[1rem] [&>svg]:h-[1rem] gap-3 items-center [&>svg]:text-icon3"
            >
              {item.icon && <Icon />}
              <div className="text-[0,8125rem] grid gap-[0.25rem]">
                {item.name}
                {item.description && <p className="text-icon3 text-[0.6875rem]">{item.description}</p>}
              </div>
            </EntryComponent>
          </li>
        );
      })}
    </ul>
  );
}
