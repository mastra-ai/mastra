import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { ToolCompatibility } from '.';
import type { SchemaConstraints, ShapeValue, ToolCompatibilityInput } from '.';

export class OpenAIReasoningToolCompat extends ToolCompatibility {
  constructor() {
    super();
  }

  getSchemaTarget(): Targets | undefined {
    return `openApi3`;
  }

  shouldApply(input: ToolCompatibilityInput): boolean {
    if (input.model.supportsStructuredOutputs && input.model.provider.includes(`openai`)) {
      return true;
    }

    return false;
  }

  processZodType<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    path: string,
    constraints: SchemaConstraints,
  ): ShapeValue<T> {
    switch (value._def.typeName) {
      case 'ZodOptional':
        return (value as z.ZodOptional<z.ZodTypeAny>).unwrap().nullable() as ShapeValue<T>;
      case 'ZodObject': {
        const zodObject = value as z.ZodObject<any, any, any>;
        // Process each property of the object recursively
        const processedShape = Object.entries(zodObject.shape || {}).reduce<Record<string, z.ZodTypeAny>>(
          (acc, [key, propValue]) => {
            const typedPropValue = propValue as z.ZodTypeAny;
            const processedValue = this.processZodType<T>(
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
            ? this.processZodType<T>(arrayType as z.ZodTypeAny, `${path}.*`, constraints)
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
        return this.processZodType<T>(innerType, path, constraints);
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
          this.processZodType<T>(option, path, constraints),
        ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];

        return z.union(processedOptions) as ShapeValue<T>;
      }
      default:
        return value as ShapeValue<T>;
    }
  }
}
