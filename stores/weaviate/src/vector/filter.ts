import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  FieldCondition,
  VectorFilter,
  LogicalOperator,
  OperatorSupport,
  BasicOperator,
  NumericOperator,
} from '@mastra/core/vector/filter';
import { Filters, type Collection, type Filter, type FilterValue, type FilterByProperty } from 'weaviate-client';

/**
 * Translates MongoDB-style filters to Weaviate compatible filters.
 *
 * Operators that are not supported:
 * - $not
 * - $nor
 * - $nin
 * - $elemMatch
 * - $exists
 * - $options
 *
 * Weaviate-specific operators:
 * - $length -> filters by property length
 * - $geo -> filters by circular geo location (lat, long, radius)
 * - $null -> filters by whether values are null or not
 */
export class WeaviateFilterTranslator extends BaseFilterTranslator {
  private filter: Filter<any>;

  private constructor(filter: Filter<any>) {
    super();
    this.filter = filter;
  }

  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or'],
      array: ['$all', '$in'],
      element: [],
      regex: ['$regex'],
      custom: ['$length', '$geo', '$null'],
    };
  }

  override isPrimitive(value: any): value is null | undefined | string | number | boolean | Date {
    return value instanceof Date || super.isPrimitive(value);
  }

  override isRegex(value: any): value is RegExp {
    return super.isRegex(value);
  }

  override isEmpty(value: any): value is null | undefined {
    return !(value instanceof Date) && super.isEmpty(value);
  }

  protected override isCustomOperator(key: string): key is '$length' | '$geo' | '$null' {
    return super.isCustomOperator(key);
  }

  public static use(collection: Collection): WeaviateFilterTranslator {
    return new WeaviateFilterTranslator(collection.filter);
  }

  public translate(filter?: VectorFilter): FilterValue<any> | undefined {
    if (this.isEmpty(filter)) return undefined;
    this.validateFilter(filter);

    const entries = Object.entries(filter);
    if (entries.length === 1) {
      const [operator, condition] = entries[0]!;
      if (operator === '$and' && Array.isArray(condition) && condition.length === 0) {
        // i.e. { $and: [] }, which means to scan the entire collection
        return undefined;
      }
    }

    return this.translateNode(filter);
  }

  private isVectorFilter(filter: any): filter is VectorFilter {
    return typeof filter === 'object';
  }

  private translateLogical(operator: LogicalOperator, condition: VectorFilter[]): FilterValue<null> {
    if (this.isEmpty(condition)) throw new Error('Empty logical operator');

    if (condition.length === 0) throw new Error(`Empty condition for logical operator ${operator}`);

    if (operator === '$and') {
      return Filters.and(...condition.map(this.translateNode, this));
    }

    if (operator === '$or') {
      return Filters.or(...condition.map(this.translateNode, this));
    }

    throw new Error(`Logical operator ${operator} not supported`);
  }

  private translateLengthOperator(filter: FilterByProperty<any>, condition: VectorFilter): FilterValue<any> {
    if (this.isEmpty(condition)) throw new Error(`Empty field operator: ${condition}`);
    const entries = Object.entries(condition);
    const filterValues = entries.map(([key, value]) => {
      if (!this.isBasicOperator(key) && !this.isNumericOperator(key)) {
        throw new Error(`Unsupported operator ${key} in $length filter`);
      }
      switch (key) {
        case '$eq':
          return filter.equal(value);
        case '$ne':
          return filter.notEqual(value);
        case '$gt':
          return filter.greaterThan(value);
        case '$gte':
          return filter.greaterOrEqual(value);
        case '$lt':
          return filter.lessThan(value);
        case '$lte':
          return filter.lessOrEqual(value);
        default:
          throw new Error(`Unsupported operator ${key}`);
      }
      throw new Error(`Unsupported operator ${key}`);
    }, this);
    return filterValues.length === 1 ? filterValues[0]! : Filters.and(...filterValues);
  }

  private translateVectorFilter(field: string, condition: VectorFilter) {
    if (this.isEmpty(condition)) throw new Error(`Empty field operator: ${condition}`);
    const entries = Object.entries(condition);
    const filterValues = entries.map(([operator, value]) => {
      if (
        !this.isBasicOperator(operator) &&
        !this.isNumericOperator(operator) &&
        !this.isCustomOperator(operator) &&
        !this.isArrayOperator(operator) &&
        !this.isRegexOperator(operator)
      ) {
        throw new Error(`Unsupported operator ${operator} in ${field} filter`);
      }
      switch (operator) {
        case '$eq':
          return this.filter.byProperty(field).equal(value);
        case '$ne':
          return this.filter.byProperty(field).notEqual(value);
        case '$gt':
          return this.filter.byProperty(field).greaterThan(value);
        case '$gte':
          return this.filter.byProperty(field).greaterOrEqual(value);
        case '$lt':
          return this.filter.byProperty(field).lessThan(value);
        case '$lte':
          return this.filter.byProperty(field).lessOrEqual(value);
        case '$geo':
          if (!value || !value.lat || !value.lon || !value.radius) {
            throw new Error(`Invalid $geo filter: ${JSON.stringify(value)} value for field ${field}`);
          }
          return this.filter
            .byProperty(field)
            .withinGeoRange({ latitude: value.lat, longitude: value.lon, distance: value.radius });
        case '$null':
          return this.filter.byProperty(field).isNull(value);
        case '$all':
          return this.filter.byProperty(field).containsAll(value);
        case '$in':
          return this.filter.byProperty(field).containsAny(value);
        case '$regex':
          return this.filter.byProperty(field).like(value.source);
        case '$length':
          const f = this.filter.byProperty(field, true);
          if (this.isVectorFilter(value)) {
            return this.translateLengthOperator(f, value);
          }
          return f.equal(value);
        default:
          throw new Error(`Unsupported operator ${operator}`);
      }
    }, this);
    return filterValues.length === 1 ? filterValues[0]! : Filters.and(...filterValues);
  }

  private translateNode(filter: VectorFilter): FilterValue<any> {
    if (this.isEmpty(filter)) throw new Error('Empty filter');

    const filterValues = Object.entries(filter).map(([field, condition]) => {
      if (this.isLogicalOperator(field)) {
        return this.translateLogical(field, condition);
      }

      if (this.isPrimitive(condition)) {
        if (condition === null) {
          return this.filter.byProperty(field).isNull(true);
        }
        return this.filter.byProperty(field).equal(condition);
      }

      if (Array.isArray(condition)) {
        if (condition.length === 0) {
          return this.filter.byProperty(field, true).equal(0); // i.e. empty array
        }
        return this.filter.byProperty(field).containsAll(condition);
      }

      if (this.isRegex(condition)) {
        return this.filter.byProperty(field).like(condition.source);
      }

      if (this.isVectorFilter(condition)) {
        return this.translateVectorFilter(field, condition);
      }

      throw new Error(`Unsupported condition for field ${field}`);
    }, this);

    return filterValues.length === 1 ? filterValues[0]! : Filters.and(...filterValues);
  }
}
