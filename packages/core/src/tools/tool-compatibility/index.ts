import { jsonSchema, zodSchema } from 'ai';
import type { Schema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import type { Targets } from 'zod-to-json-schema';
import { isVercelTool } from '../..';
import type { MastraLanguageModel } from '../../agent/types';
import { MastraBase } from '../../base';
import { convertVercelToolParameters } from './builder';
import type { ToolToConvert } from './builder';

export const OPENAI_TOOL_DESCRIPTION_MAX_LENGTH = 1024;

export type SchemaConstraints = {
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

export const ALL_STRING_CHECKS = ['regex', 'emoji', 'email', 'url', 'uuid', 'cuid', 'min', 'max'] as const;

export const ALL_NUMBER_CHECKS = [
  'min', // gte internally
  'max', // lte internally
  'multipleOf',
] as const;

export const ALL_ARRAY_CHECKS = ['min', 'max', 'length'] as const;

export type StringCheckType = (typeof ALL_STRING_CHECKS)[number];
export type NumberCheckType = (typeof ALL_NUMBER_CHECKS)[number];
export type ArrayCheckType = (typeof ALL_ARRAY_CHECKS)[number];

export type ZodShape<T extends z.AnyZodObject> = T['shape'];
export type ShapeKey<T extends z.AnyZodObject> = keyof ZodShape<T>;
export type ShapeValue<T extends z.AnyZodObject> = ZodShape<T>[ShapeKey<T>];

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

  abstract processZodType<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    path: string,
    constraints: SchemaConstraints,
  ): ShapeValue<T>;

  private zodToAISDKSchema<OBJECT>(zodSchema: z.AnyZodObject): {
    schema: Schema<OBJECT>;
    constraints: SchemaConstraints;
  } {
    const constraints: SchemaConstraints = {};

    const newSchema = z.object(
      Object.entries<z.ZodTypeAny>(zodSchema.shape).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: this.processZodType<any>(value, String(key), constraints),
        }),
        {},
      ),
    );

    const schema = jsonSchema(
      zodToJsonSchema(newSchema, {
        $refStrategy: 'none',
        target: this.getSchemaTarget(),
      }) as JSONSchema7,
      {
        validate: value => {
          const result = newSchema.safeParse(value);
          return result.success
            ? { success: true, value: result.data as OBJECT }
            : { success: false, error: result.error };
        },
      },
    );

    return { schema, constraints };
  }

  public defaultZodObjectHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    path: string,
    constraints: SchemaConstraints,
  ): ShapeValue<T> {
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

  public defaultZodArrayHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    path: string,
    constraints: SchemaConstraints,
    handleChecks: readonly ArrayCheckType[] = ALL_ARRAY_CHECKS,
  ): ShapeValue<T> {
    const zodArray = (value as z.ZodArray<any>)._def;
    const arrayType = zodArray.type;
    const currentConstraints: SchemaConstraints[string] = {};

    // Handle min length
    if (zodArray.minLength?.value !== undefined && handleChecks.includes('min')) {
      currentConstraints.minLength = zodArray.minLength.value;
    }

    // Handle max length
    if (zodArray.maxLength?.value !== undefined && handleChecks.includes('max')) {
      currentConstraints.maxLength = zodArray.maxLength.value;
    }

    // Handle exact length
    if (zodArray.exactLength?.value !== undefined && handleChecks.includes('length')) {
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

    // Create new array with processed element type and preserved constraints
    let result = z.array(processedType);

    // Reapply the constraints that we're not handling
    if (zodArray.minLength?.value !== undefined && !handleChecks.includes('min')) {
      result = result.min(zodArray.minLength.value);
    }
    if (zodArray.maxLength?.value !== undefined && !handleChecks.includes('max')) {
      result = result.max(zodArray.maxLength.value);
    }
    if (zodArray.exactLength?.value !== undefined && !handleChecks.includes('length')) {
      result = result.length(zodArray.exactLength.value);
    }

    return result as ShapeValue<T>;
  }

  public defaultZodUnionHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    path: string,
    constraints: SchemaConstraints,
  ): ShapeValue<T> {
    const zodUnion = value as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>;
    // Process each option in the union
    const processedOptions = zodUnion._def.options.map((option: z.ZodTypeAny) =>
      this.processZodType<T>(option, path, constraints),
    ) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];

    return z.union(processedOptions) as ShapeValue<T>;
  }

  public defaultZodStringHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    path: string,
    constraints: SchemaConstraints,
    handleChecks: readonly StringCheckType[] = ALL_STRING_CHECKS, // Default to handling all checks
  ): ShapeValue<T> {
    const zodString = value as z.ZodString;
    const currentConstraints: SchemaConstraints[string] = {};
    const checks = zodString._def.checks || [];
    type ZodStringCheck = (typeof checks)[number];
    const newChecks: ZodStringCheck[] = [];

    for (const check of checks) {
      if ('kind' in check) {
        if (handleChecks.includes(check.kind as StringCheckType)) {
          switch (check.kind) {
            case 'regex': {
              currentConstraints.regex = {
                pattern: check.regex.source,
                flags: check.regex.flags,
              };
              break;
            }
            case 'emoji': {
              currentConstraints.emoji = true;
              break;
            }
            case 'email': {
              currentConstraints.email = true;
              break;
            }
            case 'url': {
              currentConstraints.url = true;
              break;
            }
            case 'uuid': {
              currentConstraints.uuid = true;
              break;
            }
            case 'cuid': {
              currentConstraints.cuid = true;
              break;
            }
            case 'min': {
              currentConstraints.minLength = check.value;
              break;
            }
            case 'max': {
              currentConstraints.maxLength = check.value;
              break;
            }
          }
        } else {
          // If we're not handling this check specially, preserve it
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

    // Return a string type with any remaining checks
    let result = z.string();
    for (const check of newChecks) {
      result = result._addCheck(check);
    }
    return result as ShapeValue<T>;
  }

  public defaultZodNumberHandler<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    path: string,
    constraints: SchemaConstraints,
    handleChecks: readonly NumberCheckType[] = ALL_NUMBER_CHECKS, // Default to handling all checks
  ): ShapeValue<T> {
    const zodNumber = value as z.ZodNumber;
    const currentConstraints: SchemaConstraints[string] = {};
    const checks = zodNumber._def.checks || [];
    type ZodNumberCheck = (typeof checks)[number];
    const newChecks: ZodNumberCheck[] = [];

    for (const check of checks) {
      if ('kind' in check) {
        if (handleChecks.includes(check.kind as NumberCheckType)) {
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
            case 'multipleOf': {
              currentConstraints.multipleOf = check.value;
              break;
            }
          }
        } else {
          // If we're not handling this check specially, preserve it
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

    // Return a number type with any remaining checks
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
    return result as ShapeValue<T>;
  }

  public process(
    tool: ToolToConvert,
    model: MastraLanguageModel,
  ): {
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

    const { schema, constraints } = this.zodToAISDKSchema(tool.inputSchema);

    const isOpenAI = model.provider.includes(`openai`) || model.modelId.includes(`openai`);

    let description =
      (tool.description || '') + (Object.keys(constraints).length > 0 ? ' ' + `\n` + JSON.stringify(constraints) : '');

    // openai only allows tools descriptions of up to 1024 characters
    // If their tool description is too long we want it to return the openai error as is
    if (isOpenAI && description.length > OPENAI_TOOL_DESCRIPTION_MAX_LENGTH) {
      if (tool.description.length < OPENAI_TOOL_DESCRIPTION_MAX_LENGTH) {
        this.logger.warn(
          `Tool description is too long for OpenAI. Truncating to 1024 characters. Tool call might not respect the schema constraints.`,
        );
        description = description.slice(0, OPENAI_TOOL_DESCRIPTION_MAX_LENGTH);
      } else {
        // Preserve the original description if it's already over the limit
        description = tool.description;
      }
    }

    return {
      description,
      parameters: schema,
    };
  }
}
