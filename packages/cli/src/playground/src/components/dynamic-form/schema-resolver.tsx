import { Control, FieldErrors } from 'react-hook-form';
import { z } from 'zod';

import { getDefaultFieldMap } from './default-field-map';
import { ArrayField, ObjectField, UnionField } from './fields';
import { schemaToFormFieldRenderer } from './schema';

interface ResolveSchemaProps {
  schema: z.ZodSchema;
  parentField: string;
  control: Control<any>;
  formValues: any;
  errors: FieldErrors;
  handleFieldChange: (props: { key: string | number | symbol; value: any }) => void;
  isArray?: boolean;
  isOptional?: boolean;
  isNullable?: boolean;
}

function adaptHandleFieldChange(
  handler: (props: { key: string | number | symbol; value: any }) => void,
): (field: string, value: any) => void {
  return (field, value) => handler({ key: field, value });
}

export function resolveSchema({
  schema,
  parentField,
  control,
  formValues,
  errors,
  handleFieldChange,
  isOptional = false,
  isNullable = false,
  depth = 0,
}: ResolveSchemaProps & { depth?: number }) {
  if (depth > 10) {
    console.warn('Maximum schema resolution depth reached. Possible circular reference.');
    return null;
  }

  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape).map(([field, fieldSchema]) => {
      const currentField = parentField ? `${parentField}.${field}` : field;
      return resolveSchemaComponent({
        schema: fieldSchema as z.ZodSchema,
        parentField: currentField,
        control,
        formValues,
        errors,
        handleFieldChange,
        isOptional,
        isNullable,
      });
    });
  }

  return resolveSchemaComponent({
    schema,
    parentField,
    control,
    formValues,
    errors,
    handleFieldChange,
    isOptional,
    isNullable,
  });
}

function resolveSchemaComponent({
  schema,
  parentField,
  control,
  formValues,
  errors,
  handleFieldChange,
  isOptional = false,
  isNullable = false,
}: {
  schema: z.ZodSchema;
  parentField: string;
  control: Control<any>;
  formValues: any;
  errors: FieldErrors;
  handleFieldChange: (props: { key: string | number | symbol; value: any }) => void;
  isOptional?: boolean;
  isNullable?: boolean;
}) {
  if (schema instanceof z.ZodDefault) return null;

  if (schema instanceof z.ZodOptional) {
    return resolveSchemaComponent({
      schema: schema._def.innerType,
      parentField,
      control,
      formValues,
      errors,
      handleFieldChange,
      isOptional: true,
      isNullable,
    });
  }

  if (schema instanceof z.ZodObject) {
    return (
      <div key={parentField} className="flex flex-col gap-8 py-8 w-full">
        <ObjectField
          schema={schema}
          control={control}
          parentField={parentField}
          handleFieldChange={(field, value) => handleFieldChange({ key: field, value })}
          formValues={formValues}
          errors={errors}
          isOptional={isOptional}
          renderDynamicForm={props => resolveSchema({ ...props, handleFieldChange })}
        />
      </div>
    );
  }

  if (schema instanceof z.ZodUnion) {
    if (schema.options.some((s: z.ZodType) => s instanceof z.ZodNull)) {
      const nonNullSchema = schema.options.find((s: z.ZodType) => !(s instanceof z.ZodNull));
      return resolveSchemaComponent({
        schema: z.optional(nonNullSchema!),
        parentField,
        control,
        formValues,
        errors,
        handleFieldChange,
        isNullable: true,
      });
    }

    return (
      <UnionField
        schema={schema}
        control={control}
        parentField={parentField}
        handleFieldChange={adaptHandleFieldChange(handleFieldChange)}
        formValues={formValues}
        errors={errors}
        isOptional={isOptional}
        isNullable={isNullable}
        renderDynamicForm={props =>
          resolveSchema({
            ...props,
            handleFieldChange: props => handleFieldChange(props),
          })
        }
      />
    );
  }

  if (schema instanceof z.ZodArray) {
    return (
      <div key={parentField} className="flex w-full flex-col gap-8 py-8">
        <ArrayField
          control={control}
          name={parentField}
          renderField={props => {
            const fieldSchema = schema.element;
            const currentField = `${parentField}[${props.index}]`;
            return resolveSchemaComponent({
              schema: fieldSchema,
              parentField: currentField,
              control,
              formValues,
              errors,
              handleFieldChange,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div key={parentField} className="w-full">
      {schemaToFormFieldRenderer({
        schema,
        schemaField: parentField,
        control,
        values: formValues,
        errors,
        renderFieldMap: getDefaultFieldMap(),
        onFieldChange: handleFieldChange,
      })}
    </div>
  );
}
