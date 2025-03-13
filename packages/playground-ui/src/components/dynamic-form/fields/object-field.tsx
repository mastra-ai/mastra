import { XIcon } from 'lucide-react';
import * as React from 'react';
import { useFieldArray } from 'react-hook-form';
import type { ZodSchema } from 'zod';
import { ZodArray } from 'zod';

import { toTitleCase } from '../../../lib/string';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Text } from '../../ui/text';
import { getFormConfigTypesFromSchemaDef } from '../schema';

interface ObjectFieldProps {
  renderDynamicForm: (props: {
    schema: ZodSchema;
    handleFieldChange: (field: string, value: any) => void;
    control: any;
    formValues: Record<string, any>;
    errors: Record<string, any>;
    parentField: string;
    action?: any;
    isOptional?: boolean;
    depth?: number;
  }) => React.ReactNode;
  schema: ZodSchema;
  handleFieldChange: (field: string, value: any) => void;
  control: any;
  formValues: Record<string, any>;
  errors: Record<string, any>;
  parentField: string;
  action?: any;
  isArray?: boolean;
  isOptional?: boolean;
  depth?: number;
}

export function ObjectField({
  renderDynamicForm,
  schema,
  handleFieldChange,
  control,
  formValues,
  errors,
  parentField,
  action,
  isArray = false,
  isOptional = false,
  depth,
}: ObjectFieldProps) {
  const fieldConfig = getFormConfigTypesFromSchemaDef({ schema, isOptional });

  const { fields, append, remove } = useFieldArray({
    control,
    name: parentField,
  });

  function handleAddForm() {
    append({});
  }

  return (
    <div>
      <Label className="flex gap-0.5 capitalize mb-2" htmlFor={parentField} aria-required={!fieldConfig.isOptional}>
        {!fieldConfig?.isOptional && <span className="text-red-500">*</span>}
        <Text variant="secondary" className="text-mastra-el-3" size="xs">
          {toTitleCase(parentField)}
        </Text>
      </Label>
      {isArray ? (
        <>
          <div className="flex flex-col gap-4">
            {fields.map((field, index) => (
              <div key={field.id} className="ring-1 ring-white/10 p-2 rounded-md relative">
                <Button
                  type="button"
                  variant={'ghost'}
                  size={'icon'}
                  onClick={() => remove(index)}
                  className="absolute top-0 right-0"
                >
                  <XIcon className="text-icon h-3.5 w-3.5" />
                </Button>
                {renderDynamicForm({
                  schema: schema instanceof ZodArray ? schema.element : schema,

                  handleFieldChange,
                  control,
                  formValues,
                  errors,
                  parentField: `${parentField}.${index}`,
                  action,
                  isOptional,
                  depth,
                })}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <Button type="button" variant={'outline'} className="w-full text-xs h-9" onClick={handleAddForm}>
              Add {toTitleCase(parentField.split('.').pop() || '')}
            </Button>
          </div>
        </>
      ) : (
        <div className="ring-1 ring-white/10 p-2 rounded-md relative">
          {renderDynamicForm({
            schema,

            handleFieldChange,
            control,
            formValues,
            errors,
            parentField,
            action,
            isOptional,
            depth,
          })}
        </div>
      )}
    </div>
  );
}
