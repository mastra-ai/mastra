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

export type ZodShape<T extends z.AnyZodObject> = T['shape'];
export type ShapeKey<T extends z.AnyZodObject> = keyof ZodShape<T>;
export type ShapeValue<T extends z.AnyZodObject> = ZodShape<T>[ShapeKey<T>];

export type ToolCompatibilityInput = { model: MastraLanguageModel };

export abstract class ToolCompatibility extends MastraBase {
  constructor() {
    super({ name: 'SchemaCompatibility' });
  }

  // return true to apply this compatibility fix
  abstract shouldApply(input: ToolCompatibilityInput): boolean;
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

    // TODO: we should think of other ways to build up the tool description here cause this is a bit janky. We also need to make sure the description text isn't too long because some models throw errors when it's too long
    const { schema, constraints } = this.zodToAISDKSchema(tool.inputSchema);

    return {
      description:
        (tool.description || '') + (Object.keys(constraints).length > 0 ? ' ' + JSON.stringify(constraints) : ''),
      parameters: schema,
    };
  }
}
