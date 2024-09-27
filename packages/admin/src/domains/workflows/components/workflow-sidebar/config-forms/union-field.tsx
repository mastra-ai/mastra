'use client';

import { ZodUnion } from 'zod';

import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';

import { lodashTitleCase } from '@/lib/string';

import { getFormConfigTypesFromSchemaDef } from '@/domains/workflows/schema';

function UnionComponent({
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
  schema: ZodUnion<any>;
  block: any;
  handleFieldChange: any;
  control: any;
  formValues: any;
  errors: any;
  parentField: any;
}) {
  const fieldConfig = getFormConfigTypesFromSchemaDef({ schema });

  if (schema instanceof ZodUnion) {
    const schemaOptions = schema.options;
    return (
      <div>
        <Label className="flex gap-0.5 capitalize mb-2" htmlFor={parentField} aria-required={!fieldConfig.isOptional}>
          {!fieldConfig?.isOptional && <span className="text-red-500">*</span>}
          <Text variant="secondary" className="text-kpl-el-3" size="xs">
            {lodashTitleCase(`${parentField}`)}
          </Text>
        </Label>
          <div className="flex flex-col gap-4">
            {schemaOptions.map((so: any, index: any) => (
              <>
              {index >= 1 && <Text variant="secondary" className="text-kpl-el-3 text-center" size="xs">
                or
              </Text>}
            <div key={index} className="ring-1 ring-white/10 p-2 rounded-md relative">
              {renderDynamicForm({
                schema: so,
                block,
                handleFieldChange,
                control,
                formValues,
                errors,
                parentField: `${parentField}`,
              })}
              </div>
              </>
            ))}
          </div>
      </div>
    );

  }
}

export default UnionComponent;
