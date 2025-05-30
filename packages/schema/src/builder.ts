import { jsonSchema, Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import type { JSONSchema as ZodFromJSONSchema_JSONSchema } from 'zod-from-json-schema';
import type { Targets } from 'zod-to-json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SchemaCompatibility } from './schema-compatibility';

// mirrors https://github.com/vercel/ai/blob/main/packages/ui-utils/src/zod-schema.ts#L21 but with a custom target
export function convertZodSchemaToAISDKSchema(zodSchema: ZodSchema, target: Targets = 'jsonSchema7') {
  return jsonSchema(
    zodToJsonSchema(zodSchema, {
      $refStrategy: 'none',
      target,
    }) as JSONSchema7,
    {
      validate: value => {
        const result = zodSchema.safeParse(value);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    },
  );
}

/**
 * Checks if a value is a Zod type
 * @param value - The value to check
 * @returns True if the value is a Zod type, false otherwise
 */
function isZodType(value: unknown): value is z.ZodType {
  // Check if it's a Zod schema by looking for common Zod properties and methods
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    'parse' in value &&
    typeof (value as any).parse === 'function' &&
    'safeParse' in value &&
    typeof (value as any).safeParse === 'function'
  );
}

export function convertSchemaToZod(schema: Schema | z.ZodSchema): z.ZodType {
  if (isZodType(schema)) {
    return schema;
  } else {
    const jsonSchemaToConvert = ('jsonSchema' in schema ? schema.jsonSchema : schema) as ZodFromJSONSchema_JSONSchema;
    try {
      return convertJsonSchemaToZod(jsonSchemaToConvert);
    } catch (e: unknown) {
      const errorMessage = `[Schema Builder] Failed to convert Vercel tool JSON schema parameters to Zod. Original schema: ${JSON.stringify(jsonSchemaToConvert)}`;
      console.error(errorMessage, e);
      throw new Error(errorMessage + (e instanceof Error ? `\n${e.stack}` : '\nUnknown error object'));
    }
  }
}

export function processSchema({
  schema,
  compatibilities,
  mode,
}: {
  schema: Schema | z.AnyZodObject;
  compatibilities: SchemaCompatibility[];
  mode: 'jsonSchema' | 'aiSdkSchema';
}): JSONSchema7 | Schema {
  let zodSchema: z.AnyZodObject;

  if (!isZodType(schema)) {
    // Convert Schema to ZodObject
    const convertedSchema = convertSchemaToZod(schema);
    if (convertedSchema instanceof z.ZodObject) {
      zodSchema = convertedSchema;
    } else {
      // If it's not an object schema, wrap it in an object
      zodSchema = z.object({ value: convertedSchema });
    }
  } else {
    // Ensure it's a ZodObject
    if (schema instanceof z.ZodObject) {
      zodSchema = schema;
    } else {
      // Wrap non-object schemas in an object
      zodSchema = z.object({ value: schema });
    }
  }

  for (const compat of compatibilities) {
    if (compat.shouldApply()) {
      return mode === 'jsonSchema' ? compat.processToJSONSchema(zodSchema) : compat.processtoAISDKSchema(zodSchema);
    }
  }

  // If no compatibility applied, convert back to appropriate format
  if (mode === 'jsonSchema') {
    return zodToJsonSchema(zodSchema, { $refStrategy: 'none', target: 'jsonSchema7' }) as JSONSchema7;
  } else {
    return convertZodSchemaToAISDKSchema(zodSchema);
  }
}
