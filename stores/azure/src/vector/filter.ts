import type { VectorFilter } from '@mastra/core/vector/filter';

// Filter type definitions for Azure AI Search

/**
 * Azure AI Search vector filter interface that supports OData syntax
 *
 * Azure AI Search uses OData query syntax for filtering:
 * - Comparison: eq, ne, gt, ge, lt, le
 * - Logical: and, or, not
 * - Collection operations: any, all
 * - String functions: startswith, endswith, contains
 * - Mathematical functions: geo.distance, etc.
 *
 * @example
 * ```typescript
 * const filter: AzureAISearchVectorFilter = {
 *   $filter: "category eq 'electronics' and price lt 100"
 * };
 *
 * // Or using nested object syntax:
 * const complexFilter: AzureAISearchVectorFilter = {
 *   and: [
 *     { eq: { category: 'electronics' } },
 *     { lt: { price: 100 } }
 *   ]
 * };
 * ```
 */
export interface AzureAISearchLegacyFilter {
  /** Raw OData filter string */
  $filter?: string;

  /** Logical AND operation */
  and?: AzureAISearchLegacyFilter[];

  /** Logical OR operation */
  or?: AzureAISearchLegacyFilter[];

  /** Logical NOT operation */
  not?: AzureAISearchLegacyFilter;

  /** Equality comparison */
  eq?: Record<string, any>;

  /** Not equal comparison */
  ne?: Record<string, any>;

  /** Greater than comparison */
  gt?: Record<string, number | Date>;

  /** Greater than or equal comparison */
  ge?: Record<string, number | Date>;

  /** Less than comparison */
  lt?: Record<string, number | Date>;

  /** Less than or equal comparison */
  le?: Record<string, number | Date>;

  /** Contains operation for strings */
  contains?: Record<string, string>;

  /** Starts with operation for strings */
  startsWith?: Record<string, string>;

  /** Ends with operation for strings */
  endsWith?: Record<string, string>;

  /** Collection any operation */
  any?: {
    collection: string;
    /** Raw OData lambda predicate (e.g., "x: x/name eq 'value'") - field references must be prefixed with lambda variable */
    predicate: string;
  };

  /** Collection all operation */
  all?: {
    collection: string;
    /** Raw OData lambda predicate (e.g., "x: x/name eq 'value'") - field references must be prefixed with lambda variable */
    predicate: string;
  };
}

export type AzureAISearchVectorFilter = AzureAISearchLegacyFilter | VectorFilter;

/**
 * Translates Mastra vector filters to Azure AI Search OData filter syntax
 */
export class AzureAISearchFilterTranslator {
  /**
   * Translates a filter object to OData filter string
   * @param filter - The filter to translate
   * @returns OData filter string or undefined if no filter
   */
  translate(filter?: AzureAISearchVectorFilter): string | undefined {
    if (!filter) {
      return undefined;
    }

    const filterRecord = filter as Record<string, any>;

    // If raw $filter is provided, use it directly
    if (typeof filterRecord.$filter === 'string') {
      return filterRecord.$filter;
    }

    const translated = this.isMastraFilterSyntax(filterRecord)
      ? this.translateMastraFilter(filterRecord).trim()
      : this.translateLegacyFilter(filterRecord as AzureAISearchLegacyFilter).trim();

    return translated.length > 0 ? translated : undefined;
  }

  private static readonly LEGACY_OPERATOR_KEYS = new Set([
    'and', 'or', 'not', 'eq', 'ne', 'gt', 'ge', 'lt', 'le',
    'contains', 'startsWith', 'endsWith', 'any', 'all', '$filter',
  ]);

  private isMastraFilterSyntax(filter: Record<string, any>): boolean {
    const keys = Object.keys(filter);
    return !keys.some(key => AzureAISearchFilterTranslator.LEGACY_OPERATOR_KEYS.has(key));
  }

  private translateLegacyFilter(filter: AzureAISearchLegacyFilter): string {
    const conditions: string[] = [];

    // Handle logical operations
    if (filter.and) {
      const andConditions = filter.and.map(f => this.translateLegacyFilter(f)).filter(Boolean);
      if (andConditions.length > 0) {
        conditions.push(`(${andConditions.join(' and ')})`);
      }
    }

    if (filter.or) {
      const orConditions = filter.or.map(f => this.translateLegacyFilter(f)).filter(Boolean);
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(' or ')})`);
      }
    }

    if (filter.not) {
      const notCondition = this.translateLegacyFilter(filter.not);
      if (notCondition) {
        conditions.push(`not (${notCondition})`);
      }
    }

    // Handle comparison operations
    if (filter.eq) {
      conditions.push(...this.translateComparison(filter.eq, 'eq'));
    }

    if (filter.ne) {
      conditions.push(...this.translateComparison(filter.ne, 'ne'));
    }

    if (filter.gt) {
      conditions.push(...this.translateComparison(filter.gt, 'gt'));
    }

    if (filter.ge) {
      conditions.push(...this.translateComparison(filter.ge, 'ge'));
    }

    if (filter.lt) {
      conditions.push(...this.translateComparison(filter.lt, 'lt'));
    }

    if (filter.le) {
      conditions.push(...this.translateComparison(filter.le, 'le'));
    }

    // Handle string operations
    if (filter.contains) {
      conditions.push(...this.translateStringOperation(filter.contains, 'contains'));
    }

    if (filter.startsWith) {
      conditions.push(...this.translateStringOperation(filter.startsWith, 'startswith'));
    }

    if (filter.endsWith) {
      conditions.push(...this.translateStringOperation(filter.endsWith, 'endswith'));
    }

    // Handle collection operations
    // Note: any/all require raw OData lambda predicates with proper variable scoping
    // Example: { any: { collection: 'stores', predicate: 's: s/name eq \'Flagship\'' } }
    if (filter.any) {
      this.validateCollectionName(filter.any.collection);
      conditions.push(`${filter.any.collection}/any(${filter.any.predicate})`);
    }

    if (filter.all) {
      this.validateCollectionName(filter.all.collection);
      conditions.push(`${filter.all.collection}/all(${filter.all.predicate})`);
    }

    return conditions.join(' and ');
  }

  private translateMastraFilter(filter: Record<string, any>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and' && Array.isArray(value)) {
        const andConditions = value.map(item => this.translateMastraFilter(item)).filter(Boolean);
        if (andConditions.length > 0) {
          conditions.push(`(${andConditions.join(' and ')})`);
        }
        continue;
      }

      if (key === '$or' && Array.isArray(value)) {
        const orConditions = value.map(item => this.translateMastraFilter(item)).filter(Boolean);
        if (orConditions.length > 0) {
          conditions.push(`(${orConditions.join(' or ')})`);
        }
        continue;
      }

      if (key === '$not' && typeof value === 'object' && value !== null) {
        const notCondition = this.translateMastraFilter(value);
        if (notCondition) {
          conditions.push(`not (${notCondition})`);
        }
        continue;
      }

      if (key.startsWith('$')) {
        throw new Error(`Unsupported filter operator '${key}'. Azure AI Search supports $and, $or, and $not.`);
      }

      conditions.push(...this.translateMastraFieldCondition(key, value));
    }

    return conditions.join(' and ');
  }

  private translateMastraFieldCondition(field: string, value: any): string[] {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [];
      }
      const list = value.map(v => this.formatValue(v)).join(', ');
      return [`${this.escapeFieldName(field)} in (${list})`];
    }

    if (value === null || value === undefined || typeof value !== 'object') {
      return [`${this.escapeFieldName(field)} eq ${this.formatValue(value)}`];
    }

    const conditions: string[] = [];
    for (const [operator, operatorValue] of Object.entries(value)) {
      switch (operator) {
        case '$eq':
          conditions.push(`${this.escapeFieldName(field)} eq ${this.formatValue(operatorValue)}`);
          break;
        case '$ne':
          conditions.push(`${this.escapeFieldName(field)} ne ${this.formatValue(operatorValue)}`);
          break;
        case '$gt':
          conditions.push(`${this.escapeFieldName(field)} gt ${this.formatValue(operatorValue)}`);
          break;
        case '$gte':
          conditions.push(`${this.escapeFieldName(field)} ge ${this.formatValue(operatorValue)}`);
          break;
        case '$lt':
          conditions.push(`${this.escapeFieldName(field)} lt ${this.formatValue(operatorValue)}`);
          break;
        case '$lte':
          conditions.push(`${this.escapeFieldName(field)} le ${this.formatValue(operatorValue)}`);
          break;
        case '$in':
          if (Array.isArray(operatorValue) && operatorValue.length > 0) {
            const list = operatorValue.map(v => this.formatValue(v)).join(', ');
            conditions.push(`${this.escapeFieldName(field)} in (${list})`);
          }
          break;
        case '$nin':
          if (Array.isArray(operatorValue) && operatorValue.length > 0) {
            const list = operatorValue.map(v => this.formatValue(v)).join(', ');
            conditions.push(`not (${this.escapeFieldName(field)} in (${list}))`);
          }
          break;
        case '$exists':
          conditions.push(`${this.escapeFieldName(field)} ${operatorValue ? 'ne' : 'eq'} null`);
          break;
        default:
          break;
      }
    }
    return conditions;
  }

  private translateComparison(comparison: Record<string, any>, operator: string): string[] {
    return Object.entries(comparison).map(([field, value]) => {
      const formattedValue = this.formatValue(value);
      return `${this.escapeFieldName(field)} ${operator} ${formattedValue}`;
    });
  }

  private translateStringOperation(operation: Record<string, string>, functionName: string): string[] {
    return Object.entries(operation).map(([field, value]) => {
      const escapedField = this.escapeFieldName(field);
      const formattedValue = this.formatValue(value);

      // Azure AI Search doesn't support contains() in OData filters
      // Use search.ismatch() instead for full-text search scenarios
      if (functionName === 'contains') {
        // For tags and other searchable fields, use search.ismatch()
        // Note: search.ismatch() requires field name in quotes (unlike regular OData filters)
        return `search.ismatch(${formattedValue}, '${field}')`;
      }

      return `${functionName}(${escapedField}, ${formattedValue})`;
    });
  }
  private formatValue(value: any): string {
    if (typeof value === 'string') {
      // Escape single quotes in strings
      const escapedValue = value.replace(/'/g, "''");
      return `'${escapedValue}'`;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'boolean') {
      return value.toString();
    }

    if (value === null || value === undefined) {
      return 'null';
    }

    return String(value);
  }

  private validateCollectionName(collection: string): void {
    if (!/^[a-zA-Z_][\w/]*$/.test(collection)) {
      throw new Error(`Invalid collection name for OData lambda: '${collection}'`);
    }
  }

  private escapeFieldName(field: string): string {
    // Azure AI Search OData uses unquoted field paths (e.g., Address/City)
    // Validate field names to prevent OData injection
    if (!/^[a-zA-Z_][\w/]*$/.test(field)) {
      throw new Error(`Invalid field name for OData filter: '${field}'`);
    }
    return field;
  }
}
