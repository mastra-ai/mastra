'use client';

import { Plus, X } from 'lucide-react';
import * as React from 'react';
import type { Control } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';

import { Button } from '../../ui/button';

interface ArrayFieldProps {
  name: string;
  control: Control<any>;
  renderField: (props: { fieldName: string; index: number }) => React.ReactNode;
  handleFieldChange?: (props: { key: string; value: any[] }) => void;
}

export function ArrayField({ name, control, renderField }: ArrayFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  return (
    <div className="space-y-2 w-full">
      {fields.map((field, index) => (
        <div key={field.id} className="relative w-full flex items-center gap-2">
          {renderField({ fieldName: `${name}.${index}`, index })}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute -right-2 -top-2"
            onClick={() => remove(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => append({})}>
        <Plus className="mr-2 h-4 w-4" />
        Add Item
      </Button>
    </div>
  );
}
