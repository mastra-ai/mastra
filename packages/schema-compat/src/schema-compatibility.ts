import type { z as zV3 } from 'zod/v3';
import type { z as zV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import type { JSONSchema7, Schema } from './json-schema';
import * as v3 from './schema-compatibility-v3';
import type { HandlerContext as HandlerContextV3 } from './schema-compatibility-v3';
import * as v4 from './schema-compatibility-v4';
import type { HandlerContext as HandlerContextV4 } from './schema-compatibility-v4';
import type { ZodType } from './schema.types';
import { standardSchemaToJSONSchema, toStandardSchema } from './standard-schema/standard-schema';
import { convertZodSchemaToAISDKSchema } from './utils';

// Re-export constants and types
export {
  ALL_STRING_CHECKS,
  ALL_NUMBER_CHECKS,
  ALL_ARRAY_CHECKS,
  UNSUPPORTED_ZOD_TYPES as UNSUPPORTED_ZOD_TYPES_V3,
  SUPPORTED_ZOD_TYPES as SUPPORTED_ZOD_TYPES_V3,
} from './schema-compatibility-v3';
export type {
  UnsupportedZodType as UnsupportedZodTypeV3,
  ShapeValue as ShapeValueV3,
  StringCheckType,
  NumberCheckType,
  ArrayCheckType,
  AllZodType as AllZodTypeV3,
} from './schema-compatibility-v3';
export {
  UNSUPPORTED_ZOD_TYPES as UNSUPPORTED_ZOD_TYPES_V4,
  SUPPORTED_ZOD_TYPES as SUPPORTED_ZOD_TYPES_V4,
} from './schema-compatibility-v4';
export type {
  UnsupportedZodType as UnsupportedZodTypeV4,
  ShapeValue as ShapeValueV4,
  AllZodType as AllZodTypeV4,
} from './schema-compatibility-v4';

type ConstraintHelperText = string[];

export type ModelInformation = {
  modelId: string;
  provider: string;
  supportsStructuredOutputs: boolean;
};


export abstract class SchemaCompatLayer {
  private model: ModelInformation;

  constructor(model: ModelInformation) {
    this.model = model;
  }

  getModel(): ModelInformation {
    return this.model;
  }

  getUnsupportedZodTypes(value: ZodType): readonly string[] {
    if ('_zod' in value) {
      return v4.getUnsupportedZodTypes();
    } else {
      return v3.getUnsupportedZodTypes();
    }
  }

  isOptional(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodOptional<any> | zV4.ZodOptional<any> {
    if ('_zod' in v) {
      return v4.isOptional(v as zV4.ZodType);
    } else {
      return v3.isOptional(v as zV3.ZodType);
    }
  }

  isObj(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodObject<any, any, any, any, any> | zV4.ZodObject<any, any> {
    if ('_zod' in v) {
      return v4.isObj(v as zV4.ZodType);
    } else {
      return v3.isObj(v as zV3.ZodType);
    }
  }

  isNull(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodNull | zV4.ZodNull {
    if ('_zod' in v) {
      return v4.isNull(v as zV4.ZodType);
    } else {
      return v3.isNull(v as zV3.ZodType);
    }
  }

  isArr(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodArray<any, any> | zV4.ZodArray<any> {
    if ('_zod' in v) {
      return v4.isArr(v as zV4.ZodType);
    } else {
      return v3.isArr(v as zV3.ZodType);
    }
  }

  isUnion(
    v: zV3.ZodType | zV4.ZodType,
  ): v is zV3.ZodUnion<[zV3.ZodType, ...zV3.ZodType[]]> | zV4.ZodUnion<[zV4.ZodType, ...zV4.ZodType[]]> {
    if ('_zod' in v) {
      return v4.isUnion(v as zV4.ZodType);
    } else {
      return v3.isUnion(v as zV3.ZodType);
    }
  }

  isString(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodString | zV4.ZodString {
    if ('_zod' in v) {
      return v4.isString(v as zV4.ZodType);
    } else {
      return v3.isString(v as zV3.ZodType);
    }
  }

  isNumber(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodNumber | zV4.ZodNumber {
    if ('_zod' in v) {
      return v4.isNumber(v as zV4.ZodType);
    } else {
      return v3.isNumber(v as zV3.ZodType);
    }
  }

  isDate(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodDate | zV4.ZodDate {
    if ('_zod' in v) {
      return v4.isDate(v as zV4.ZodType);
    } else {
      return v3.isDate(v as zV3.ZodType);
    }
  }

  isDefault(v: zV3.ZodType | zV4.ZodType): v is zV3.ZodDefault<any> | zV4.ZodDefault<any> {
    if ('_zod' in v) {
      return v4.isDefault(v as zV4.ZodType);
    } else {
      return v3.isDefault(v as zV3.ZodType);
    }
  }

  private getV3Context(): HandlerContextV3 {
    return {
      model: this.model,
      processZodType: (value) => this.processZodType(value),
    };
  }

  private getV4Context(): HandlerContextV4 {
    return {
      model: this.model,
      processZodType: (value) => this.processZodType(value),
    };
  }

  abstract shouldApply(): boolean;
  abstract getSchemaTarget(): Targets | undefined;
  abstract processZodType(value: ZodType): ZodType;

  public defaultZodObjectHandler(
    value: zV3.ZodObject<any, any, any, any, any> | zV4.ZodObject<any, any>,
    options: { passthrough?: boolean } = { passthrough: true },
  ): zV3.ZodObject<any, any, any, any, any> | zV4.ZodObject<any, any> {
    if ('_zod' in value) {
      return v4.defaultZodObjectHandler(this.getV4Context(), value, options);
    } else {
      return v3.defaultZodObjectHandler(this.getV3Context(), value, options);
    }
  }

  public mergeParameterDescription(
    description: string | undefined,
    constraints: ConstraintHelperText,
  ): string | undefined {
    return v3.mergeParameterDescription(description, constraints);
  }

  public defaultUnsupportedZodTypeHandler(
    value: zV3.ZodType | zV4.ZodType,
    throwOnTypes?: readonly (v3.UnsupportedZodType | v4.UnsupportedZodType)[],
  ): zV3.ZodType | zV4.ZodType {
    if ('_zod' in value) {
      return v4.defaultUnsupportedZodTypeHandler(
        this.getV4Context(),
        value as zV4.ZodType,
        (throwOnTypes ?? v4.UNSUPPORTED_ZOD_TYPES) as typeof v4.UNSUPPORTED_ZOD_TYPES,
      );
    } else {
      return v3.defaultUnsupportedZodTypeHandler(
        this.getV3Context(),
        value as zV3.ZodType,
        (throwOnTypes ?? v3.UNSUPPORTED_ZOD_TYPES) as typeof v3.UNSUPPORTED_ZOD_TYPES,
      );
    }
  }

  public defaultZodArrayHandler(
    value: zV3.ZodArray<any, any> | zV4.ZodArray<any>,
    handleChecks: readonly v3.ArrayCheckType[] = v3.ALL_ARRAY_CHECKS,
  ): zV3.ZodArray<any, any> | zV4.ZodArray<any> {
    if ('_zod' in value) {
      return v4.defaultZodArrayHandler(this.getV4Context(), value, handleChecks);
    } else {
      return v3.defaultZodArrayHandler(this.getV3Context(), value, handleChecks);
    }
  }

  public defaultZodUnionHandler(
    value: zV3.ZodUnion<[zV3.ZodType, ...zV3.ZodType[]]> | zV4.ZodUnion<[zV4.ZodType, ...zV4.ZodType[]]>,
  ): zV3.ZodType | zV4.ZodType {
    if ('_zod' in value) {
      return v4.defaultZodUnionHandler(this.getV4Context(), value as zV4.ZodUnion<[zV4.ZodAny, ...zV4.ZodAny[]]>);
    } else {
      return v3.defaultZodUnionHandler(this.getV3Context(), value as zV3.ZodUnion<[zV3.ZodType, ...zV3.ZodType[]]>);
    }
  }

  public defaultZodStringHandler(
    value: zV3.ZodString | zV4.ZodString,
    handleChecks: readonly v3.StringCheckType[] = v3.ALL_STRING_CHECKS,
  ): zV3.ZodString | zV4.ZodString {
    if ('_zod' in value) {
      return v4.defaultZodStringHandler(value);
    } else {
      return v3.defaultZodStringHandler(value, handleChecks);
    }
  }

  public defaultZodNumberHandler(
    value: zV3.ZodNumber | zV4.ZodNumber,
    handleChecks: readonly v3.NumberCheckType[] = v3.ALL_NUMBER_CHECKS,
  ): zV3.ZodNumber | zV4.ZodNumber {
    if ('_zod' in value) {
      return v4.defaultZodNumberHandler(value);
    } else {
      return v3.defaultZodNumberHandler(value, handleChecks);
    }
  }

  public defaultZodDateHandler(value: zV3.ZodDate | zV4.ZodDate): zV3.ZodString | zV4.ZodString {
    if ('_zod' in value) {
      return v4.defaultZodDateHandler(value);
    } else {
      return v3.defaultZodDateHandler(value);
    }
  }

  public defaultZodOptionalHandler(
    value: zV3.ZodOptional<any> | zV4.ZodOptional<any>,
    handleTypes?: readonly string[],
  ): zV3.ZodType | zV4.ZodType {
    if ('_zod' in value) {
      return v4.defaultZodOptionalHandler(this.getV4Context(), value, handleTypes ?? v4.SUPPORTED_ZOD_TYPES);
    } else {
      return v3.defaultZodOptionalHandler(this.getV3Context(), value, handleTypes ?? v3.SUPPORTED_ZOD_TYPES);
    }
  }

  public processToAISDKSchema(zodSchema: ZodType): Schema {
    return convertZodSchemaToAISDKSchema<any>(this.processZodType(zodSchema), this.getSchemaTarget());
  }

  public processToJSONSchema(zodSchema: ZodType): JSONSchema7 {
    const standardSchema = toStandardSchema(zodSchema);

    return standardSchemaToJSONSchema(standardSchema, {
      target: 'draft-07',
      override: (ctx) => {
        console.log(ctx.zodSchema);

        return undefined;
    });
  }
}
