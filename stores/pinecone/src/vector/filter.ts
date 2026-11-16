import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  VectorFilter,
  OperatorSupport,
  OperatorValueMap,
  LogicalOperatorValueMap,
  BlacklistedRootOperators,
  QueryOperator,
  FilterValue,
  OperatorCondition,
} from '@mastra/core/vector/filter';

type InitialOperatorValueMap = Omit<OperatorValueMap, '$regex' | '$options' | '$elemMatch' | '$all'> & {
  $contains: string;
  $gt: number | Date;
  $gte: number | Date;
  $lt: number | Date;
  $lte: number | Date;
};

type PineconeOperatorValueMap = InitialOperatorValueMap & {
  $all: OperatorCondition<keyof InitialOperatorValueMap, InitialOperatorValueMap>[] | FilterValue[];
};
type PineconeLogicalOperatorValueMap = Omit<LogicalOperatorValueMap, '$not' | '$nor'>;

type PineconeBlacklisted = BlacklistedRootOperators | '$not' | '$nor';

export type PineconeVectorFilter = VectorFilter<
  keyof PineconeOperatorValueMap,
  PineconeOperatorValueMap,
  PineconeLogicalOperatorValueMap,
  PineconeBlacklisted
>;

export class PineconeFilterTranslator extends BaseFilterTranslator<PineconeVectorFilter> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or'],
      array: ['$in', '$all', '$nin'],
      element: ['$exists'],
      regex: [],
      custom: [],
    };
  }

  translate(filter?: PineconeVectorFilter): PineconeVectorFilter {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter);
    return this.translateNode(filter);
  }

  private translateNode(node: PineconeVectorFilter, currentPath: string = ''): any {
    if (this.isRegex(node)) {
      throw new Error('Regex is not supported in Pinecone');
    }
    if (this.isPrimitive(node)) return this.normalizeComparisonValue(node);
    if (Array.isArray(node)) return { $in: this.normalizeArrayValues(node) };

    const entries = Object.entries(node as Record<string, any>);
    const firstEntry = entries[0];

    // Handle single operator case
    if (entries.length === 1 && firstEntry && this.isOperator(firstEntry[0])) {
      const [operator, value] = firstEntry;
      const translated = this.translateOperator(operator, value, currentPath);
      return this.isLogicalOperator(operator) ? { [operator]: translated } : translated;
    }

    // Process each entry
    const result: Record<string, any> = {};
    // $all becomes an $and of $in clauses, so it can't share an object with sibling conditions
    const allConditions: any[] = [];

    for (const [key, value] of entries) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (this.isOperator(key)) {
        result[key] = this.translateOperator(key, value, currentPath);
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested $all
        if (Object.keys(value).length === 1 && '$all' in value) {
          const translated = this.translateNode(value, newPath);
          if (translated.$and) {
            allConditions.push(...translated.$and);
            continue;
          }
        }

        // Check if the nested object contains operators
        if (Object.keys(value).length === 0) {
          result[newPath] = this.translateNode(value);
        } else {
          const hasOperators = Object.keys(value).some(k => this.isOperator(k));
          if (hasOperators) {
            // For objects with operators, normalize each operator value
            const normalizedValue: Record<string, any> = {};
            for (const [op, opValue] of Object.entries(value)) {
              normalizedValue[op] = this.isOperator(op) ? this.translateOperator(op, opValue) : opValue;
            }
            result[newPath] = normalizedValue;
          } else {
            // For objects without operators, flatten them
            const flattened = this.translateNode(value, newPath);
            if (flattened.$and) {
              // Only an $all inside the nested object produces $and here, since operator objects take the branch above
              allConditions.push(...flattened.$and);
            } else {
              Object.assign(result, flattened);
            }
          }
        }
      } else {
        result[newPath] = this.translateNode(value);
      }
    }

    if (allConditions.length === 0) return result;
    return { $and: Object.keys(result).length > 0 ? [result, ...allConditions] : allConditions };
  }

  private translateOperator(operator: QueryOperator, value: any, currentPath: string = ''): any {
    // Handle $all specially
    if (operator === '$all') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('A non-empty array is required for the $all operator');
      }

      return this.simulateAllOperator(currentPath, value);
    }

    // Handle logical operators
    if (this.isLogicalOperator(operator)) {
      return Array.isArray(value) ? value.map(item => this.translateNode(item)) : this.translateNode(value);
    }

    // Handle comparison and element operators
    return this.normalizeComparisonValue(value);
  }
}
