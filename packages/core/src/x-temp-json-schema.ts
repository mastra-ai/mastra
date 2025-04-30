import { jsonSchema } from 'ai';
// import { ZodFirstPartyTypeKind } from 'zod';
import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

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

type SchemaConstraints = {
  [path: string]: {
    defaultValue?: unknown;
    // Array constraints
    minLength?: number;
    maxLength?: number;
    exactLength?: number;
    // Number constraints
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
    multipleOf?: number;
    // String constraints
    stringMin?: number;
    stringMax?: number;
    email?: boolean;
    url?: boolean;
    uuid?: boolean;
    cuid?: boolean;
    emoji?: boolean;
    regex?: {
      pattern: string;
      flags?: string;
    };
    // Date constraints
    minDate?: string;
    maxDate?: string;
    dateFormat?: string;
  };
};

type ZodShape<T extends z.AnyZodObject> = T['shape'];
type ShapeKey<T extends z.AnyZodObject> = keyof ZodShape<T>;
type ShapeValue<T extends z.AnyZodObject> = ZodShape<T>[ShapeKey<T>];

function processZodType<T extends z.AnyZodObject>(
  value: z.ZodTypeAny,
  path: string,
  constraints: SchemaConstraints,
): ShapeValue<T> {
  console.log({
    value: JSON.stringify(value, null, 2),
    path,
    constraints,
  });
  switch (value._def.typeName) {
    case 'ZodOptional':
      return (value as z.ZodOptional<z.ZodTypeAny>).unwrap().nullable() as ShapeValue<T>;
    case 'ZodObject': {
      const zodObject = value as z.ZodObject<any, any, any>;
      // Process each property of the object recursively
      const processedShape = Object.entries(zodObject.shape || {}).reduce<Record<string, z.ZodTypeAny>>(
        (acc, [key, propValue]) => {
          const typedPropValue = propValue as z.ZodTypeAny;
          const processedValue = processZodType<T>(
            typedPropValue,
            path ? `${path}.${String(key)}` : String(key),
            constraints,
          );

          return {
            ...acc,
            [key]: processedValue,
          };
        },
        {},
      );
      return z.object(processedShape) as ShapeValue<T>;
    }
    case 'ZodArray': {
      const zodArray = (value as z.ZodArray<any>)._def;
      const arrayType = zodArray.type;
      const currentConstraints: SchemaConstraints[string] = {};

      // Store array constraints, accessing .value for Zod check objects
      if (zodArray.minLength?.value !== undefined) {
        currentConstraints.minLength = zodArray.minLength.value;
      }
      if (zodArray.maxLength?.value !== undefined) {
        currentConstraints.maxLength = zodArray.maxLength.value;
      }
      if (zodArray.exactLength?.value !== undefined) {
        currentConstraints.exactLength = zodArray.exactLength.value;
      }

      if (Object.keys(currentConstraints).length > 0) {
        constraints[path] = {
          ...constraints[path],
          ...currentConstraints,
        };
      }

      // Process the array element type recursively
      const processedType =
        arrayType._def.typeName === 'ZodObject'
          ? processZodType<T>(arrayType as z.ZodTypeAny, `${path}.*`, constraints)
          : arrayType;

      return z.array(processedType) as ShapeValue<T>;
    }
    case 'ZodDefault': {
      const defaultDef = (value as z.ZodDefault<any>)._def;
      const innerType = defaultDef.innerType;
      const defaultValue = defaultDef.defaultValue();

      // Store default value in constraints
      constraints[path] = {
        ...constraints[path],
        defaultValue,
      };

      // Process the inner type
      return processZodType<T>(innerType, path, constraints);
    }
    case 'ZodNumber': {
      const zodNumber = value as z.ZodNumber;
      const currentConstraints: SchemaConstraints[string] = {};

      // Check for gt/lt constraints in the checks array
      const checks = zodNumber._def.checks || [];
      type ZodNumberCheck = (typeof checks)[number];
      const newChecks: ZodNumberCheck[] = [];

      for (const check of checks) {
        if ('kind' in check) {
          switch (check.kind) {
            case 'min':
              if (check.inclusive) {
                currentConstraints.gte = check.value;
              } else {
                currentConstraints.gt = check.value;
              }
              break;
            case 'max':
              if (check.inclusive) {
                currentConstraints.lte = check.value;
              } else {
                currentConstraints.lt = check.value;
              }
              break;
            case 'multipleOf':
              currentConstraints.multipleOf = check.value;
              break;
            default:
              newChecks.push(check);
          }
        }
      }

      if (Object.keys(currentConstraints).length > 0) {
        constraints[path] = {
          ...constraints[path],
          ...currentConstraints,
        };
      }

      // Create a new number type without the min/max/multipleOf constraints
      let newType = z.number();
      for (const check of newChecks) {
        if ('kind' in check) {
          switch (check.kind) {
            case 'int':
              newType = newType.int();
              break;
            case 'finite':
              newType = newType.finite();
              break;
          }
        }
      }
      return newType as ShapeValue<T>;
    }
    case 'ZodString': {
      const zodString = value as z.ZodString;
      const currentConstraints: SchemaConstraints[string] = {};

      // Check for string constraints in the checks array
      const checks = zodString._def.checks || [];
      type ZodStringCheck = (typeof checks)[number];
      const newChecks: ZodStringCheck[] = [];

      for (const check of checks) {
        if ('kind' in check) {
          switch (check.kind) {
            case 'min':
              currentConstraints.stringMin = check.value;
              break;
            case 'max':
              currentConstraints.stringMax = check.value;
              break;
            case 'email':
              currentConstraints.email = true;
              break;
            case 'url':
              currentConstraints.url = true;
              break;
            case 'uuid':
              currentConstraints.uuid = true;
              break;
            case 'cuid':
              currentConstraints.cuid = true;
              break;
            case 'emoji':
              currentConstraints.emoji = true;
              break;
            case 'regex':
              currentConstraints.regex = {
                pattern: check.regex.source,
                flags: check.regex.flags,
              };
              break;
            default:
              newChecks.push(check);
          }
        }
      }

      if (Object.keys(currentConstraints).length > 0) {
        constraints[path] = {
          ...constraints[path],
          ...currentConstraints,
        };
      }

      // Return a basic string type without the constraints
      return z.string() as ShapeValue<T>;
    }
    // case 'ZodIntersection': {
    //   const zodIntersection = value as z.ZodIntersection<any, any>;
    //   const left = zodIntersection._def.left as z.ZodTypeAny;
    //   const right = zodIntersection._def.right as z.ZodTypeAny;

    //   // If both types are objects, merge their shapes
    //   if (left._def.typeName === 'ZodObject' && right._def.typeName === 'ZodObject') {
    //     // Helper to get shape from a type, handling both object and non-object types
    //     const getShape = (type: z.ZodObject<any>): Record<string, z.ZodTypeAny> => type.shape;

    //     // Get shapes from both sides
    //     const leftShape = getShape(left);
    //     const rightShape = getShape(right);

    //     // Merge the shapes
    //     const mergedShape = Object.entries(rightShape).reduce(
    //       (acc, [key, value]) => ({
    //         ...acc,
    //         [key]: key in leftShape
    //           ? processZodType<T>(value, path ? `${path}.${String(key)}` : String(key), constraints)
    //           : processZodType<T>(value, path ? `${path}.${String(key)}` : String(key), constraints)
    //       }),
    //       Object.entries(leftShape).reduce(
    //         (acc, [key, value]) => ({
    //           ...acc,
    //           [key]: processZodType<T>(value, path ? `${path}.${String(key)}` : String(key), constraints)
    //         }),
    //         {} as Record<string, z.ZodTypeAny>
    //       )
    //     );

    //     return z.object(mergedShape) as ShapeValue<T>;
    //   }

    //   // For primitive types (like string & string), process both sides to collect all constraints
    //   // but return a single type
    //   processZodType<T>(left, path, constraints);
    //   processZodType<T>(right, path, constraints);

    //   // Return a new instance of the base type (e.g., z.string() for string intersection)
    //   switch (left._def.typeName) {
    //     case 'ZodString':
    //       return z.string() as ShapeValue<T>;
    //     case 'ZodNumber':
    //       return z.number() as ShapeValue<T>;
    //     // Add other primitive types as needed
    //     default:
    //       return left as ShapeValue<T>;
    //   }
    // }

    case 'ZodDate': {
      const zodDate = value as z.ZodDate;
      const currentConstraints: SchemaConstraints[string] = {};

      // Check for date constraints in the checks array
      const checks = zodDate._def.checks || [];
      type ZodDateCheck = (typeof checks)[number];
      const newChecks: ZodDateCheck[] = [];

      for (const check of checks) {
        if ('kind' in check) {
          switch (check.kind) {
            case 'min':
              currentConstraints.minDate = new Date(check.value).toISOString();
              break;
            case 'max':
              currentConstraints.maxDate = new Date(check.value).toISOString();
              break;
            default:
              newChecks.push(check);
          }
        }
      }

      // Add date-time format constraint
      currentConstraints.dateFormat = 'date-time';

      if (Object.keys(currentConstraints).length > 0) {
        constraints[path] = {
          ...constraints[path],
          ...currentConstraints,
        };
      }

      // Return a string type with date-time format instead of date
      return z.string().describe('date-time') as ShapeValue<T>;
    }
    case 'ZodUnion': {
      const zodUnion = value as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>;
      // Process each option in the union
      const processedOptions = zodUnion._def.options.map((option: z.ZodTypeAny) =>
        processZodType<T>(option, path, constraints),
      ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];

      return z.union(processedOptions) as ShapeValue<T>;
    }
    default:
      return value as ShapeValue<T>;
  }
}

function getNewZodSchemaForCompatibilityAndMutateConstraints<T extends z.AnyZodObject>(
  schema: T,
  parentPath = '',
  constraints: SchemaConstraints = {},
): T {
  const entries = Object.entries(schema.shape) as [ShapeKey<T>, z.ZodTypeAny][];

  const newShape = entries.reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: processZodType<T>(value, parentPath ? `${parentPath}${String(key)}` : String(key), constraints),
    }),
    {} as {
      [K in ShapeKey<T>]: ZodShape<T>[K] extends z.ZodOptional<infer U> ? z.ZodNullable<U> : ZodShape<T>[K];
    },
  );

  return Object.assign(z.object(newShape) as T, { constraints });
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
): Schema<OBJECT> & { constraints: SchemaConstraints } {
  const useReferences = options?.useReferences ?? false;
  const constraints: SchemaConstraints = {};

  // Safe type assertion through unknown
  const asZodObject = zodSchema as unknown as z.AnyZodObject;
  const newSchema = getNewZodSchemaForCompatibilityAndMutateConstraints(asZodObject, '', constraints);

  console.log(JSON.stringify(newSchema._def.shape(), null, 2), newSchema._def.shape());

  const schema = jsonSchema(
    zodToJsonSchema(newSchema, {
      $refStrategy: useReferences ? 'root' : 'none',
      target: 'openApi3', // note: openai mode breaks various gemini conversions.
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
      validate: value => {
        const result = newSchema.safeParse(value);
        return result.success
          ? { success: true, value: result.data as OBJECT }
          : { success: false, error: result.error };
      },
    },
  ) as Schema<OBJECT>;

  return Object.assign(schema, { constraints });
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
