'use client';

import { useFieldArray } from 'react-hook-form';
import { ZodArray, ZodSchema } from 'zod';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';

import { lodashTitleCase } from '@/lib/string';

import { Icon } from '@/app/components/icon';
import { getFormConfigTypesFromSchemaDef } from '@/domains/workflows/schema';

function ObjectArray({
  renderDynamicForm,
  schema,
  block,
  handleFieldChange,
  control,
  formValues,
  errors,
  parentField,
}: {
  renderDynamicForm: any;
  schema: ZodSchema;
  block: any;
  handleFieldChange: any;
  control: any;
  formValues: any;
  errors: any;
  parentField: any;
}) {
  const fieldConfig = getFormConfigTypesFromSchemaDef({ schema });

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
        <Text variant="secondary" className="text-kpl-el-3" size="xs">
          {lodashTitleCase(`${parentField}`)}
        </Text>
      </Label>
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
              <Icon name="cancel" className="text-icon h-3.5 w-3.5" />
            </Button>
            {renderDynamicForm({
              schema: schema instanceof ZodArray ? schema.element : schema,
              block,
              handleFieldChange,
              control,
              formValues,
              errors,
              parentField: `${parentField}.${index}`,
            })}
          </div>
        ))}
        <Button type="button" variant={'outline'} className="w-full text-xs h-9" onClick={handleAddForm}>
          Add {lodashTitleCase(parentField.split('.').pop() || '')}
        </Button>
      </div>
    </div>
  );
}

export default ObjectArray;
