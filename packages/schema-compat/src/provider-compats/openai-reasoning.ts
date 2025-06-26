import type { LanguageModelV1 } from 'ai';
import { z } from 'zod';
import type { ZodTypeAny } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import {
  SchemaCompatLayer,
  isArr,
  isDate,
  isDefault,
  isNumber,
  isObj,
  isOptional,
  isString,
  isUnion,
} from '../schema-compatibility';

export class OpenAIReasoningSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return `openApi3`;
  }

  isReasoningModel(): boolean {
    // there isn't a good way to automatically detect reasoning models besides doing this.
    // in the future when o5 is released this compat wont apply and we'll want to come back and update this class + our tests
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

  processZodType(value: ZodTypeAny): ZodTypeAny {
    if (isOptional(value)) {
      const innerZodType = this.processZodType(value._def.innerType);
      return innerZodType.nullable();
    } else if (isObj(value)) {
      return this.defaultZodObjectHandler(value, { passthrough: false });
    } else if (isArr(value)) {
      return this.defaultZodArrayHandler(value);
    } else if (isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isDefault(value)) {
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
    } else if (isNumber(value)) {
      return this.defaultZodNumberHandler(value);
    } else if (isString(value)) {
      return this.defaultZodStringHandler(value);
    } else if (isDate(value)) {
      return this.defaultZodDateHandler(value);
    } else if (value._def.typeName === 'ZodAny') {
      // It's bad practice in the tool to use any, it's not reasonable for models that don't support that OOTB, to cast every single possible type
      // in the schema. Usually when it's "any" it could be a json object or a union of specific types.
      return z
        .string()
        .describe(
          (value.description ?? '') +
            `\nArgument was an "any" type, but you (the LLM) do not support "any", so it was cast to a "string" type`,
        );
    }

    return this.defaultUnsupportedZodTypeHandler(value);
  }
}
