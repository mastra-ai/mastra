import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ModelInformation } from '../types';
import { isOptional, isObj, isArr, isUnion, isDefault, isNumber, isString, isDate } from '../zodTypes';

export class OpenAIReasoningSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return `openApi3`;
  }

  isReasoningModel(): boolean {
    // there isn't a good way to automatically detect reasoning models besides doing this.
    // in the future when o5 is released this compat wont apply and we'll want to come back and update this class + our tests
    return (
      this.getModel().modelId.includes(`o3`) ||
      this.getModel().modelId.includes(`o4`) ||
      this.getModel().modelId.includes(`o1`)
    );
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

  processZodType(value: ZodTypeV3): ZodTypeV3;
  processZodType(value: ZodTypeV4): ZodTypeV4;
  processZodType(value: ZodTypeV3 | ZodTypeV4): ZodTypeV3 | ZodTypeV4 {
    if (isOptional(z)(value)) {
      const innerZodType = this.processZodType(value._def.innerType);
      return innerZodType.nullable();
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value, { passthrough: false });
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isDefault(z)(value)) {
      const defaultDef = value._def;
      const innerType = defaultDef.innerType;
      const defaultValue = defaultDef.defaultValue();
      const constraints: { defaultValue?: unknown } = {};
      if (defaultValue !== undefined) {
        constraints.defaultValue = defaultValue;
      }

      const description = this.mergeParameterDescription(value.description, constraints);
      let result = this.processZodType(innerType);
      if (description) {
        result = result.describe(description);
      }
      return result;
    } else if (isNumber(z)(value)) {
      return this.defaultZodNumberHandler(value);
    } else if (isString(z)(value)) {
      return this.defaultZodStringHandler(value);
    } else if (isDate(z)(value)) {
      return this.defaultZodDateHandler(value);
    } else if (value.constructor.name === 'ZodAny') {
      // It's bad practice in the tool to use any, it's not reasonable for models that don't support that OOTB, to cast every single possible type
      // in the schema. Usually when it's "any" it could be a json object or a union of specific types.
      return z
        .string()
        .describe(
          (value.description ?? '') +
            `\nArgument was an "any" type, but you (the LLM) do not support "any", so it was cast to a "string" type`,
        );
    }

    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>);
  }
}
