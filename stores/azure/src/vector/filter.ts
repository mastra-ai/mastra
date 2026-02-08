// Filter type definitions for Azure AI Search

// Standard filterable fields in Azure AI Search documents
export interface AzureAISearchFields {
  category?: string;
  price?: number;
  content?: string;
  inStock?: boolean;
  rating?: number;
  tags?: string;
}

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
export interface AzureAISearchVectorFilter {
  /** Raw OData filter string */
  $filter?: string;

  /** Logical AND operation */
  and?: AzureAISearchVectorFilter[];

  /** Logical OR operation */
  or?: AzureAISearchVectorFilter[];

  /** Logical NOT operation */
  not?: AzureAISearchVectorFilter;

  /** Equality comparison - supports category and other string fields */
  eq?: Partial<AzureAISearchFields> & Record<string, any>;

  /** Not equal comparison */
  ne?: Partial<AzureAISearchFields> & Record<string, any>;

  /** Greater than comparison - supports price, rating and other numeric fields */
  gt?: Partial<Pick<AzureAISearchFields, 'price' | 'rating'>> & Record<string, number | Date>;

  /** Greater than or equal comparison */
  ge?: Partial<Pick<AzureAISearchFields, 'price' | 'rating'>> & Record<string, number | Date>;

  /** Less than comparison */
  lt?: Partial<Pick<AzureAISearchFields, 'price' | 'rating'>> & Record<string, number | Date>;

  /** Less than or equal comparison */
  le?: Partial<Pick<AzureAISearchFields, 'price' | 'rating'>> & Record<string, number | Date>;

  /** Contains operation for strings */
  contains?: Partial<Pick<AzureAISearchFields, 'category' | 'content' | 'tags'>> & Record<string, string>;

  /** Starts with operation for strings */
  startsWith?: Partial<Pick<AzureAISearchFields, 'category' | 'content'>> & Record<string, string>;

  /** Ends with operation for strings */
  endsWith?: Partial<Pick<AzureAISearchFields, 'category' | 'content'>> & Record<string, string>;

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

    // If raw $filter is provided, use it directly
    if (filter.$filter) {
      return filter.$filter;
    }

    const translated = this.translateFilter(filter).trim();
    return translated.length > 0 ? translated : undefined;
  }

  private translateFilter(filter: AzureAISearchVectorFilter): string {
    const conditions: string[] = [];

    // Handle logical operations
    if (filter.and) {
      const andConditions = filter.and.map(f => this.translateFilter(f)).filter(Boolean);
      if (andConditions.length > 0) {
        conditions.push(`(${andConditions.join(' and ')})`);
      }
    }

    if (filter.or) {
      const orConditions = filter.or.map(f => this.translateFilter(f)).filter(Boolean);
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(' or ')})`);
      }
    }

    if (filter.not) {
      const notCondition = this.translateFilter(filter.not);
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
      conditions.push(`${filter.any.collection}/any(${filter.any.predicate})`);
    }

    if (filter.all) {
      conditions.push(`${filter.all.collection}/all(${filter.all.predicate})`);
    }

    return conditions.join(' and ');
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

  private escapeFieldName(field: string): string {
    // Azure AI Search OData uses unquoted field paths (e.g., Address/City, not 'Address/City')
    // Field names should be valid identifiers or slash-separated paths without quoting
    return field;
  }
}
