import { z } from 'zod';

import { BaseFilterTranslator, OperatorSupport } from './base';

export class FilterSchemaBuilder {
  private static getDefaultOperators(): OperatorSupport {
    return BaseFilterTranslator.DEFAULT_OPERATORS;
  }

  static createFilterSchema(customOperators?: OperatorSupport) {
    const operators = {
      ...this.getDefaultOperators(),
      ...customOperators,
    };

    // Define the comparison value schema
    const ComparisonValue = z.object({
      type: z.literal('value'),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]),
    });

    // Define the condition schema
    const SingleConditionSchema = z.object({
      field: z.string(),
      value: ComparisonValue,
    });

    // Define schemas for each operator type separately to avoid type conflicts
    const basicOperator = z.object({
      type: z.literal('basic'),
      operator: z.enum(operators.basic as [string, ...string[]]),
      value: ComparisonValue,
    });

    const arrayOperator = z.object({
      type: z.literal('array'),
      operator: z.enum(operators.array as [string, ...string[]]),
      value: ComparisonValue,
    });

    const numericOperator = z.object({
      type: z.literal('numeric'),
      operator: z.enum(operators.numeric as [string, ...string[]]),
      value: ComparisonValue,
    });

    const elementOperator = z.object({
      type: z.literal('element'),
      operator: z.enum(operators.element as [string, ...string[]]),
      value: ComparisonValue,
    });

    const logicalOperator = z.object({
      type: z.literal('logical'),
      operator: z.enum(operators.logical as [string, ...string[]]),
      conditions: z.array(SingleConditionSchema),
    });

    const regexOperator = z.object({
      type: z.literal('regex'),
      operator: z.enum(operators.regex as [string, ...string[]]),
      value: ComparisonValue,
    });

    const customOperator = z.object({
      type: z.literal('custom'),
      operator: z.enum(operators.custom as [string, ...string[]]),
      value: ComparisonValue,
    });

    // Create the union of all operator types
    const operatorSchemas = [
      ComparisonValue, // Keep this for direct comparisons
      basicOperator,
      arrayOperator,
      numericOperator,
      elementOperator,
      logicalOperator,
      regexOperator,
      ...(operators.custom?.length ? [customOperator] : []),
    ] as const;

    return z.record(z.string(), z.discriminatedUnion('type', operatorSchemas));
  }
}
