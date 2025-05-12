import { zodSchema } from 'ai';
import type { Schema } from 'ai';
import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import type { MastraLanguageModel } from '../../agent/types';
import { MastraBase } from '../../base';
import { isVercelTool } from '../../utils';
import { convertVercelToolParameters, convertZodSchemaToAISDKSchema } from './builder';
import type { ToolToConvert } from './builder';

export const ALL_STRING_CHECKS = ['regex', 'emoji', 'email', 'url', 'uuid', 'cuid', 'min', 'max'] as const;

export const ALL_NUMBER_CHECKS = [
  'min', // gte internally
  'max', // lte internally
  'multipleOf',
] as const;

export const ALL_ARRAY_CHECKS = ['min', 'max', 'length'] as const;
export const UNSUPPORTED_ZOD_TYPES = ['ZodIntersection', 'ZodNever', 'ZodNull', 'ZodTuple', 'ZodUndefined'] as const;

export type StringCheckType = (typeof ALL_STRING_CHECKS)[number];
export type NumberCheckType = (typeof ALL_NUMBER_CHECKS)[number];
export type ArrayCheckType = (typeof ALL_ARRAY_CHECKS)[number];
export type UnsupportedZodType = (typeof UNSUPPORTED_ZOD_TYPES)[number];

export type ZodShape<T extends z.AnyZodObject> = T['shape'];
export type ShapeKey<T extends z.AnyZodObject> = keyof ZodShape<T>;
export type ShapeValue<T extends z.AnyZodObject> = ZodShape<T>[ShapeKey<T>];

// Add constraint types at the top

type StringConstraints = {
  minLength?: number;
  maxLength?: number;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  cuid?: boolean;
  emoji?: boolean;
  regex?: { pattern: string; flags?: string };
};

type NumberConstraints = {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  multipleOf?: number;
};

type ArrayConstraints = {
  minLength?: number;
  maxLength?: number;
  exactLength?: number;
};

type DateConstraints = {
  minDate?: string;
  maxDate?: string;
  dateFormat?: string;
};

export abstract class ToolCompatibility extends MastraBase {
  private model: MastraLanguageModel;
  constructor(model: MastraLanguageModel) {
    super({ name: 'SchemaCompatibility' });
    this.model = model;
  }

  getModel(): MastraLanguageModel {
    return this.model;
  }

  // return true to apply this compatibility fix
  abstract shouldApply(): boolean;
  // return undefined to use the default of jsonSchema7
  abstract getSchemaTarget(): Targets | undefined;

  abstract processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T>;

  private applyZodSchemaCompatibility(zodSchema: z.AnyZodObject): {
    schema: z.AnyZodObject;
  } {
    const newSchema = z.object(
      Object.entries<z.ZodTypeAny>(zodSchema.shape).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: this.processZodType<any>(value),
        }),
        {},
      ),
    );

    return { schema: newSchema };
  }

  public defaultZodObjectHandler<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    const zodObject = value as z.ZodObject<any, any, any>;
    const processedShape = Object.entries(zodObject.shape || {}).reduce<Record<string, z.ZodTypeAny>>(
      (acc, [key, propValue]) => {
        const typedPropValue = propValue as z.ZodTypeAny;
        const processedValue = this.processZodType<T>(typedPropValue);
        acc[key] = processedValue;
        return acc;
      },
      {},
    );
    let result = z.object(processedShape);
    if (value.description) {
      result = result.describe(value.description);
    }
    return result as ShapeValue<T>;
  }

  public mergeParameterDescription(
    description: string | undefined,
    constraints:
      | NumberConstraints
      | StringConstraints
      | ArrayConstraints
      | DateConstraints
      | { defaultValue?: unknown },
  ): string | undefined {
    if (Object.keys(constraints).length > 0) {
      return (description ? description + '\n' : '') + JSON.stringify(constraints);
    } else {
      return description;
    }
  }

  public defaultUnsupportedZodTypeHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    throwOnTypes: readonly UnsupportedZodType[] = UNSUPPORTED_ZOD_TYPES,
  ): ShapeValue<T> {
    if (throwOnTypes.includes(value._def.typeName as UnsupportedZodType)) {
      throw new Error(`${this.model.modelId} does not support zod type: ${value._def.typeName}`);
    }
    return value as ShapeValue<T>;
  }

  public defaultZodArrayHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
  ): ShapeValue<T> {
    const zodArray = (value as z.ZodArray<any>)._def;
    const arrayType = zodArray.type;
    const constraints: ArrayConstraints = {};
    if (zodArray.minLength?.value !== undefined && handleChecks.includes('min')) {
      constraints.minLength = zodArray.minLength.value;
    }
    if (zodArray.maxLength?.value !== undefined && handleChecks.includes('max')) {
      constraints.maxLength = zodArray.maxLength.value;
    }
    if (zodArray.exactLength?.value !== undefined && handleChecks.includes('length')) {
      constraints.exactLength = zodArray.exactLength.value;
    }
    const processedType =
      arrayType._def.typeName === 'ZodObject' ? this.processZodType<T>(arrayType as z.ZodTypeAny) : arrayType;
    let result = z.array(processedType);
    if (zodArray.minLength?.value !== undefined && !handleChecks.includes('min')) {
      result = result.min(zodArray.minLength.value);
    }
    if (zodArray.maxLength?.value !== undefined && !handleChecks.includes('max')) {
      result = result.max(zodArray.maxLength.value);
    }
    if (zodArray.exactLength?.value !== undefined && !handleChecks.includes('length')) {
      result = result.length(zodArray.exactLength.value);
    }

    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result as ShapeValue<T>;
  }

  public defaultZodUnionHandler<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    const zodUnion = value as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>;
    const processedOptions = zodUnion._def.options.map((option: z.ZodTypeAny) => this.processZodType<T>(option));
    if (processedOptions.length < 2) throw new Error('Union must have at least 2 options');
    let result = z.union(processedOptions as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    if (value.description) {
      result = result.describe(value.description);
    }
    return result as ShapeValue<T>;
  }

  public defaultZodStringHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    handleChecks: readonly StringCheckType[] = ALL_STRING_CHECKS,
  ): ShapeValue<T> {
    const zodString = value as z.ZodString;
    const constraints: StringConstraints = {};
    const checks = zodString._def.checks || [];
    type ZodStringCheck = (typeof checks)[number];
    const newChecks: ZodStringCheck[] = [];
    for (const check of checks) {
      if ('kind' in check) {
        if (handleChecks.includes(check.kind as StringCheckType)) {
          switch (check.kind) {
            case 'regex': {
              constraints.regex = {
                pattern: check.regex.source,
                flags: check.regex.flags,
              };
              break;
            }
            case 'emoji': {
              constraints.emoji = true;
              break;
            }
            case 'email': {
              constraints.email = true;
              break;
            }
            case 'url': {
              constraints.url = true;
              break;
            }
            case 'uuid': {
              constraints.uuid = true;
              break;
            }
            case 'cuid': {
              constraints.cuid = true;
              break;
            }
            case 'min': {
              constraints.minLength = check.value;
              break;
            }
            case 'max': {
              constraints.maxLength = check.value;
              break;
            }
          }
        } else {
          newChecks.push(check);
        }
      }
    }
    let result = z.string();
    for (const check of newChecks) {
      result = result._addCheck(check);
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result as ShapeValue<T>;
  }

  public defaultZodNumberHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    handleChecks: readonly NumberCheckType[] = ALL_NUMBER_CHECKS,
  ): ShapeValue<T> {
    const zodNumber = value as z.ZodNumber;
    const constraints: NumberConstraints = {};
    const checks = zodNumber._def.checks || [];
    type ZodNumberCheck = (typeof checks)[number];
    const newChecks: ZodNumberCheck[] = [];
    for (const check of checks) {
      if ('kind' in check) {
        if (handleChecks.includes(check.kind as NumberCheckType)) {
          switch (check.kind) {
            case 'min':
              if (check.inclusive) {
                constraints.gte = check.value;
              } else {
                constraints.gt = check.value;
              }
              break;
            case 'max':
              if (check.inclusive) {
                constraints.lte = check.value;
              } else {
                constraints.lt = check.value;
              }
              break;
            case 'multipleOf': {
              constraints.multipleOf = check.value;
              break;
            }
          }
        } else {
          newChecks.push(check);
        }
      }
    }
    let result = z.number();
    for (const check of newChecks) {
      switch (check.kind) {
        case 'int':
          result = result.int();
          break;
        case 'finite':
          result = result.finite();
          break;
        default:
          result = result._addCheck(check);
      }
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result as ShapeValue<T>;
  }

  public defaultZodDateHandler<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    const zodDate = value as z.ZodDate;
    const constraints: DateConstraints = {};
    const checks = zodDate._def.checks || [];
    type ZodDateCheck = (typeof checks)[number];
    const newChecks: ZodDateCheck[] = [];
    for (const check of checks) {
      if ('kind' in check) {
        switch (check.kind) {
          case 'min':
            const minDate = new Date(check.value);
            if (!isNaN(minDate.getTime())) {
              constraints.minDate = minDate.toISOString();
            }
            break;
          case 'max':
            const maxDate = new Date(check.value);
            if (!isNaN(maxDate.getTime())) {
              constraints.maxDate = maxDate.toISOString();
            }
            break;
          default:
            newChecks.push(check);
        }
      }
    }
    constraints.dateFormat = 'date-time';
    let result = z.string().describe('date-time');
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result as ShapeValue<T>;
  }

  public process(tool: ToolToConvert): {
    description?: string;
    parameters: Schema;
  } {
    if (isVercelTool(tool)) {
      return {
        description: tool.description,
        // TODO: should we also process vercel tool params?
        parameters: zodSchema(convertVercelToolParameters(tool)),
      };
    }

    // Constraints are now embedded in the Zod schema descriptions, so just use the schema as-is
    const { schema } = this.applyZodSchemaCompatibility(tool.inputSchema);

    return {
      description: tool.description,
      parameters: convertZodSchemaToAISDKSchema(schema, this.getSchemaTarget()),
    };
  }
}
