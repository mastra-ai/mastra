import { ParsedField } from '@autoform/core';
import { AutoFormFieldProps } from '@autoform/react';
import { CustomAutoFormField } from './CustomAutoFormField';
import { useFormContext } from 'react-hook-form';

export const DiscriminatedUnionField: React.FC<AutoFormFieldProps> = ({ field, path }) => {
  const { watch } = useFormContext();
  const fullPath = path.join('.');
  const value = watch(fullPath);
  const allSchemas = field.schema?.flatMap((schema: ParsedField) => schema.schema || []) || [];
  const literalSchemas = allSchemas?.filter((schema: ParsedField) => schema.fieldConfig?.customData?.isLiteral) || [];
  const firstLiteralSchema = literalSchemas[0];
  const literalSchemaField = literalSchemas?.reduce(
    (acc, schema) => {
      const optionValues: [string, string][] = (schema.fieldConfig?.customData?.literalValues ?? []).map(
        (value: string) => [value, value],
      );
      acc.options?.push(...optionValues);
      return acc;
    },
    {
      key: firstLiteralSchema.key,
      required: firstLiteralSchema.required,
      type: 'select',
      default: firstLiteralSchema.default,
      description: firstLiteralSchema.description,
      options: [] as [string, string][],
      fieldConfig: firstLiteralSchema.fieldConfig,
    },
  );

  const otherFieldSchemas = field.schema?.reduce(
    (acc, schema) => {
      const literalSchema = schema.schema?.find((schema: ParsedField) => schema.fieldConfig?.customData?.isLiteral);
      const literalSchemaValue = literalSchema?.fieldConfig?.customData?.literalValues?.[0];
      const otherSchemas = schema.schema?.filter((schema: ParsedField) => schema.key !== literalSchema?.key) ?? [];
      if (literalSchemaValue) {
        acc[literalSchemaValue] = otherSchemas;
      }
      return acc;
    },
    {} as Record<string, ParsedField[]>,
  );

  const andFieldSchemas = field.schema?.filter(schema => {
    const literalSchema = schema.schema?.find((schema: ParsedField) => schema.fieldConfig?.customData?.isLiteral);
    return !literalSchema;
  });

  const literalFieldValue = value?.[literalSchemaField.key];

  return (
    <div key={field.key}>
      <CustomAutoFormField
        key={`${fullPath}.${literalSchemaField.key}`}
        field={literalSchemaField}
        path={[...path, literalSchemaField.key]}
      />
      {literalFieldValue &&
        otherFieldSchemas?.[literalFieldValue] &&
        otherFieldSchemas[literalFieldValue].map((schema: ParsedField) => (
          <CustomAutoFormField key={`${fullPath}.${schema.key}`} field={schema} path={[...path, schema.key]} />
        ))}
      {andFieldSchemas &&
        andFieldSchemas.map((schema: ParsedField) => (
          <CustomAutoFormField key={`${fullPath}.${schema.key}`} field={schema} path={[...path, schema.key]} />
        ))}
    </div>
  );
};
