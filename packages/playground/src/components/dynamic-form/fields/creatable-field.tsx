'use client';

import { Plus, X } from 'lucide-react';
import * as React from 'react';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from '../../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';

interface CreatableFieldProps {
  name: string;
  control: Control<any>;
  options?: { label: string; value: string }[];
  handleFieldChange?: (props: { key: string; value: string[] }) => void;
  placeholder?: string;
}

export function CreatableField({ name, control, options = [], handleFieldChange, placeholder }: CreatableFieldProps) {
  const [openPopover, setOpenPopover] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const selectedValues = field.value || [];

        const removeValue = (valueToRemove: string) => {
          const newValues = selectedValues.filter((v: string) => v !== valueToRemove);
          field.onChange(newValues);
          handleFieldChange?.({ key: name, value: newValues });
        };

        const addValue = (value: string) => {
          if (!value) return;
          const newValues = [...selectedValues, value];
          field.onChange(newValues);
          handleFieldChange?.({ key: name, value: newValues });
          setInputValue('');
          setOpenPopover(false);
        };

        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {selectedValues.map((value: string) => (
                <Badge key={value} className="flex items-center gap-1">
                  {value}
                  <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={() => removeValue(value)}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>

            <Popover open={openPopover} onOpenChange={setOpenPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Plus className="mr-2 h-4 w-4" />
                  {placeholder || 'Add item'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder="Enter value..." value={inputValue} onValueChange={setInputValue} />
                  <CommandList>
                    <CommandGroup>
                      {options
                        .filter(opt => !selectedValues.includes(opt.value))
                        .map(option => (
                          <CommandItem key={option.value} onSelect={() => addValue(option.value)}>
                            {option.label}
                          </CommandItem>
                        ))}
                      {inputValue && (
                        <CommandItem onSelect={() => addValue(inputValue)}>Create "{inputValue}"</CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        );
      }}
    />
  );
}
