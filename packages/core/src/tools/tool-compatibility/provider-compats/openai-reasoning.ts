import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { ToolCompatibility } from '..';
import type { SchemaConstraints, ShapeValue } from '..';
import type { MastraLanguageModel } from '../../../agent';

export class OpenAIReasoningToolCompat extends ToolCompatibility {
  constructor(model: MastraLanguageModel) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return `openApi3`;
  }

  isReasoningModel(): boolean {
    return this.getModel().modelId.includes(`o3`) || this.getModel().modelId.includes(`o4`);
  }

  shouldApply(): boolean {
    if (
      (this.getModel().supportsStructuredOutputs || this.isReasoningModel()) &&
      (this.getModel().provider.includes(`openai`) || this.getModel().modelId.includes(`openai`))
    ) {
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
        return this.defaultZodObjectHandler(value, path, constraints);
      }
      case 'ZodArray': {
        return this.defaultZodArrayHandler(value, path, constraints);
      }
      case 'ZodUnion': {
        return this.defaultZodUnionHandler(value, path, constraints);
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
        return this.defaultZodNumberHandler(value, path, constraints);
      }
      case 'ZodString': {
        return this.defaultZodStringHandler(value, path, constraints);
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
      default:
        return value as ShapeValue<T>;
    }
  }
}
