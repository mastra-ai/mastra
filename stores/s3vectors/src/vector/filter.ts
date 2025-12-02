import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  VectorFilter,
  LogicalOperatorValueMap,
  OperatorSupport,
  QueryOperator,
  OperatorValueMap,
  BlacklistedRootOperators,
} from '@mastra/core/vector/filter';

/**
 * S3 Vectors supports a strict subset of operators and value types.
 *
 * - logical: `$and`, `$or` (non-empty arrays)
 * - basic:   `$eq`, `$ne` (string | number | boolean)
 * - numeric: `$gt`, `$gte`, `$lt`, `$lte` (number)
 * - array:   `$in`, `$nin` (non-empty arrays of string | number | boolean)
 * - element: `$exists` (boolean)
 */
type S3VectorsOperatorValueMap = Pick<
  OperatorValueMap,
  '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$nin' | '$exists'
>;

type S3VectorsLogicalOperatorValueMap = Pick<LogicalOperatorValueMap, '$and' | '$or'>;

type S3VectorsBlacklisted = BlacklistedRootOperators;

type S3VectorsFieldValue = string | number | boolean;

/**
 * High-level filter type accepted by this translator.
 * @remarks
 * Field values are limited to string/number/boolean at equality positions.
 */
export type S3VectorsFilter = VectorFilter<
  keyof S3VectorsOperatorValueMap,
  S3VectorsOperatorValueMap,
  S3VectorsLogicalOperatorValueMap,
  S3VectorsBlacklisted,
  S3VectorsFieldValue
>;

/**
 * Translates a high-level filter into the S3 Vectors filter shape.
 *
 * @remarks
 * - Canonicalizes **implicit AND** (e.g. `{a:1,b:2}`) into explicit `{$and:[{a:1},{b:2}]}` in any
 *   non-field context that lacks `$and/$or`.
 * - Normalizes `Date` values to epoch milliseconds where allowed (numeric comparisons and array elements).
 * - Disallows `Date` at equality positions (including implicit equality).
 * - Validates shapes using the base class after translation.
 */
export class S3VectorsFilterTranslator extends BaseFilterTranslator<S3VectorsFilter> {
  /** @inheritdoc */
  protected override getSupportedOperators(): OperatorSupport {
    return {
      logical: ['$and', '$or'],
      basic: ['$eq', '$ne'],
      numeric: ['$gt', '$gte', '$lt', '$lte'],
      array: ['$in', '$nin'],
      element: ['$exists'],
    };
  }

  /**
   * Translates and validates a filter.
   * @param filter - Input filter; may be `undefined`, `null`, or `{}` (all treated as empty).
   * @returns The translated filter (or the original value if empty).
   */
  translate(filter?: S3VectorsFilter): any {
    if (this.isEmpty(filter)) return filter;
    // Perform translation (including Date → number normalization) before base shape validation.
    const translated = this.translateNode(filter as any, false);
    this.validateFilter(translated as any);
    return translated;
  }

  /**
   * Recursively translates a node.
   * @param node - Current node to translate.
   * @param inFieldValue - When `true`, the node is the value of a field (i.e., equality context).
   * @remarks
   * - In a **field-value** context, only primitives or operator objects are allowed.
   * - In a **non-field** context (root / logical branches), operator keys are processed;
   *   plain keys become field equalities and are validated.
   * - Implicit AND is canonicalized in non-field contexts when multiple non-logical keys exist.
   */
  private translateNode(node: any, inFieldValue = false): any {
    // Primitive or Date (normalize when in a field-equality context)
    if (this.isPrimitive(node) || node instanceof Date) {
      return inFieldValue ? this.validateAndNormalizePrimitive(node) : node;
    }

    // Arrays are not allowed as direct equality values
    if (Array.isArray(node)) {
      if (inFieldValue) {
        throw new Error('Array equality is not supported in S3 Vectors. Use $in / $nin operators.');
      }
      return node;
    }

    // Object
    const entries = Object.entries(node as Record<string, any>);

    if (inFieldValue) {
      if (entries.length === 0) {
        throw new Error('Invalid equality value. Only string, number, or boolean are supported by S3 Vectors');
      }
      const allOperatorKeys = entries.every(([k]) => this.isOperator(k));
      if (!allOperatorKeys) {
        // Disallow shapes like: { field: { a:1, b:2 } }
        throw new Error('Invalid equality value. Only string, number, or boolean are supported by S3 Vectors');
      }
      const opEntries = entries.map(([key, value]) => [key, this.translateOperatorValue(key as QueryOperator, value)]);
      return Object.fromEntries(opEntries);
    }

    // Root / filter context
    const translatedEntries = entries.map(([key, value]) => {
      if (this.isOperator(key)) {
        return [key, this.translateOperatorValue(key as QueryOperator, value)];
      }
      return [key, this.translateNode(value, true)];
    });
    const obj = Object.fromEntries(translatedEntries);

    // Canonicalize implicit AND → explicit $and (if no $and/$or present and multiple non-logical keys)
    const keys = Object.keys(obj);
    const hasLogical = keys.some(k => k === '$and' || k === '$or');
    if (!hasLogical) {
      const nonLogical = keys.filter(k => k !== '$and' && k !== '$or');
      if (nonLogical.length > 1) {
        return { $and: nonLogical.map(k => ({ [k]: obj[k] })) };
      }
    }

    return obj;
  }

  /**
   * Translates a single operator and validates its value.
   * @param operator - One of the supported query operators.
   * @param value - Operator value to normalize/validate.
   */
  private translateOperatorValue(operator: QueryOperator, value: any): any {
    // Logical operators
    if (operator === '$and' || operator === '$or') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`Value for logical operator ${operator} must be a non-empty array`);
      }
      return value.map(item => this.translateNode(item));
    }

    // Equality / inequality (Date is not allowed)
    if (operator === '$eq' || operator === '$ne') {
      if (value instanceof Date) {
        throw new Error('Invalid equality value. Only string, number, or boolean are supported by S3 Vectors');
      }
      return this.toPrimitiveForS3(value, operator);
    }

    // Numeric comparisons: require number; allow Date by converting to epoch ms
    if (operator === '$gt' || operator === '$gte' || operator === '$lt' || operator === '$lte') {
      const n = this.toNumberForRange(value, operator);
      return n;
    }

    // Array operators: non-empty arrays of primitives (Date converted to number)
    if (operator === '$in' || operator === '$nin') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`Value for array operator ${operator} must be a non-empty array`);
      }
      return value.map(v => this.toPrimitiveForS3(v, operator));
    }

    // Existence check
    if (operator === '$exists') {
      if (typeof value !== 'boolean') {
        throw new Error(`Value for $exists operator must be a boolean`);
      }
      return value;
    }

    throw new Error(`Unsupported operator: ${operator}`);
  }

  /**
   * Normalizes a value to an S3-accepted primitive.
   * @param value - String | Number | Boolean | Date.
   * @param operatorForMessage - Operator name used in error messages.
   * @returns The normalized primitive; `Date` becomes epoch milliseconds.
   * @throws If the value is not a supported primitive or is null/undefined.
   */
  private toPrimitiveForS3(value: any, operatorForMessage: string): string | number | boolean {
    if (value === null || value === undefined) {
      // Error message for equality matches tests
      if (operatorForMessage === 'equality') {
        throw new Error('S3 Vectors does not support null/undefined for equality');
      }
      throw new Error(`Value for ${operatorForMessage} must be string, number, or boolean`);
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    const t = typeof value;
    if (t === 'string' || t === 'boolean') return value;
    if (t === 'number') return Object.is(value, -0) ? 0 : value;
    throw new Error(`Value for ${operatorForMessage} must be string, number, or boolean`);
  }

  /**
   * Ensures a numeric value for range operators; allows `Date` by converting to epoch ms.
   * @param value - Candidate value.
   * @param operatorForMessage - Operator name used in error messages.
   * @throws If the value is not a number (or a Date).
   */
  private toNumberForRange(value: any, operatorForMessage: string): number {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && !Number.isNaN(value)) return Object.is(value, -0) ? 0 : value;
    throw new Error(`Value for ${operatorForMessage} must be a number`);
  }

  /**
   * Validates and normalizes a primitive used in field equality (implicit `$eq`).
   * @param value - Candidate equality value.
   * @throws If the value is a `Date` or not a supported primitive.
   */
  private validateAndNormalizePrimitive(value: any): S3VectorsFieldValue {
    if (value instanceof Date) {
      throw new Error('Invalid equality value. Only string, number, or boolean are supported by S3 Vectors');
    }
    return this.toPrimitiveForS3(value, 'equality') as S3VectorsFieldValue;
  }

  /**
   * Determines whether a filter is considered empty.
   * @param filter - Input filter.
   */
  protected override isEmpty(filter: any): boolean {
    return filter === undefined || filter === null || (typeof filter === 'object' && Object.keys(filter).length === 0);
  }
}
