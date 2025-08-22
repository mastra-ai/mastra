'use client';

import React, { useMemo, useState } from 'react';

import { capitalizeFirstLetter } from '../../lib/string';
import { cn } from '../../lib/utils';

import { Button } from './button';
import { Checkbox } from './checkbox';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from './command';
import { Text } from './text';

export type MultiSelectShape = Record<string, unknown>;

export type MultiSelectProps<T extends MultiSelectShape> = {
  /**
   * The placeholder text for the search input
   */
  placeholder: string;
  /**
   * The data to display in the dropdown
   */
  data: T[];
  /**
   * The currently selected values
   */
  selectedValues: T[];
  /**
   * A render prop for the icon
   */
  iconRenderProp?: (item: T) => React.ReactNode;
  /**
   * Dispatch to set selected values
   */
  setSelectedValues: (newValues: T[]) => void;
  /**
   * Callback on item selection
   */
  onSelectItem?: (value: T) => void;
  /**
   * Callback on item deselection
   */
  onDeselectItem?: (value: T) => void;
  /**
   * A message to show when an empty data array is passed
   */
  emptyMessage?: string;
  /**
   * The key to use for the name of the item
   */
  nameKey?: keyof T;
  /**
   * The key to use for the id of the item
   */
  idKey?: keyof T;
  /**
   * the key to group the items in a multiselect
   */
  groupKey?: keyof T;
  /**
   * If true, group options by certain criteria
   */
  groupOptions?: boolean;
  /**
   * If true, only one item can be selected at a time
   */
  isSingleSelect?: boolean;
  /**
   * If true, show the search input
   */
  withSearch?: boolean;
  /**
   * If true, show the checkbox
   */
  withCheckbox?: boolean;
  /**
   * If true, consumer can deselect all items
   */
  asRadio?: boolean;
  /**
   * If true, show the add new button
   */
  withAddNewButton?: boolean;
  /**
   * The title for add new button
   */
  addNewButtonTitle?: string;
  /**
   * If true, show the add new button when the searched item doesn't exist in the list
   */
  withAddNewFromSearchValueButton?: boolean;
  /**
   * Function to trigger add new item e.g to pop a dialog/popup
   */
  addNewButtonAction?: () => void;
  /**
   * Function to add new item and return the added item, to be added to selected values or used as selected value
   */
  addNewFromSearchValueButtonAction?: (item: string) => Promise<T>;
  /**
   * Function to search for value from a larger database, which then populates the options list
   */
  onSearch?: (item: string) => void;
  /**
   * If true, shows searching text instead of No options text
   */
  isSearching?: boolean;
};

export function MultiSelect<T extends MultiSelectShape>({
  placeholder,
  data = [],
  selectedValues = [],
  setSelectedValues,
  iconRenderProp,
  onSelectItem,
  onDeselectItem,
  isSingleSelect,
  emptyMessage,
  nameKey,
  idKey,
  withSearch = true,
  withCheckbox = true,
  asRadio,
  addNewButtonTitle,
  withAddNewButton,
  withAddNewFromSearchValueButton,
  addNewButtonAction,
  addNewFromSearchValueButtonAction,
  groupKey,
  groupOptions,
  onSearch,
  isSearching,
}: MultiSelectProps<T>) {
  if (!data) {
    return null;
  }
  return (
    <Command className="h-fit" shouldFilter={false}>
      {!data.length ? (
        <EmptyBody emptyMessage={emptyMessage} />
      ) : (
        <SelectBody
          placeholder={placeholder}
          data={data}
          selectedValues={selectedValues}
          setSelectedValues={setSelectedValues}
          iconRenderProp={iconRenderProp}
          onSelectItem={onSelectItem}
          onDeselectItem={onDeselectItem}
          isSingleSelect={isSingleSelect}
          nameKey={nameKey}
          idKey={idKey}
          withSearch={withSearch}
          withCheckbox={withCheckbox}
          asRadio={asRadio}
          addNewButtonTitle={addNewButtonTitle}
          withAddNewButton={withAddNewButton}
          withAddNewFromSearchValueButton={withAddNewFromSearchValueButton}
          addNewButtonAction={addNewButtonAction}
          addNewFromSearchValueButtonAction={addNewFromSearchValueButtonAction}
          groupKey={groupKey}
          groupOptions={groupOptions}
          onSearch={onSearch}
          isSearching={isSearching}
        />
      )}
    </Command>
  );
}

function EmptyBody({ emptyMessage }: { emptyMessage?: string }) {
  return (
    <div className="px-2 py-6 text-center text-sm">
      <Text>{emptyMessage || 'No data found.'}</Text>
    </div>
  );
}

function SelectBody<T extends MultiSelectShape>({
  placeholder,
  data,
  selectedValues,
  setSelectedValues,
  iconRenderProp,
  onSelectItem,
  onDeselectItem,
  isSingleSelect,
  withSearch,
  withCheckbox,
  asRadio,
  nameKey = 'name' as keyof T,
  idKey = 'id' as keyof T,
  addNewButtonTitle,
  withAddNewButton,
  withAddNewFromSearchValueButton,
  addNewButtonAction,
  addNewFromSearchValueButtonAction,
  groupKey,
  groupOptions,
  onSearch,
  isSearching,
}: MultiSelectProps<T>) {
  const [searchValue, setSearchValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  function deselectItem(item: T) {
    if (asRadio && selectedValues.length === 1) return; // A radio must have a selected value

    if (isSingleSelect) {
      setSelectedValues([]);
    } else {
      setSelectedValues(selectedValues.filter(value => value[idKey] !== item[idKey]));
    }
    onDeselectItem?.(item);
  }

  function selectItem(item: T) {
    if (isSingleSelect) {
      setSelectedValues([item]);
    } else {
      setSelectedValues([...selectedValues, item]);
    }
    onSelectItem?.(item);
  }

  async function handleAddNewItem() {
    if (addNewButtonAction) {
      addNewButtonAction();
      return;
    }

    if (addNewFromSearchValueButtonAction) {
      setIsAdding(true);
      const item = await addNewFromSearchValueButtonAction(searchValue);
      setIsAdding(false);
      setSearchValue('');
      selectItem(item);
    }
  }

  const options = useMemo(
    () =>
      searchValue
        ? data.filter(item =>
            (item[nameKey] as string)?.toLocaleLowerCase()?.includes(searchValue?.toLocaleLowerCase()),
          )
        : data,
    [data, searchValue, nameKey],
  );

  const showButton = withAddNewButton || (withAddNewFromSearchValueButton && !!searchValue && !options.length);

  const groupOptionsByKey = (options: T[], groupKey: keyof T) => {
    //plain array, that i want group based on object of a key in that array
    //{ google: [options], slack: [options] }
    return options.reduce((acc: Record<string, any>, curr) => {
      const groupedKey = curr[groupKey] as string;
      return { ...acc, [groupedKey]: [...(acc[groupedKey] || []), curr] };
    }, {});
  };
  const groupedData = groupOptions && groupKey ? groupOptionsByKey(options, groupKey) : {};

  return (
    <>
      {withSearch && (
        <CommandInput
          placeholder={placeholder}
          value={searchValue}
          onValueChange={val => {
            setSearchValue(val);
            onSearch?.(val);
          }}
          className="text-xs"
          onKeyDown={e => {
            if (e.key == 'Enter' && !(e.ctrlKey || e.metaKey)) {
              e.stopPropagation();
              if (withAddNewFromSearchValueButton && !!searchValue && !options.length) {
                handleAddNewItem();
              }
            }
          }}
        />
      )}
      <CommandList>
        {options.length ? (
          groupKey ? (
            Object.keys(groupedData).map(key => {
              return (
                <div key={key} className="border-b border-mastra-border-1 p-1">
                  <p className="text-white px-3 py-1 text-xs capitalize bg-[#5f5fc5] rounded w-fit my-1 ml-1">
                    {capitalizeFirstLetter(key)}
                  </p>
                  <CommandGroup>
                    {groupedData[key].map((item: T, idx: number) => {
                      const isSelected = selectedValues.length
                        ? isSingleSelect
                          ? selectedValues[0][idKey] === item[idKey]
                          : !!selectedValues.find(value => value[idKey] === item[idKey])
                        : false;
                      return (
                        <CommandItem
                          className={cn({ 'bg-white/5': isSelected })}
                          value={item[idKey] as string}
                          key={`${item[idKey] as string}-${idx}`}
                          aria-selected={isSelected}
                          aria-disabled={item?.isDisabled ? 'true' : 'false'}
                          data-disabled={item?.isDisabled ? 'true' : 'false'}
                          onSelect={() => {
                            if (item?.isDisabled) {
                              return;
                            }
                            if (isSelected) {
                              deselectItem(item);
                            } else {
                              selectItem(item);
                            }
                          }}
                          disabled={item?.isDisabled as boolean}
                        >
                          <Checkbox checked={isSelected} className={cn('mr-2', { 'sr-only': !withCheckbox })} />
                          {iconRenderProp ? <span className="mr-2">{iconRenderProp(item)}</span> : null}
                          <span className="break-words hyphens-auto">{item[nameKey] as string}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              );
            })
          ) : (
            <CommandGroup>
              {options.map((item, idx) => {
                const isSelected = selectedValues.length
                  ? isSingleSelect
                    ? selectedValues[0][idKey] === item[idKey]
                    : !!selectedValues.find(value => value[idKey] === item[idKey])
                  : false;

                return (
                  <CommandItem
                    className={cn({ 'bg-white/5': isSelected })}
                    value={item[idKey] as string}
                    key={`${item[idKey] as string}-${idx}`}
                    aria-selected={isSelected}
                    aria-disabled={item?.isDisabled ? 'true' : 'false'}
                    data-disabled={item?.isDisabled ? 'true' : 'false'}
                    onSelect={() => {
                      if (item?.isDisabled) {
                        return;
                      }
                      if (isSelected) {
                        deselectItem(item);
                      } else {
                        selectItem(item);
                      }
                    }}
                    disabled={item?.isDisabled as boolean}
                  >
                    <Checkbox checked={isSelected} className={cn('mr-2', { 'sr-only': !withCheckbox })} />
                    {iconRenderProp ? <span className="mr-2">{iconRenderProp(item)}</span> : null}
                    <span className="break-words hyphens-auto">{item[nameKey] as string}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )
        ) : (
          <p className="text-mastra-el-4 py-6 text-center text-sm">
            {isSearching ? 'Searching...' : 'No results found'}
          </p>
        )}

        {selectedValues.length > 0 && !isSingleSelect && !searchValue && (
          <>
            <CommandSeparator className="bg-white/10" />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setSelectedValues([]);
                }}
                className="justify-center text-center"
              >
                Clear selection
              </CommandItem>
            </CommandGroup>
          </>
        )}
        {showButton ? (
          <>
            <CommandSeparator className="bg-white/10" />
            <CommandGroup>
              <Button
                className="h-[28px] w-full font-semibold"
                size="sm"
                type="submit"
                variant="default"
                onClick={handleAddNewItem}
                disabled={isAdding}
              >
                {isAdding ? 'Adding...' : addNewButtonTitle || `Add ${searchValue}`}
              </Button>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </>
  );
}
