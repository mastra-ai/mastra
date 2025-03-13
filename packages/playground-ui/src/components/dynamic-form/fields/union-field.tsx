'use client';

import * as React from 'react';
import { ZodUnion } from 'zod';

import { toTitleCase } from '../../../lib/string';
import { Label } from '../../ui/label';
import { Text } from '../../ui/text';
import { getFormConfigTypesFromSchemaDef } from '../schema';

interface UnionComponentProps {
  renderDynamicForm: (props: {
    schema: ZodUnion<any>;
    handleFieldChange: (field: string, value: any) => void;
    control: any;
    formValues: Record<string, any>;
    errors: Record<string, any>;
    parentField: string;
    action?: any;
    isOptional?: boolean;
    isNullable?: boolean;
    depth?: number;
  }) => React.ReactNode;
  schema: ZodUnion<any>;

  handleFieldChange: (field: string, value: any) => void;
  control: any;
  formValues: Record<string, any>;
  errors: Record<string, any>;
  parentField: string;
  action?: any;
  isOptional?: boolean;
  isNullable?: boolean;
  depth?: number;
}

export function UnionField({
  renderDynamicForm,
  schema,
  handleFieldChange,
  control,
  formValues,
  errors,
  parentField,
  action,
  isOptional = false,
  isNullable = false,
  depth,
}: UnionComponentProps) {
  const fieldConfig = getFormConfigTypesFromSchemaDef({ schema, isOptional });

  if (schema instanceof ZodUnion) {
    const schemaOptions = schema.options;
    return (
      <div>
        <Label className="flex gap-0.5 capitalize mb-2" htmlFor={parentField} aria-required={!fieldConfig.isOptional}>
          {!fieldConfig?.isOptional && <span className="text-red-500">*</span>}
          <Text variant="secondary" className="text-mastra-el-3" size="xs">
            {toTitleCase(parentField)}
          </Text>
        </Label>
        <div className="flex flex-col gap-4">
          {schemaOptions.map((schemaOption: ZodUnion<any>['options'][number], index: number) => (
            <React.Fragment key={index}>
              {index >= 1 && (
                <Text variant="secondary" className="text-mastra-el-3 text-center" size="xs">
                  or
                </Text>
              )}
              <div className="ring-1 ring-white/10 p-2 rounded-md relative">
                {renderDynamicForm({
                  schema: schemaOption,

                  handleFieldChange,
                  control,
                  formValues,
                  errors,
                  parentField,
                  action,
                  isOptional,
                  isNullable,
                  depth,
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
