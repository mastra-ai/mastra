import { jsonSchema } from 'ai';
// import { ZodFirstPartyTypeKind } from 'zod';
import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import zodToJsonSchema, {
  ignoreOverride,
  // primitiveMappings
} from 'zod-to-json-schema';

// Should we do something like this? With less crazy naming
// class OpenAIReasoningModelToolSchemaSerializationOverride extends ToolSchemaSerialization {}
// export class ToolSchemaSerialization {
//   // shouldApplyToModel({model }) {
//   //   if (isReasoningModel(model.id) && model.isOpenAI()) {
//   //     return true
//   //   }
//   // }
//   modifyZodSchema() {}
//   getJSONSChemaTarget() {
//     return 'openApi3';
//   }
//   // could expose a way to hook into zodToJsonSchema override fn
// }

function makeOptionalPropsNullable<Schema extends z.AnyZodObject>(schema: Schema) {
  return schema;
  const entries = Object.entries(schema.shape) as [keyof Schema['shape'], z.ZodTypeAny][];
  const newProps = entries.reduce(
    (acc, [key, value]) => {
      acc[key] = value._def.typeName === `ZodOptional` ? value.unwrap().nullable() : value;
      console.log(key, value);
      return acc;
    },
    {} as {
      [key in keyof Schema['shape']]: Schema['shape'][key] extends z.ZodOptional<infer T>
        ? z.ZodNullable<T>
        : Schema['shape'][key];
    },
  );
  return z.object(newProps);
}

// export function isZodType(value: unknown): value is z.ZodType {
//   // Check if it's a Zod schema by looking for common Zod properties and methods
//   return (
//     typeof value === 'object' &&
//     value !== null &&
//     '_def' in value &&
//     'parse' in value &&
//     typeof (value as any).parse === 'function' &&
//     'safeParse' in value &&
//     typeof (value as any).safeParse === 'function'
//   );
// }
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

  // @ts-ignore
  const newSchema = makeOptionalPropsNullable(zodSchema);
  console.log(`is this code getting hit?`);
  console.log(JSON.stringify(newSchema._def.shape(), null, 2), newSchema._def.shape());
  // @ts-ignore
  return jsonSchema(
    zodToJsonSchema(newSchema, {
      $refStrategy: useReferences ? 'root' : 'none',
      target: 'jsonSchema7', // note: openai mode breaks various gemini conversions.
      // override: (def, refs) => {
      //   const path = refs.currentPath.join('/');
      //   console.log(path, def);
      //
      //   // if (ZodFirstPartyTypeKind.ZodNullable === (def as any).typeName) {
      //   //   if (
      //   //     ['ZodString', 'ZodNumber', 'ZodBigInt', 'ZodBoolean', 'ZodNull'].includes(
      //   //       // @ts-ignore
      //   //       def.innerType._def.typeName,
      //   //     ) &&
      //   //     // @ts-ignore
      //   //     (!def.innerType._def.checks || !def.innerType._def.checks.length)
      //   //   ) {
      //   //     return {
      //   //       type: primitiveMappings[
      //   //         // @ts-ignore
      //   //         def.innerType._def.typeName as keyof typeof primitiveMappings
      //   //       ],
      //   //       nullable: true,
      //   //     };
      //   //     // Alternative null union type:
      //   //     // return {
      //   //     //   anyOf: [
      //   //     //     {
      //   //     //       type: primitiveMappings[
      //   //     //         // @ts-ignore
      //   //     //         def.innerType._def.typeName as keyof typeof primitiveMappings
      //   //     //       ],
      //   //     //     },
      //   //     //     { type: 'null' },
      //   //     //   ],
      //   //     // };
      //   //   }
      //   // }
      //
      //   // Important! Do not return `undefined` or void unless you want to remove the property from the resulting schema completely.
      //   return ignoreOverride;
      // },
    }) as JSONSchema7,
    {
      // @ts-ignore
      validate: value => {
        // if (ZodFirstPartyTypeKind.ZodNullable === (zodSchema._def as any).typeName) {
        // console.log(`using overriden validator`);
        // @ts-ignore
        const result = newSchema.safeParse(value);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
        // }
        //
        // console.log(`Not using overriden z`, )
        // const result = zodSchema.safeParse(value);
        // return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    },
  );
}

// export function parseNullableDef(
//   def: ZodNullableDef,
//   refs: Refs,
// ): JsonSchema7NullableType | undefined {
//   if (
//     ["ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull"].includes(
//       def.innerType._def.typeName,
//     ) &&
//     (!def.innerType._def.checks || !def.innerType._def.checks.length)
//   ) {
//     if (refs.target === "openApi3") {
//       return {
//         type: primitiveMappings[
//           def.innerType._def.typeName as keyof typeof primitiveMappings
//         ],
//         nullable: true,
//       } as any;
//     }
//
//     return {
//       type: [
//         primitiveMappings[
//           def.innerType._def.typeName as keyof typeof primitiveMappings
//         ],
//         "null",
//       ],
//     };
//   }
//
//   if (refs.target === "openApi3") {
//     const base = parseDef(def.innerType._def, {
//       ...refs,
//       currentPath: [...refs.currentPath],
//     });
//
//     if (base && "$ref" in base) return { allOf: [base], nullable: true } as any;
//
//     return base && ({ ...base, nullable: true } as any);
//   }
//
//   const base = parseDef(def.innerType._def, {
//     ...refs,
//     currentPath: [...refs.currentPath, "anyOf", "0"],
//   });
//
//   return base && { anyOf: [base, { type: "null" }] };
// }
// export const selectParser = (
//   def: any,
//   typeName: ZodFirstPartyTypeKind,
//   refs: Refs,
// ): JsonSchema7Type | undefined | InnerDefGetter => {
//   switch (typeName) {
//     case ZodFirstPartyTypeKind.ZodNullable:
//       return parseNullableDef(def, refs);
//
