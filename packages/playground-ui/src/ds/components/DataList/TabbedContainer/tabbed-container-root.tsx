import { ListFilterIcon } from 'lucide-react';
import { Children, isValidElement, useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { DataList } from '../data-list';
import type { DataListFit } from '../data-list-root';
import './tabbed-container.css';
import { Combobox } from '@/ds/components/Combobox/combobox';
import type { ComboboxProps } from '@/ds/components/Combobox/combobox';
import { ListSearch } from '@/ds/components/ListSearch/list-search';
import type { ListSearchProps } from '@/ds/components/ListSearch/list-search';
import { TabContent } from '@/ds/components/Tabs/tabs-content';
import { TabsContext } from '@/ds/components/Tabs/tabs-context';
import { TabList } from '@/ds/components/Tabs/tabs-list';
import { Tabs } from '@/ds/components/Tabs/tabs-root';
import { Tab } from '@/ds/components/Tabs/tabs-tab';
import type { TabProps } from '@/ds/components/Tabs/tabs-tab';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip/tooltip';
import { cn } from '@/lib/utils';

export type TabbedContainerSearchProps = Pick<
  ListSearchProps,
  'debounceMs' | 'label' | 'onSearch' | 'placeholder' | 'value'
>;

export type TabbedContainerFilterProps = ComboboxProps & { 'aria-label': string };

type TabbedContainerItemProps = Pick<
  TabProps,
  'attention' | 'disabled' | 'disabledTooltip' | 'onClick' | 'onClose' | 'value'
> & {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  tabClassName?: string;
};

export type TabbedContainerPanelProps = TabbedContainerItemProps & {
  flush?: boolean;
};

export type TabbedContainerDataListProps = TabbedContainerItemProps & {
  columns: string;
  search?: TabbedContainerSearchProps;
  filter?: TabbedContainerFilterProps;
  fit?: DataListFit;
};

export const TabbedContainerPanel = ({ value, flush, children, className }: TabbedContainerPanelProps) => (
  <TabContent value={value} flush={flush} keepMounted className={cn('min-h-0 flex-1', className)}>
    {children}
  </TabContent>
);

export const TabbedContainerDataList = ({ value, columns, fit, children, className }: TabbedContainerDataListProps) => (
  <TabContent value={value} flush keepMounted className={className}>
    <DataList columns={columns} fit={fit} className="min-h-0">
      {children}
    </DataList>
  </TabContent>
);

export const DataListControls = ({ dataLists }: { dataLists: ReactElement<TabbedContainerDataListProps>[] }) => {
  const tabs = useContext(TabsContext);
  return dataLists.map(dataList => {
    const { filter, search, value } = dataList.props;
    if (!search && !filter) return null;
    const active = value === tabs?.value;
    const filterCount = filter ? (Array.isArray(filter.value) ? filter.value.length : filter.value ? 1 : 0) : 0;
    return (
      <div
        key={value}
        data-slot="tabbed-container-controls"
        data-active={active || undefined}
        aria-hidden={!active}
        inert={!active}
      >
        <div data-slot="tabbed-container-query">
          {search ? (
            <div data-slot="tabbed-container-search">
              <ListSearch {...search} size="md" variant="filled" shortcutDisabled={!active} />
            </div>
          ) : null}
          {filter ? (
            <TooltipProvider delay={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div data-slot="tabbed-container-filter" data-active={filterCount > 0 || undefined}>
                    <ListFilterIcon aria-hidden="true" />
                    {filterCount > 0 ? (
                      <span aria-hidden="true" data-slot="tabbed-container-filter-count">
                        {filterCount}
                      </span>
                    ) : null}
                    {filter.multiple ? (
                      <Combobox {...filter} clearLabel="Clear" size="md" variant="default" />
                    ) : (
                      <Combobox {...filter} size="md" variant="default" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {filterCount > 0 ? `Filter, ${filterCount} selected` : 'Filter'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </div>
    );
  });
};

export type TabbedContainerProps<T extends string> = {
  children: ReactNode;
  defaultTab: T;
  value?: T;
  onValueChange?: (value: T) => void;
  frame?: 'stroke' | 'inset';
  className?: string;
};

type TabbedContainerChildProps = TabbedContainerPanelProps | TabbedContainerDataListProps;

const isContainerChild = (child: ReactNode): child is ReactElement<TabbedContainerChildProps> =>
  isValidElement(child) && (child.type === TabbedContainerPanel || child.type === TabbedContainerDataList);

const isDataList = (
  child: ReactElement<TabbedContainerChildProps>,
): child is ReactElement<TabbedContainerDataListProps> => child.type === TabbedContainerDataList;

export function TabbedContainerRoot<T extends string>({
  children,
  defaultTab,
  value,
  onValueChange,
  frame = 'inset',
  className,
}: TabbedContainerProps<T>) {
  const panels = Children.toArray(children).filter(isContainerChild);
  const dataLists = panels.filter(isDataList);
  return (
    <Tabs
      defaultTab={defaultTab}
      value={value}
      onValueChange={onValueChange}
      appearance="contained"
      frame={frame}
      className={cn('tabbed-container min-h-0', className)}
    >
      <div data-slot="tabbed-container-rail">
        <div data-slot="tabbed-container-tabs">
          <TabList>
            {panels.map(panel => (
              <Tab
                key={panel.props.value}
                value={panel.props.value}
                disabled={panel.props.disabled}
                attention={panel.props.attention}
                disabledTooltip={panel.props.disabledTooltip}
                onClick={panel.props.onClick}
                onClose={panel.props.onClose}
                className={panel.props.tabClassName}
              >
                {panel.props.label}
              </Tab>
            ))}
          </TabList>
        </div>
        <DataListControls dataLists={dataLists} />
      </div>
      {panels}
    </Tabs>
  );
}
