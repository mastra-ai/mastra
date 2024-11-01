import type { ActionVariables, SchemaFieldOptions } from '@mastra/core';
import React from 'react';
import { Control } from 'react-hook-form';
import { z, ZodArray, ZodBoolean, ZodDate, ZodEnum, ZodLiteral, ZodNumber, ZodSchema, ZodString } from 'zod';

import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';

import { flattenObject, getPath } from '../../lib/object';
import { lodashTitleCase } from '../../lib/string';

export enum FormConfigType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  ENUM = 'ENUM',
  ARRAY = 'ARRAY',
  BOOLEAN = 'BOOLEAN',
  RECORD = 'RECORD',
}

type FormConfig = {
  type: FormConfigType;
  options?: { label: string; value: string }[];
  isOptional?: boolean;
  hasEffects?: boolean;
  innerSchema?: ZodSchema;
};

export function getFormConfigTypesFromSchemaDef({
  schema,
  isOptional = false,
}: {
  schema: ZodSchema<any>;
  isOptional?: boolean;
}): FormConfig {
  if (schema instanceof ZodString) {
    // if it's a datetime -- accounts for date weirdness during zod schemma serialization to JSON
    if (schema instanceof ZodString && schema._def.checks.some((check: any) => check.kind === 'datetime')) {
      return { type: FormConfigType.DATE, isOptional };
    }
    return { type: FormConfigType.STRING, isOptional };
  } else if (schema instanceof ZodNumber) {
    return { type: FormConfigType.NUMBER, isOptional };
  } else if (schema instanceof ZodBoolean) {
    return { type: FormConfigType.BOOLEAN, isOptional };
  } else if (schema instanceof ZodDate) {
    return { type: FormConfigType.DATE, isOptional };
  } else if (schema instanceof ZodLiteral) {
    return {
      type: FormConfigType.ENUM,
      isOptional,
      options: [{ label: schema.value, value: schema.value }],
    };
  } else if (schema instanceof ZodEnum) {
    return {
      type: FormConfigType.ENUM,
      isOptional,
      options: schema.options.map((v: string) => ({ label: v, value: v })),
    };
  } else if (schema instanceof ZodArray) {
    return {
      type: FormConfigType.ARRAY,
      isOptional,
      options:
        schema.element instanceof ZodEnum ? schema.element.options.map((v: string) => ({ label: v, value: v })) : [],
    };
  } else if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return getFormConfigTypesFromSchemaDef({ schema: schema._def.innerType, isOptional: true });
  } else if (schema instanceof z.ZodEffects) {
    return getFormConfigTypesFromSchemaDef({ schema: schema._def.schema, isOptional });
  } else if (schema instanceof z.ZodRecord) {
    return {
      type: FormConfigType.RECORD,
      isOptional,
      innerSchema: schema._def.valueType,
    };
  } else {
    return { type: FormConfigType.STRING, isOptional }; // Handle other types as needed
  }
}

export type FieldProps = {
  name: string;
  options?: { label: string; value: string }[];
  control: Control<any>;
  innerSchema?: ZodSchema;
  variables?: Record<string, ActionVariables | undefined>;
  isNullable?: boolean;
  handleFieldChange: ({
    key,
    value,
    variables,
  }: {
    key: keyof z.infer<any>;
    value: any;
    variables?: ActionVariables;
  }) => void;
};

export function schemaToFormFieldRenderer<T extends ZodSchema>({
  schema,
  errors,
  renderFieldMap,
  schemaField,
  renderLabel,
  control,
  variables,
  onFieldChange,
  schemaOptions,
  values,
  isOptional = false,
  isNullable = false,
}: {
  schema: ZodSchema<any>;
  errors: any;
  renderFieldMap?: Record<FormConfigType, (props: FieldProps) => React.ReactNode>;
  schemaField: string;
  control: any;
  onFieldChange: (props: { key: keyof z.infer<T>; value: any; variables?: ActionVariables }) => void;
  variables?: Record<string, ActionVariables | undefined>;
  schemaOptions?: SchemaFieldOptions;
  renderLabel?: ({ isOptional, schemaField }: { isOptional: boolean; schemaField: string }) => React.ReactNode;
  values: Record<keyof z.infer<T>, unknown>;
  isOptional?: boolean;
  isNullable?: boolean;
}): any {
  const fieldConfig = getFormConfigTypesFromSchemaDef({ schema, isOptional });

  const parentFieldValue = schemaOptions?.parentField ? getPath(values, schemaOptions?.parentField) : '';

  if (schemaOptions?.parentField && !parentFieldValue) {
    return null;
  }

  if (!renderFieldMap) return;

  const flattenedErrors = flattenObject(errors, ['message', 'type']);

  const fieldOptions = schemaOptions?.parentField
    ? schemaOptions?.options?.[parentFieldValue as string]
    : (schemaOptions?.options as { label: string; value: string }[]) || fieldConfig.options;

  return (
    <div key={schemaField} className="flex flex-col gap-1 mt-3">
      {renderLabel ? (
        renderLabel({ isOptional: Boolean(fieldConfig.isOptional), schemaField })
      ) : (
        <Label className="flex gap-0.5 capitalize" htmlFor={schemaField} aria-required={!fieldConfig.isOptional}>
          {!fieldConfig?.isOptional && <span className="text-red-500">*</span>}
          <Text variant="secondary" className="text-mastra-el-3" size="xs">
            {lodashTitleCase(schemaField.split('.').pop() || '')}
          </Text>
        </Label>
      )}
      {renderFieldMap[fieldConfig.type]({
        name: schemaField,
        options: fieldOptions,
        control,
        variables,
        innerSchema: fieldConfig.innerSchema,
        handleFieldChange: onFieldChange,
        isNullable,
      })}
      {flattenedErrors?.[schemaField] ? (
        <Text size="xs" className="text-red-500">
          {(flattenedErrors[schemaField] as { message: string })?.message}
        </Text>
      ) : null}
    </div>
  );
}

export function resolveSerializedZodOutput(obj: any) {
  return Function('z', `"use strict";return (${obj});`)(z);
}
