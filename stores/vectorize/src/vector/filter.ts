import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  VectorFilter,
  OperatorSupport,
  OperatorValueMap,
  LogicalOperatorValueMap,
  BlacklistedRootOperators,
} from '@mastra/core/vector/filter';

type VectorizeOperatorValueMap = Omit<OperatorValueMap, '$regex' | '$options' | '$exists' | '$elemMatch' | '$all'>;

type VectorizeLogicalOperatorValueMap = Omit<LogicalOperatorValueMap, '$nor' | '$not' | '$and' | '$or'>;

type VectorizeBlacklistedRootOperators = BlacklistedRootOperators | '$nor' | '$not' | '$and' | '$or';

export type VectorizeVectorFilter = VectorFilter<
  keyof VectorizeOperatorValueMap,
  VectorizeOperatorValueMap,
  VectorizeLogicalOperatorValueMap,
  VectorizeBlacklistedRootOperators
>;

/** Vectorize runs several operators on one field only as a single lower plus upper bound. */
const isRangePair = (operators: string[]): boolean =>
  operators.length === 2 &&
  operators.filter(operator => operator === '$gt' || operator === '$gte').length === 1 &&
  operators.filter(operator => operator === '$lt' || operator === '$lte').length === 1;

export class VectorizeFilterTranslator extends BaseFilterTranslator<VectorizeVectorFilter> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: [],
      array: ['$in', '$nin'],
      element: [],
      regex: [],
      custom: [],
    };
  }

  translate(filter?: VectorizeVectorFilter): VectorizeVectorFilter {
    if (this.isEmpty(filter)) return filter;
    const clauses = this.topLevelAndClauses(filter);
    if (clauses) return this.mergeClauses(clauses);
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  /**
   * The clauses of a filter that is only `{ $and: [...] }`, as Memory.recall() and SemanticRecall
   * send to combine the scope with a user filter. Vectorize has no `$and`, but it ANDs top-level
   * keys, so these clauses can be merged into one filter.
   */
  private topLevelAndClauses(filter: unknown): VectorizeVectorFilter[] | undefined {
    if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) return undefined;
    const keys = Object.keys(filter);
    const clauses = (filter as { $and?: unknown }).$and;
    if (keys.length !== 1 || keys[0] !== '$and' || !Array.isArray(clauses)) return undefined;
    return clauses as VectorizeVectorFilter[];
  }

  private mergeClauses(clauses: VectorizeVectorFilter[]): VectorizeVectorFilter {
    // A Map, so field names like `constructor` are never read from Object.prototype.
    const merged = new Map<string, Record<string, unknown>>();
    for (const clause of clauses) {
      if (clause === null || clause === undefined) continue;
      if (typeof clause !== 'object' || Array.isArray(clause)) {
        throw new Error('Vectorize $and clause must be a filter object');
      }
      if (this.isEmpty(clause)) continue;
      this.validateFilter(clause);
      const translated = this.translateNode(clause) as Record<string, Record<string, unknown>>;
      for (const [field, condition] of Object.entries(translated)) {
        const existing = merged.get(field);
        if (existing) {
          const operators = [...Object.keys(existing), ...Object.keys(condition)];
          if (new Set(operators).size !== operators.length || !isRangePair(operators)) {
            throw new Error(
              `Vectorize $and clauses on ${field} can only combine one lower and one upper bound; got ${operators.join(', ')}`,
            );
          }
        }
        merged.set(field, { ...existing, ...condition });
      }
    }
    const result: Record<string, Record<string, unknown>> = {};
    for (const [field, condition] of merged) {
      Object.defineProperty(result, field, { value: condition, enumerable: true, writable: true, configurable: true });
    }
    return result as VectorizeVectorFilter;
  }

  private translateNode(node: VectorizeVectorFilter, currentPath: string = ''): any {
    if (this.isRegex(node)) {
      throw new Error('Regex is not supported in Vectorize');
    }
    if (this.isPrimitive(node)) return { $eq: this.normalizeComparisonValue(node) };
    if (Array.isArray(node)) return { $in: this.normalizeArrayValues(node) };

    const entries = Object.entries(node as Record<string, any>);
    const firstEntry = entries[0];

    // Handle single operator case
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      return { [operator]: this.normalizeComparisonValue(value) };
    }

    // Process each entry
    const result: Record<string, any> = {};
    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        result[key] = this.normalizeComparisonValue(value);
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (Object.keys(value).length === 0) {
          result[newPath] = this.translateNode(value);
          continue;
        }

        // Check if the nested object contains operators
        const hasOperators = Object.keys(value).some(k => this.isOperator(k));
        if (hasOperators) {
          result[newPath] = this.translateNode(value);
        } else {
          // For objects without operators, flatten them
          Object.assign(result, this.translateNode(value, newPath));
        }
      } else {
        result[newPath] = this.translateNode(value);
      }
    }

    return result;
  }
}
