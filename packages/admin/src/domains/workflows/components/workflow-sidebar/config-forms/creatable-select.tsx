import { useState } from 'react';
import { Control, UseFormSetValue, useFieldArray } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import IconButton from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { lodashTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

type FieldArrayProps = { id: string; value: string };

interface CreatableSelect {
  control: Control<any>;
  name: string;
  setValue: UseFormSetValue<any>;
}

const CreatableSelect = ({ control, name, setValue }: CreatableSelect) => {
  const [itemValue, setItemValue] = useState('');
  const [openPopover, setOpenPopover] = useState(false);
  const [fieldIndex, setFieldIndex] = useState<number | null>(null);
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const removeItem = (index: number) => {
    remove(index);
  };

  const onSelectItemToEdit = (item: string, itemIndex: number) => {
    setFieldIndex(itemIndex);
    setItemValue(item);
  };

  const onSaveEnteredItem = (value: string) => {
    if (fieldIndex) {
      const key = `${name}.${fieldIndex}.value`;
      setValue(key, value);
    } else {
      append({ value }, { shouldFocus: false });
    }
    setFieldIndex(null);
    setItemValue('');
  };

  return (
    <div className="flex flex-col gap-2">
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-wrap gap-2">
          {(fields as FieldArrayProps[])?.map((field, index) => (
            <Tooltip key={field.id}>
              <TooltipTrigger onClick={e => e.stopPropagation()}>
                <Badge
                  key={field.id}
                  variant="secondary"
                  onClick={() => onSelectItemToEdit(field.value, index)}
                  className="flex h-7 max-w-[120px] cursor-pointer items-center justify-between overflow-hidden rounded-sm border-[#3e3e3e] bg-transparent p-0 pr-1 text-xs"
                >
                  <p className="relative truncate px-2 text-xs font-normal">{field.value}</p>

                  <IconButton
                    icon="cancel"
                    aria-label={`remove ${name?.toLocaleLowerCase()}`}
                    className="h-2 px-0 py-0"
                    iconClassname="h-3 w-3 text-text-dim"
                    onClick={() => removeItem(index)}
                  />
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-dialog-bg rounded-md p-1 px-3">{field.value}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      <Popover open={openPopover} onOpenChange={setOpenPopover}>
        <PopoverTrigger asChild>
          <div className="flex cursor-pointer items-center gap-2">
            <Icon name="plus-icon" className="text-accent-2 text-xs" />
            <p className="text-accent-2 flex items-center text-xs">{`Add ${lodashTitleCase(name)}`}</p>
          </div>
        </PopoverTrigger>
        <PopoverContent
          onKeyDown={e => {
            if (e.key == 'Escape') {
              e.stopPropagation();
              setOpenPopover(false);
              setItemValue('');
              setFieldIndex(null);
            }
            if (e.key == 'Enter' && !(e.ctrlKey || e.metaKey)) {
              e.stopPropagation();
              if (itemValue) {
                onSaveEnteredItem(itemValue);
              }
            }
          }}
          className={cn(
            'popover-background popover-backdrop-filter popover-shadow popover-border w-fit max-w-[300px] p-0',
          )}
          align="start"
        >
          <Input
            placeholder={''}
            value={itemValue}
            onChange={({ target }) => setItemValue(target.value)}
            className="w-[266px]"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CreatableSelect;
