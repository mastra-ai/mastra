import { Prisma } from '@prisma-app/client';
import { z } from 'zod';
import _ from 'lodash';

import { SchemaFieldOptions } from '../types';

type TypedInstance<T> = {
  type: T;
  id: string;
};

/**
 * Extract schema options for the provided schema - Builds a map of fieldname to field options
 * @param schema - schema
 * @param dataCtx - data context - this is an object of options for each field that isn't enum (meaning string fields) but should have options
 * @returns schema options
 * */
export function extractSchemaOptions({
  schema,
  dataCtx,
}: {
  schema: z.ZodObject<any>;
  dataCtx?: Record<string, SchemaFieldOptions>;
}): Record<string, SchemaFieldOptions> {
  return Object.entries(schema.shape).reduce((acc, [field, schema]) => {
    setFieldOptions({ schema, acc, field, dataCtxList: dataCtx?.[field] });

    return acc;
  }, {} as Record<string, SchemaFieldOptions>);
}

/**
 * Set field options for the schema - Recursively populate the accumulator with field options for the provided field
 * if the schema is an enum or an array of enums, or an array of strings and has dataCtxList
 * @param schema - schema
 * @param acc - accumulator
 * @param field - field
 * @param dataCtxList - data context list - custom options for the field
 * @returns void
 * */
function setFieldOptions({
  schema,
  acc,
  field,
  dataCtxList,
}: {
  schema: any;
  acc: Record<string, SchemaFieldOptions>;
  field: string;
  dataCtxList?: SchemaFieldOptions;
}) {
  if (schema instanceof z.ZodEnum) {
    acc[field] = {
      options: schema.options.map((value: string) => ({
        value,
        label: _.capitalize(value),
      })),
    };
  } else if (schema instanceof z.ZodArray) {
    if (schema.element instanceof z.ZodEnum) {
      acc[field] = {
        options: schema.element.options.map((value: string) => ({
          value,
          label: _.capitalize(value),
        })),
      };
    } else if (schema.element instanceof z.ZodString && dataCtxList) {
      acc[field] = dataCtxList || { options: undefined };
    }
  } else if (schema instanceof z.ZodString && dataCtxList) {
    acc[field] = dataCtxList || { options: undefined };
  } else if (schema instanceof z.ZodOptional) {
    setFieldOptions({ schema: schema._def.innerType, dataCtxList, field, acc });
  } else {
    acc[field] = { options: undefined };
  }
}
