'use client';

import { Plus, X } from 'lucide-react';
import * as React from 'react';
import type { Control } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import type { ZodSchema } from 'zod';

import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

interface RecordFieldProps {
  name: string;
  control: Control<any>;
  innerSchema?: ZodSchema;
  renderField: (props: { fieldName: string; index: number }) => React.ReactNode;
  handleFieldChange?: (props: { key: string; value: Record<string, any> }) => void;
}

export function RecordField({ name, control, renderField }: RecordFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="relative space-y-2 rounded-lg border p-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={() => remove(index)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="space-y-2">
            <Input placeholder="Key" {...control.register(`${name}.${index}.key`)} />
            {renderField({ fieldName: `${name}.${index}.value`, index })}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => append({ key: '', value: '' })}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Key-Value Pair
      </Button>
    </div>
  );
}
