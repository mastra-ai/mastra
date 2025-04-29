import { jsonSchema } from 'ai';
import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z } from 'zod';
import zodToJsonSchema, { ignoreOverride } from 'zod-to-json-schema';

// This FN was lifted from AI SDK "zodSchema" fn
// https://github.com/vercel/ai/blob/main/packages/ui-utils/src/zod-schema.ts#L6
export function zodSchemaToCustomVercelJSONSchema<OBJECT>(
  zodSchema: z.Schema<OBJECT, z.ZodTypeDef, any>,
  options?: {
    /**
     * Enables support for references in the schema.
     * This is required for recursive schemas, e.g. with `z.lazy`.
     * However, not all language models and providers support such references.
     * Defaults to `false`.
     */
    useReferences?: boolean;
  },
): Schema<OBJECT> {
  // default to no references (to support openapi conversion for google)
  const useReferences = options?.useReferences ?? false;

  return jsonSchema(
    zodToJsonSchema(zodSchema, {
      $refStrategy: useReferences ? 'root' : 'none',
      target: 'jsonSchema7', // note: openai mode breaks various gemini conversions
      override: (def, refs) => {
        const path = refs.currentPath.join('/');
        console.log(path, def);
        // if ()
        //
        // if (path === '#/properties/overrideThis') {
        //   return {
        //     type: 'integer',
        //   };
        // }
        //
        // if (path === '#/properties/removeThis') {
        //   return undefined;
        // }

        // Important! Do not return `undefined` or void unless you want to remove the property from the resulting schema completely.
        return ignoreOverride;
      },
    }) as JSONSchema7,
    {
      validate: value => {
        const result = zodSchema.safeParse(value);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    },
  );
}
