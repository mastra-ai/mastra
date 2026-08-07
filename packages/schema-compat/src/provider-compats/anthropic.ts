import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';

import { jsonSchema } from '../json-schema';
import {
  isAllOfSchema,
  isArraySchema,
  isObjectSchema,
  isNumberSchema,
  isStringSchema,
  isUnionSchema,
} from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { PublicSchema, ZodType } from '../schema.types';
import { standardSchemaToJSONSchema, toStandardSchema } from '../standard-schema/standard-schema';
import type { StandardSchemaWithJSON } from '../standard-schema/standard-schema.types';
import type { ModelInformation } from '../types';
import { isZodType } from '../utils';
import { isIntersection, isNull } from '../zodTypes';

export class AnthropicSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  override processToJSONSchema(schema: PublicSchema<any>, io: 'input' | 'output' = 'input'): JSONSchema7 {
    const jsonSchema = super.processToJSONSchema(schema, io);
    const union = jsonSchema.anyOf ?? jsonSchema.oneOf;

    if (io !== 'input' || !Array.isArray(union)) {
      return jsonSchema;
    }

    const objectSchemas = union.filter(
      (subSchema): subSchema is JSONSchema7 =>
        typeof subSchema === 'object' && subSchema !== null && subSchema.type === 'object',
    );

    if (objectSchemas.length === 0 || objectSchemas.length !== union.length) {
      return jsonSchema;
    }

    delete jsonSchema.anyOf;
    delete jsonSchema.oneOf;
    jsonSchema.type = 'object';

    // Merge branch properties. When the same key appears in multiple branches with
    // differing schemas, preserve every variant via a property-level anyOf instead
    // of letting later branches overwrite earlier ones.
    const mergedProperties: Record<string, JSONSchema7Definition[]> = {};
    for (const subSchema of objectSchemas) {
      for (const [key, propSchema] of Object.entries(subSchema.properties ?? {})) {
        const variants = (mergedProperties[key] ??= []);
        if (!variants.some(existing => JSON.stringify(existing) === JSON.stringify(propSchema))) {
          variants.push(propSchema);
        }
      }
    }
    jsonSchema.properties = Object.fromEntries(
      Object.entries(mergedProperties).map(([key, variants]) => [
        key,
        variants.length === 1 ? variants[0]! : { anyOf: variants },
      ]),
    );

    jsonSchema.required = objectSchemas
      .map(subSchema => subSchema.required ?? [])
      .reduce((required, branchRequired) => required.filter(key => branchRequired.includes(key)));
    jsonSchema.additionalProperties = false;

    return jsonSchema;
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('claude');
  }

  processZodType(value: ZodType): ZodType {
    if (this.isOptional(value)) {
      const handleTypes: string[] = ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodNever', 'ZodUndefined', 'ZodTuple'];
      if (this.getModel().modelId.includes('claude-3.5-haiku')) handleTypes.push('ZodString');
      return this.defaultZodOptionalHandler(value, handleTypes);
    } else if (this.isObj(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (this.isArr(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (this.isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (this.isString(value)) {
      // the claude-3.5-haiku model support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description

      if (this.getModel().modelId.includes('claude-3.5-haiku')) {
        return this.defaultZodStringHandler(value, ['max', 'min']);
      } else {
        return value;
      }
    } else if (isNull(z)(value)) {
      return z
        .any()
        .refine(v => v === null, { message: 'must be null' })
        .describe(value.description || 'must be null');
    } else if (isIntersection(z)(value)) {
      return this.defaultZodIntersectionHandler(value);
    }

    return this.defaultUnsupportedZodTypeHandler(value);
  }

  processToAISDKSchema(zodSchema: ZodTypeV3 | ZodTypeV4) {
    const compat = this.processToCompatSchema(zodSchema);
    const transformedJsonSchema = standardSchemaToJSONSchema(compat);

    return jsonSchema(transformedJsonSchema, {
      validate: (value: unknown) => {
        const result = compat['~standard'].validate(value);
        if (result instanceof Promise) {
          throw new Error('Async validation is not supported');
        }
        return 'issues' in result && result.issues
          ? { success: false as const, error: new Error(result.issues.map(i => i.message).join(', ')) }
          : { success: true as const, value: (result as { value: unknown }).value };
      },
    });
  }

  public processToCompatSchema<T>(schema: PublicSchema<T>): StandardSchemaWithJSON<T> {
    const originalStandardSchema = toStandardSchema(schema);
    const validationStandardSchema = this.#getCompatValidationStandardSchema(schema, originalStandardSchema);

    return {
      '~standard': {
        version: 1,
        vendor: 'mastra',
        validate: (value: unknown) => {
          const transformedJsonSchema = this.processToJSONSchema(schema, 'input') as Record<string, unknown>;
          const transformed = this.#traverse(value, transformedJsonSchema);
          return validationStandardSchema['~standard'].validate(transformed);
        },
        jsonSchema: {
          input: () => {
            return this.processToJSONSchema(schema, 'input') as Record<string, unknown>;
          },
          output: () => {
            return this.processToJSONSchema(schema, 'output') as Record<string, unknown>;
          },
        },
      },
    };
  }

  preProcessJSONNode(schema: JSONSchema7): void {
    if (isAllOfSchema(schema)) {
      this.defaultAllOfHandler(schema);
    }

    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isNumberSchema(schema)) {
      this.defaultNumberHandler(schema);
    } else if (isStringSchema(schema)) {
      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }
  }

  #traverse(value: unknown, schema: Record<string, unknown>): unknown {
    const resolved = this.#resolveSchemaForValue(schema, value);

    if (resolved['x-date'] === true && typeof value === 'string') {
      return new Date(value);
    }

    const isArrayType =
      resolved.type === 'array' || (Array.isArray(resolved.type) && (resolved.type as string[]).includes('array'));
    if (isArrayType) {
      if (!Array.isArray(value)) {
        return value;
      }
      return value.map(item => this.#traverse(item, resolved.items as Record<string, unknown>));
    }

    const isObjectType =
      resolved.type === 'object' || (Array.isArray(resolved.type) && (resolved.type as string[]).includes('object'));
    if (!isObjectType) {
      return value;
    }

    const properties = resolved.properties as Record<string, Record<string, unknown>> | undefined;
    if (!properties || !value) {
      return value;
    }

    const obj = value as Record<string, unknown>;
    for (const key in obj) {
      if (properties[key]) {
        obj[key] = this.#traverse(obj[key], properties[key]);
      }
    }

    return obj;
  }

  // #resolveAnyOf(schema: Record<string, unknown>): Record<string, unknown> {
  //   if (Array.isArray(schema.anyOf)) {
  //     const nonNull = (schema.anyOf as Record<string, unknown>[]).find(s => s.type !== 'null');
  //     if (nonNull) {
  //       return nonNull;
  //     }
  //   }

  //   return schema;
  // }

  #isHaikuModel(): boolean {
    return this.getModel().modelId.includes('claude-3.5-haiku');
  }

  #getCompatValidationStandardSchema<T>(
    schema: PublicSchema<T>,
    originalStandardSchema: StandardSchemaWithJSON<T>,
  ): StandardSchemaWithJSON<T> {
    if (!this.#isHaikuModel() || !isZodType(schema)) {
      return originalStandardSchema;
    }

    return toStandardSchema(this.#stripHaikuStringLengthConstraints(schema as ZodType)) as StandardSchemaWithJSON<T>;
  }

  /**
   * Strip Haiku-ignored string min/max from a Zod schema for execute-time validation.
   * Preserves object-level refinements and wrapper semantics unlike full-tree processZodType.
   */
  #stripHaikuStringLengthConstraints(value: ZodType): ZodType {
    const schemas = new WeakMap<object, ZodType>();
    if ('_zod' in value) {
      return this.#stripHaikuStringLengthConstraintsV4(value, schemas);
    }

    return this.#stripHaikuStringLengthConstraintsV3(value, schemas);
  }

  #stripHaikuStringLengthConstraintsV4(value: ZodType, schemas: WeakMap<object, ZodType>): ZodType {
    const cached = schemas.get(value as object);
    if (cached) {
      return cached;
    }

    const schema = value as any;
    const def = schema._zod.def;
    const strip = (child: ZodType) => this.#stripHaikuStringLengthConstraintsV4(child, schemas);
    let nextDef = def;

    const replace = (key: string) => {
      const current = def[key] as ZodType | undefined;
      if (!current) {
        return;
      }
      const stripped = strip(current);
      if (stripped !== current) {
        nextDef = { ...nextDef, [key]: stripped };
      }
    };

    switch (def.type) {
      case 'string': {
        const checks = (def.checks ?? []).filter(
          (check: any) => check._zod.def.check !== 'min_length' && check._zod.def.check !== 'max_length',
        );
        if (checks.length !== (def.checks?.length ?? 0)) {
          nextDef = { ...def, checks };
        }
        break;
      }
      case 'object': {
        const shape = def.shape as Record<string, ZodType>;
        const nextShape = Object.fromEntries(Object.entries(shape).map(([key, child]) => [key, strip(child)]));
        if (Object.keys(shape).some(key => nextShape[key] !== shape[key])) {
          nextDef = { ...nextDef, shape: nextShape };
        }
        replace('catchall');
        break;
      }
      case 'array':
        replace('element');
        break;
      case 'union': {
        const options = def.options as ZodType[];
        const nextOptions = options.map(strip);
        if (nextOptions.some((option, index) => option !== options[index])) {
          nextDef = { ...nextDef, options: nextOptions };
        }
        break;
      }
      case 'intersection':
        replace('left');
        replace('right');
        break;
      case 'tuple': {
        const items = def.items as ZodType[];
        const nextItems = items.map(strip);
        if (nextItems.some((item, index) => item !== items[index])) {
          nextDef = { ...nextDef, items: nextItems };
        }
        replace('rest');
        break;
      }
      case 'record':
      case 'map':
        replace('keyType');
        replace('valueType');
        break;
      case 'set':
        replace('valueType');
        break;
      case 'optional':
      case 'nullable':
      case 'default':
      case 'prefault':
      case 'nonoptional':
      case 'success':
      case 'catch':
      case 'readonly':
        replace('innerType');
        break;
      case 'pipe':
        replace('in');
        replace('out');
        break;
      case 'promise':
        replace('innerType');
        break;
      case 'lazy': {
        nextDef = { ...def, getter: () => strip(def.getter()) };
        break;
      }
    }

    if (nextDef === def) {
      schemas.set(value as object, value);
      return value;
    }

    let stripped = schema.clone(nextDef) as ZodType;
    const metadata = schema.meta();
    if (metadata) {
      stripped = (stripped as any).meta(metadata);
    }
    schemas.set(value as object, stripped);
    return stripped;
  }

  #stripHaikuStringLengthConstraintsV3(value: ZodType, schemas: WeakMap<object, ZodType>): ZodType {
    const cached = schemas.get(value as object);
    if (cached) {
      return cached;
    }

    const schema = value as any;
    const def = schema._def;
    const strip = (child: ZodType) => this.#stripHaikuStringLengthConstraintsV3(child, schemas);
    let nextDef = def;

    const replace = (key: string) => {
      const current = def[key] as ZodType | undefined;
      if (!current) {
        return;
      }
      const stripped = strip(current);
      if (stripped !== current) {
        nextDef = { ...nextDef, [key]: stripped };
      }
    };

    switch (def.typeName) {
      case 'ZodString': {
        const checks = (def.checks ?? []).filter((check: any) => check.kind !== 'min' && check.kind !== 'max');
        if (checks.length !== (def.checks?.length ?? 0)) {
          nextDef = { ...def, checks };
        }
        break;
      }
      case 'ZodObject': {
        const shape = def.shape() as Record<string, ZodType>;
        const nextShape = Object.fromEntries(Object.entries(shape).map(([key, child]) => [key, strip(child)]));
        if (Object.keys(shape).some(key => nextShape[key] !== shape[key])) {
          nextDef = { ...nextDef, shape: () => nextShape };
        }
        replace('catchall');
        break;
      }
      case 'ZodArray':
      case 'ZodPromise':
      case 'ZodBranded':
        replace('type');
        break;
      case 'ZodUnion': {
        const options = def.options as ZodType[];
        const nextOptions = options.map(strip);
        if (nextOptions.some((option, index) => option !== options[index])) {
          nextDef = { ...nextDef, options: nextOptions };
        }
        break;
      }
      case 'ZodDiscriminatedUnion': {
        const options = def.options as ZodType[];
        const nextOptions = options.map(strip);
        if (nextOptions.some((option, index) => option !== options[index])) {
          const optionsMap = new Map(def.optionsMap as Map<unknown, ZodType>);
          for (const [key, option] of optionsMap) {
            const index = options.indexOf(option);
            if (index !== -1) {
              optionsMap.set(key, nextOptions[index]!);
            }
          }
          nextDef = { ...nextDef, options: nextOptions, optionsMap };
        }
        break;
      }
      case 'ZodIntersection':
        replace('left');
        replace('right');
        break;
      case 'ZodTuple': {
        const items = def.items as ZodType[];
        const nextItems = items.map(strip);
        if (nextItems.some((item, index) => item !== items[index])) {
          nextDef = { ...nextDef, items: nextItems };
        }
        replace('rest');
        break;
      }
      case 'ZodRecord':
      case 'ZodMap':
        replace('keyType');
        replace('valueType');
        break;
      case 'ZodSet':
        replace('valueType');
        break;
      case 'ZodOptional':
      case 'ZodNullable':
      case 'ZodDefault':
      case 'ZodCatch':
      case 'ZodReadonly':
        replace('innerType');
        break;
      case 'ZodEffects':
        replace('schema');
        break;
      case 'ZodPipeline':
        replace('in');
        replace('out');
        break;
      case 'ZodLazy':
        nextDef = { ...def, getter: () => strip(def.getter()) };
        break;
    }

    if (nextDef === def) {
      schemas.set(value as object, value);
      return value;
    }

    const stripped = new schema.constructor(nextDef) as ZodType;
    schemas.set(value as object, stripped);
    return stripped;
  }

  #resolveSchemaForValue(schema: Record<string, unknown>, value: unknown): Record<string, unknown> {
    if (!Array.isArray(schema.anyOf)) {
      return schema;
    }

    const variants = schema.anyOf as Record<string, unknown>[];
    const nonNullVariants = variants.filter(variant => variant.type !== 'null');
    // fast-path only for nullable wrappers
    if (variants.length === 2 && nonNullVariants.length === 1) {
      return nonNullVariants[0]!;
    }
    // otherwise choose a branch from the runtime value, or recurse each branch
    const keys = value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>) : [];
    return (
      nonNullVariants.find(variant => {
        const properties = variant.properties as Record<string, unknown> | undefined;
        return !!properties && keys.some(key => key in properties);
      }) ?? schema
    );
  }
}
