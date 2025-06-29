import { cn } from '@/lib/utils';
import { MainListEmpty } from '../fragments/main-list-empty';
import { predefinedEmptyListContent } from '../fragments/main-list-empty';
import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';

type Column = {
  key: string;
  label: string;
  minWidth?: string;
  maxWidth?: string;
};

type Item = {
  id: string;
  name: string;
  icon?: React.ReactNode;
  to: string;
  description?: string;
  columns?: React.ReactNode[];
  collapsible?: React.ReactNode;
};

type MainListProps = {
  columns?: Column[];
  items?: Item[];
  className?: string;
  style?: React.CSSProperties;
  linkComponent?: any;
  emptyStateFor?: 'networks' | 'agents' | 'mcpServers' | 'workflows' | 'tools';
  isLoading?: boolean;
  withCollapsible?: boolean;
};

const DEFAULT_COLUMN_MIN_WIDTH = '10rem';
const DEFAULT_COLUMN_MAX_WIDTH = '15rem';

export function MainList({
  className,
  style,
  items,
  columns,
  linkComponent,
  emptyStateFor,
  isLoading,
  withCollapsible,
}: MainListProps) {
  const eligibleEmptyStateForValue = Object.keys(predefinedEmptyListContent);
  const emptyStateDefined = emptyStateFor && eligibleEmptyStateForValue.includes(emptyStateFor);

  if (isLoading) {
    return <MainListLoading columns={columns} />;
  }

  if (!isLoading && items && items.length === 0) {
    return emptyStateDefined ? (
      <div className="grid h-full justify-center items-center">
        <MainListEmpty predefinedFor={emptyStateFor} className={className} style={style} />
      </div>
    ) : null;
  }

  return (
    <ul className={cn(``, className)} style={style}>
      <MainListHeader columns={columns} items={items} withCollapsible={withCollapsible} />

      {items?.map(item => {
        const { id, name, to } = item;

        if (!id || !name || !to) {
          console.warn('Item is missing required properties:', item);
          return null;
        }

        return <MainListItem item={item} linkComponent={linkComponent} listColumns={columns} />;
      })}
    </ul>
  );
}

type MainListLoadingProps = {
  columns?: Column[];
  items?: Item[];
  className?: string;
  style?: React.CSSProperties;
  withCollapsible?: boolean;
};

function MainListLoading({ columns, items, className, style, withCollapsible }: MainListLoadingProps) {
  return (
    <ul className={cn(``, className)} style={style}>
      <MainListHeader columns={columns} items={items} />
      {Array.from({ length: 3 }).map((_, rowIdx) => (
        <li
          key={rowIdx}
          className="grid px-5 min-h-[2.75rem] items-center border-b-sm border-border1 hover:bg-surface3"
        >
          <div className="flex gap-2 items-center w-full ">
            <div className="flex gap-2 items-center w-full">
              <div
                className={cn('text-icon6 font-medium h-[0.75rem] rounded-md w-[50%] bg-surface5 animate-pulse', {
                  'w-[30%] opacity-80': rowIdx === 1,
                  'w-[40%] opacity-60': rowIdx === 2,
                })}
              ></div>
            </div>
            <div className="ml-auto flex gap-2 items-center">
              {columns && columns?.length > 0 && (
                <div className="ml-auto flex gap-2 items-center">
                  {columns?.map(column => (
                    <div
                      className={cn(
                        'text-icon6 font-medium h-[0.75rem] rounded-md ',
                        '[&>*]:flex [&>*]:items-center [&>*]:justify-start [&>*]:gap-1',
                      )}
                      style={{
                        minWidth: column.minWidth || DEFAULT_COLUMN_MIN_WIDTH,
                        maxWidth: column.maxWidth || DEFAULT_COLUMN_MAX_WIDTH,
                      }}
                    >
                      <div
                        className={cn(
                          'text-icon6 font-medium rounded-md w-[30%] h-[0.75rem] animate-pulse bg-surface5',
                          {
                            'w-[50%] opacity-80': rowIdx === 1,
                            'w-[40%] opacity-60': rowIdx === 2,
                          },
                        )}
                      ></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

type MainListHeaderProps = {
  columns?: Column[];
  items?: Item[];
  className?: string;
  style?: React.CSSProperties;
  withCollapsible?: boolean;
};

export function MainListHeader({ columns, items, className, style, withCollapsible }: MainListHeaderProps) {
  return (
    <li className="items-center h-table-header border-b-sm border-border1 flex text-icon3 text-[0.6875rem] font-normal uppercase px-5">
      <span>Name</span>
      {columns && columns?.length > 0 && (
        <div
          className={cn('ml-auto flex gap-2 items-center', {
            'pr-[2.1875rem]': withCollapsible,
          })}
        >
          {columns?.map(column => {
            return (
              <span
                className={cn(`flex text-left`)}
                style={{
                  minWidth: column.minWidth || DEFAULT_COLUMN_MIN_WIDTH,
                  maxWidth: column.maxWidth || DEFAULT_COLUMN_MAX_WIDTH,
                }}
              >
                {column.label}
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}

type MainListItemProps = {
  item: Item;
  linkComponent?: any;
  listColumns?: Column[];
};

export function MainListItem({ item, linkComponent, listColumns = [] }: MainListItemProps) {
  const LinkComponent = linkComponent || 'a';
  const [collapsed, setCollapsed] = useState(true);

  return (
    <li key={item.id} className="grid px-5 min-h-[2.75rem] items-center border-b-sm border-border1 hover:bg-surface3">
      <LinkComponent to={item.to} className="flex gap-2 items-center w-full ">
        <div className="flex gap-2 items-center group [&>svg]:w-[1.25rem] [&>svg]:h-[1.25rem]">
          {item.icon}
          <div className="py-1">
            <span className="text-icon6 font-medium text-[0.75rem]">{item.name}</span>
            {item.description && (
              <p className="truncate max-w-[80ch] text-icon3 text-[0.625rem] pb-1 ">{item.description}</p>
            )}
          </div>
        </div>
        <div className="ml-auto flex gap-2 items-center">
          {item.columns && item.columns?.length > 0 && (
            <div className="ml-auto flex gap-2 items-center">
              {item.columns?.map((itemColumn, idx) => (
                <div
                  className={cn(
                    'flex justify-start items-center gap-1 text-[0.6875rem] text-left',
                    '[&>*]:flex [&>*]:items-center [&>*]:justify-start [&>*]:gap-1',
                    '[&_svg]:w-[0.75rem] [&_svg]:h-[0.75rem] [&_svg]:text-icon3',
                  )}
                  style={{
                    minWidth: listColumns[idx].minWidth || DEFAULT_COLUMN_MIN_WIDTH,
                    maxWidth: listColumns[idx].maxWidth || DEFAULT_COLUMN_MAX_WIDTH,
                  }}
                >
                  {itemColumn}
                </div>
              ))}
            </div>
          )}
          {item.collapsible && (
            <button
              className="ml-2 text-icon3 hover:text-icon6 transition-colors"
              onClick={e => {
                e.preventDefault();
                setCollapsed(!collapsed);
              }}
            >
              <ChevronDownIcon
                className={cn('w-4 h-4 transition-transform', { 'rotate-180': !collapsed, 'rotate-0': collapsed })}
              />
            </button>
          )}
        </div>
      </LinkComponent>
      {item.collapsible && !collapsed && (
        <div
          className={cn({
            'ml-7 mb-2': item.icon,
          })}
        >
          {item.collapsible}
        </div>
      )}
    </li>
  );
}
