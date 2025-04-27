import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type { VectorFilter } from '@mastra/core/vector/filter';

export class MilvusFilterTranslator extends BaseFilterTranslator {
  // MongoDB to Milvus operator mapping
  private operatorMap: Record<string, string> = {
    $eq: '==',
    $ne: '!=',
    $gt: '>',
    $gte: '>=',
    $lt: '<',
    $lte: '<=',
    $like: 'LIKE',
    $notLike: 'NOT LIKE',
    $regex: 'regexp_match',
  };

  // Supported logical operators
  private readonly supportedLogicalOperators = ['$and', '$or'];

  // List of supported operators
  private readonly supportedOperators = [
    '$eq',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$like',
    '$notLike',
    '$regex',
  ];

  // Fields that should not be treated as metadata
  private readonly nonMetadataFields = ['id', 'vectors'];

  translate(filter: VectorFilter): string {
    if (!filter || Object.keys(filter).length === 0) {
      return '';
    }

    return this.processFilter(filter);
  }

  private processFilter(filter: VectorFilter, parentKey = ''): string {
    // Handle logical operators first
    if (filter && '$and' in filter) {
      return this.processLogicalOperator(filter.$and as VectorFilter[], 'AND');
    }

    if (filter && '$or' in filter) {
      return this.processLogicalOperator(filter.$or as VectorFilter[], 'OR');
    }

    // Process regular field conditions
    const conditions: string[] = [];

    if (filter) {
      for (const [key, value] of Object.entries(filter as Record<string, any>)) {
        // Check for top-level operator (invalid usage)
        if (key.startsWith('$') && !this.supportedLogicalOperators.includes(key)) {
          throw new Error(`Invalid top-level operator: ${key}`);
        }

        // Check for invalid nested field with dot notation
        if (key.includes('.') && !this.nonMetadataFields.some(field => key.startsWith(`${field}.`))) {
          throw new Error(
            `Nested fields with dot notation are not supported in Milvus filters. Use a flat metadata structure instead: ${key}`,
          );
        }

        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        // Process the key to determine if it needs to be wrapped as metadata
        const processedKey = this.processKey(fullKey);
        conditions.push(this.processCondition(processedKey, value));
      }
    }

    return conditions.join(' AND ');
  }

  private processKey(key: string): string {
    // If the key already has the metadata["..."] format, leave it as is
    if (key.startsWith('metadata[')) {
      return key;
    }

    // If the key is in the non-metadata fields list, leave it as is
    if (this.nonMetadataFields.includes(key)) {
      return key;
    }

    // If the key is nested (has dots), it's an error since we already validated above
    if (key.includes('.')) {
      const parts = key.split('.');

      // If the first part is a non-metadata field, leave it as is (e.g., id.something)
      if (parts[0] && this.nonMetadataFields.includes(parts[0])) {
        return key;
      }

      // We should not reach here due to the validation in processFilter
      throw new Error(`Nested fields with dot notation are not supported in Milvus filters: ${key}`);
    }

    // For all other fields, wrap them as metadata
    return `metadata["${key}"]`;
  }

  private processLogicalOperator(filters: VectorFilter[], operator: string): string {
    if (!filters || !filters.length) {
      return '';
    }

    const conditions = filters.map(filter => this.processFilter(filter || {}));

    // Filter out empty conditions
    const validConditions = conditions.filter(condition => condition !== '');

    if (validConditions.length === 0) {
      return '';
    }

    // Add parentheses if there are multiple conditions to ensure proper precedence
    // but only for nested logical operators
    const needsParentheses = validConditions.length > 1 && operator === 'OR';
    const joinedConditions = validConditions.join(` ${operator} `);

    return needsParentheses ? `(${joinedConditions})` : joinedConditions;
  }

  private processCondition(key: string, value: any): string {
    // Handle nested objects by recursion - but validate no dot notation in keys
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Check if it's an operator object
      const isOperatorObject = Object.keys(value).some(k => k.startsWith('$'));

      if (isOperatorObject) {
        return this.processOperators(key, value);
      }

      // Nested objects aren't allowed in Milvus (except for operator objects)
      throw new Error(`Nested objects are not supported in Milvus filters. Use a flat metadata structure: ${key}`);
    }

    // Handle different value types
    return this.formatSimpleCondition(key, value);
  }

  private processOperators(key: string, operators: Record<string, any>): string {
    const conditions: string[] = [];

    for (const [op, value] of Object.entries(operators)) {
      if (!this.supportedOperators.includes(op)) {
        throw new Error(`Unsupported operator: ${op}`);
      }

      // Special case for $in operator
      if (op === '$in') {
        conditions.push(this.formatInCondition(key, value));
        continue;
      }

      // Special case for $regex operator
      if (op === '$regex') {
        conditions.push(`regexp_match(${this.escapeFieldName(key)}, '${value}')`);
        continue;
      }

      // Special case for $ne operator with null value
      if (op === '$ne' && value === null) {
        conditions.push(`${this.escapeFieldName(key)} IS NOT NULL`);
        continue;
      }

      // Special case for $eq operator with null value
      if (op === '$eq' && value === null) {
        conditions.push(`${this.escapeFieldName(key)} IS NULL`);
        continue;
      }

      // Regular operators
      const milvusOperator = this.operatorMap[op];
      conditions.push(`${this.escapeFieldName(key)} ${milvusOperator} ${this.formatValue(value)}`);
    }

    return conditions.join(' AND ');
  }

  private formatSimpleCondition(key: string, value: any): string {
    // Handle null values
    if (value === null) {
      return `${this.escapeFieldName(key)} IS NULL`;
    }

    // Handle array values (convert to IN operator)
    if (Array.isArray(value)) {
      return this.formatInCondition(key, value);
    }

    // Simple equality
    return `${this.escapeFieldName(key)} == ${this.formatValue(value)}`;
  }

  private formatInCondition(key: string, values: any[]): string {
    if (!values || values.length === 0) {
      return 'false'; // Empty IN is usually false
    }

    const formattedValues = values.map(v => this.formatValue(v)).join(', ');
    return `${this.escapeFieldName(key)} IN [${formattedValues}]`;
  }

  private formatValue(value: any): string {
    if (value === null) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      // Escape single quotes in strings by doubling them
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'boolean') {
      return value.toString();
    }

    if (value instanceof Date) {
      return `timestamp '${value.toISOString()}'`;
    }

    return value.toString();
  }

  private escapeFieldName(field: string): string {
    // Check for invalid field names
    if (field.includes('..')) {
      throw new Error('Field names containing periods must be properly nested. Consecutive periods are not allowed.');
    }

    // No backtick escaping for Milvus - field names are already properly formatted with metadata["field"]
    return field;
  }
}
