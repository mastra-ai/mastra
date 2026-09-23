import type { VectorFilter } from '@mastra/core/vector/filter';

/**
 * Metadata filter accepted by `@mastra/azure-ai-search`.
 *
 * This is the standard Mastra filter shape (`$eq`, `$ne`, `$gt`, `$gte`,
 * `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$and`, `$or`, `$not`), which the
 * translator turns into an Azure AI Search OData `$filter` expression. Raw
 * OData is intentionally not accepted: the same filter selects documents for
 * `updateVector` and `deleteVectors`, so every predicate is built from
 * validated field names and escaped literals.
 */
export type AzureAISearchVectorFilter = VectorFilter;

/**
 * An OData predicate that no document can satisfy. Used wherever a filter is
 * syntactically valid but has nothing it could match (`$or: []`, `$in: []`,
 * `field: []`). Returning `undefined` there would drop the filter entirely and
 * match every document, which is the wrong direction for a delete or update.
 * OData requires one side of a comparison to be a field, so this compares the
 * always-present key field against itself.
 */
const MATCH_NONE = "(id eq '__mastra_none__' and id ne '__mastra_none__')";

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

    const translated = this.translateMastraFilter(filter as Record<string, any>).trim();
    return translated.length > 0 ? translated : undefined;
  }

  private translateMastraFilter(filter: Record<string, any>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and' && Array.isArray(value)) {
        // An empty $and is vacuously true, so it contributes no clause.
        const andConditions = value.map(item => this.translateMastraFilter(item)).filter(Boolean);
        if (andConditions.length > 0) {
          conditions.push(`(${andConditions.join(' and ')})`);
        }
        continue;
      }

      if (key === '$or' && Array.isArray(value)) {
        const orConditions = value.map(item => this.translateMastraFilter(item)).filter(Boolean);
        conditions.push(orConditions.length > 0 ? `(${orConditions.join(' or ')})` : MATCH_NONE);
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
      return [this.formatInClause(field, value)];
    }

    if (value === null || value === undefined || typeof value !== 'object' || value instanceof Date) {
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
          if (!Array.isArray(operatorValue)) {
            throw new Error(`$in on field '${field}' requires an array`);
          }
          conditions.push(this.formatInClause(field, operatorValue));
          break;
        case '$nin':
          if (!Array.isArray(operatorValue)) {
            throw new Error(`$nin on field '${field}' requires an array`);
          }
          // "not in nothing" is true for every document, so it adds no clause.
          if (operatorValue.length > 0) {
            conditions.push(`not ${this.formatInClause(field, operatorValue)}`);
          }
          break;
        case '$exists':
          conditions.push(`${this.escapeFieldName(field)} ${operatorValue ? 'ne' : 'eq'} null`);
          break;
        case '$not': {
          const negatedConditions = this.translateMastraFieldCondition(field, operatorValue);
          if (negatedConditions.length > 0) {
            conditions.push(`not (${negatedConditions.join(' and ')})`);
          }
          break;
        }
        default:
          throw new Error(
            `Unsupported filter operator '${operator}' on field '${field}'. Azure AI Search supports $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $not.`,
          );
      }
    }
    return conditions;
  }

  /**
   * Builds a membership check as an OR-chain of equality comparisons.
   * OData's `in` keyword is not a real operator in Azure AI Search's filter
   * syntax (it only exists as the `search.in()` function, which needs its own
   * comma-escaping for values that may contain the separator), so membership
   * is expressed the portable way: `(field eq v1 or field eq v2 or ...)`.
   * An empty set can match nothing.
   */
  private formatInClause(field: string, values: any[]): string {
    const escapedField = this.escapeFieldName(field);
    if (values.length === 0) {
      return MATCH_NONE;
    }
    return `(${values.map(v => `${escapedField} eq ${this.formatValue(v)}`).join(' or ')})`;
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
    // Azure AI Search OData uses unquoted field paths (e.g., Address/City)
    // Validate field names to prevent OData injection
    if (!/^[a-zA-Z_][\w/]*$/.test(field)) {
      throw new Error(`Invalid field name for OData filter: '${field}'`);
    }
    return field;
  }
}
