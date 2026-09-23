import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  VectorFilter,
  OperatorSupport,
  OperatorValueMap,
  LogicalOperatorValueMap,
  BlacklistedRootOperators,
} from '@mastra/core/vector/filter';
import { Filters } from 'weaviate-client';
import type { FilterValue } from 'weaviate-client';

import { encodeMetaKey } from './encoding';

/**
 * The subset of Weaviate's collection filter API used by the translator.
 * Provided at translate time via `collection.filter`.
 */
export interface WeaviateFilterApi {
  byProperty: (name: string, length?: boolean) => WeaviateFilterProperty;
}

interface WeaviateFilterProperty {
  isNull: (value: boolean) => FilterValue;
  equal: (value: any) => FilterValue;
  notEqual: (value: any) => FilterValue;
  greaterThan: (value: any) => FilterValue;
  greaterOrEqual: (value: any) => FilterValue;
  lessThan: (value: any) => FilterValue;
  lessOrEqual: (value: any) => FilterValue;
  containsAny: (value: any[]) => FilterValue;
  containsAll: (value: any[]) => FilterValue;
  containsNone: (value: any[]) => FilterValue;
}

type WeaviateOperatorValueMap = Omit<
  OperatorValueMap,
  '$options' | '$elemMatch' | '$regex' | '$nor' | '$size' | '$contains'
>;

type WeaviateLogicalOperatorValueMap = Omit<LogicalOperatorValueMap, '$nor'>;

type WeaviateBlacklistedRootOperators = BlacklistedRootOperators;

export type WeaviateVectorFilter = VectorFilter<
  keyof WeaviateOperatorValueMap,
  WeaviateOperatorValueMap,
  WeaviateLogicalOperatorValueMap,
  WeaviateBlacklistedRootOperators
>;

/**
 * Translates MongoDB-style filters into Weaviate `FilterValue` objects.
 *
 * Weaviate filters are built from the collection's `filter` API (which produces
 * protobuf-backed targets), so `translate` requires the collection filter API to
 * be supplied alongside the filter.
 */
export class WeaviateFilterTranslator extends BaseFilterTranslator<WeaviateVectorFilter> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      logical: ['$and', '$or', '$not'],
      basic: ['$eq', '$ne'],
      numeric: ['$gt', '$gte', '$lt', '$lte'],
      array: ['$in', '$nin', '$all'],
      element: ['$exists'],
      regex: [],
      custom: [],
    };
  }

  protected override isOperator(key: string): key is any {
    // $not can be used both logically and at field level.
    return super.isOperator(key) || key === '$not';
  }

  translate(filter?: WeaviateVectorFilter, api?: WeaviateFilterApi): FilterValue | undefined {
    if (this.isEmpty(filter)) return undefined;
    if (!api) {
      throw new Error('WeaviateFilterTranslator.translate requires a collection filter API');
    }
    this.validateFilter(filter);
    return this.translateNode(filter as Record<string, any>, api);
  }

  private combine(parts: Array<FilterValue | undefined>): FilterValue | undefined {
    const filtered = parts.filter((p): p is FilterValue => p !== undefined);
    if (filtered.length === 0) return undefined;
    if (filtered.length === 1) return filtered[0];
    return Filters.and(...filtered);
  }

  private translateNode(node: Record<string, any>, api: WeaviateFilterApi): FilterValue | undefined {
    const parts = Object.entries(node).map(([key, value]) => {
      if (key === '$and') {
        return this.combineLogical('and', value as any[], api);
      }
      if (key === '$or') {
        return this.combineLogical('or', value as any[], api);
      }
      if (key === '$not') {
        // Push the negation into the operators (De Morgan) rather than relying on
        // Weaviate's Not operator, which is not supported by all server versions.
        return this.negateNode(value as Record<string, any>, api);
      }
      return this.translateField(key, value, api);
    });
    return this.combine(parts);
  }

  /** Combines parts with OR, dropping undefined entries. */
  private combineOr(parts: Array<FilterValue | undefined>): FilterValue | undefined {
    const filtered = parts.filter((p): p is FilterValue => p !== undefined);
    if (filtered.length === 0) return undefined;
    if (filtered.length === 1) return filtered[0];
    return Filters.or(...filtered);
  }

  /**
   * Returns the negation of a node. A node's entries are AND-combined, so the
   * negation is the OR of each entry's negation (De Morgan).
   */
  private negateNode(node: Record<string, any>, api: WeaviateFilterApi): FilterValue | undefined {
    const parts = Object.entries(node).map(([key, value]) => {
      if (key === '$and') {
        // NOT(a AND b) = (NOT a) OR (NOT b)
        return this.combineOr((value as any[]).map(v => this.negateNode(v as Record<string, any>, api)));
      }
      if (key === '$or') {
        // NOT(a OR b) = (NOT a) AND (NOT b)
        return this.combine((value as any[]).map(v => this.negateNode(v as Record<string, any>, api)));
      }
      if (key === '$not') {
        // Double negation.
        return this.translateNode(value as Record<string, any>, api);
      }
      return this.negateField(key, value, api);
    });
    return this.combineOr(parts);
  }

  /** Returns the negation of a single field condition. */
  private negateField(field: string, value: any, api: WeaviateFilterApi): FilterValue | undefined {
    const prop = api.byProperty(encodeMetaKey(field));

    if (value === null) {
      return prop.isNull(false);
    }
    if (this.isPrimitive(value)) {
      return prop.notEqual(this.normalizeComparisonValue(value));
    }
    if (Array.isArray(value)) {
      // NOT(field in [..]) = field not equal to every value.
      return this.combine(this.normalizeArrayValues(value).map(v => prop.notEqual(v)));
    }

    // Operator object: entries are AND-combined, so negation is OR of negations.
    const parts = Object.entries(value as Record<string, any>).map(([op, opValue]) =>
      this.negateSingleOp(field, op, opValue, api),
    );
    return this.combineOr(parts);
  }

  private negateSingleOp(field: string, op: string, value: any, api: WeaviateFilterApi): FilterValue | undefined {
    const prop = api.byProperty(encodeMetaKey(field));
    switch (op) {
      case '$eq':
        return value === null ? prop.isNull(false) : prop.notEqual(this.normalizeComparisonValue(value));
      case '$ne':
        return value === null ? prop.isNull(true) : prop.equal(this.normalizeComparisonValue(value));
      case '$gt':
        return prop.lessOrEqual(this.normalizeComparisonValue(value));
      case '$gte':
        return prop.lessThan(this.normalizeComparisonValue(value));
      case '$lt':
        return prop.greaterOrEqual(this.normalizeComparisonValue(value));
      case '$lte':
        return prop.greaterThan(this.normalizeComparisonValue(value));
      case '$in':
        // NOT(in [..]) = not equal to every value.
        return this.combine(this.normalizeArrayValues(value as any[]).map(v => prop.notEqual(v)));
      case '$nin':
        // NOT(nin [..]) = in [..].
        return prop.containsAny(this.normalizeArrayValues(value as any[]));
      case '$exists':
        return prop.isNull(!!value);
      case '$not':
        return this.translateField(field, value, api);
      default:
        throw unsupportedOperatorError(op, field);
    }
  }

  private combineLogical(op: 'and' | 'or', values: any[], api: WeaviateFilterApi): FilterValue | undefined {
    const translated = values
      .map(v => this.translateNode(v as Record<string, any>, api))
      .filter((p): p is FilterValue => p !== undefined);
    if (translated.length === 0) return undefined;
    if (translated.length === 1) return translated[0];
    return op === 'and' ? Filters.and(...translated) : Filters.or(...translated);
  }

  private translateField(field: string, value: any, api: WeaviateFilterApi): FilterValue | undefined {
    const prop = api.byProperty(encodeMetaKey(field));

    if (value === null) {
      return prop.isNull(true);
    }

    if (this.isPrimitive(value)) {
      return prop.equal(this.normalizeComparisonValue(value));
    }

    if (Array.isArray(value)) {
      return prop.containsAny(this.normalizeArrayValues(value));
    }

    // Operator object: combine each operator condition with AND.
    const parts = Object.entries(value as Record<string, any>).map(([op, opValue]) =>
      this.translateOperator(field, op, opValue, api),
    );
    return this.combine(parts);
  }

  private translateOperator(field: string, op: string, value: any, api: WeaviateFilterApi): FilterValue | undefined {
    const prop = api.byProperty(encodeMetaKey(field));
    switch (op) {
      case '$eq':
        return value === null ? prop.isNull(true) : prop.equal(this.normalizeComparisonValue(value));
      case '$ne':
        return value === null ? prop.isNull(false) : prop.notEqual(this.normalizeComparisonValue(value));
      case '$gt':
        return prop.greaterThan(this.normalizeComparisonValue(value));
      case '$gte':
        return prop.greaterOrEqual(this.normalizeComparisonValue(value));
      case '$lt':
        return prop.lessThan(this.normalizeComparisonValue(value));
      case '$lte':
        return prop.lessOrEqual(this.normalizeComparisonValue(value));
      case '$in':
        return prop.containsAny(this.normalizeArrayValues(value as any[]));
      case '$nin':
        // Weaviate's ContainsNone is not available on all server versions; express
        // "not in" as an AND of not-equals instead.
        return this.combine(this.normalizeArrayValues(value as any[]).map(v => prop.notEqual(v)));
      case '$all':
        return prop.containsAll(this.normalizeArrayValues(value as any[]));
      case '$exists':
        return prop.isNull(!value);
      case '$not':
        return this.negateField(field, value, api);
      default:
        throw unsupportedOperatorError(op, field);
    }
  }
}

/** Builds a user-facing error for an operator Weaviate cannot translate. */
function unsupportedOperatorError(op: string, field: string): MastraError {
  return new MastraError({
    id: 'STORAGE_WEAVIATE_FILTER_UNSUPPORTED_OPERATOR',
    text: `Unsupported filter operator "${op}" on field "${field}"`,
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.USER,
    details: { operator: op, field },
  });
}
