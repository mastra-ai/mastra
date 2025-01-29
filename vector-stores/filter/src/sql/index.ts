class SQLTranslator implements FilterTranslator {
  translate(siftFilter: any): Filter {
    if (!siftFilter || Object.keys(siftFilter).length === 0) {
      return {};
    }
    return this.convertToFilter(siftFilter);
  }

  private convertToFilter(siftFilter: any): Filter {
    const result: Filter = {};

    for (const [key, value] of Object.entries(siftFilter)) {
      // Handle logical operators
      if (key === '$or' || key === '$and') {
        result[key] = value.map((f: any) => this.convertToFilter(f));
        continue;
      }

      // Handle operators
      if (typeof value === 'object' && !Array.isArray(value)) {
        const [[operator, operatorValue]] = Object.entries(value);

        // Map Sift operators to our operators
        switch (operator) {
          // Equality
          case '$eq':
            result[key] = operatorValue;
            break;
          case '$ne':
            result[key] = { neq: operatorValue };
            break;

          // Numeric comparisons
          case '$gt':
            result[key] = { gt: operatorValue };
            break;
          case '$gte':
            result[key] = { gte: operatorValue };
            break;
          case '$lt':
            result[key] = { lt: operatorValue };
            break;
          case '$lte':
            result[key] = { lte: operatorValue };
            break;

          // Array operations
          case '$in':
            result[key] = { in: operatorValue };
            break;
          case '$nin':
            result[key] = { nin: operatorValue };
            break;

          // Text operations
          case '$regex':
            result[key] = { like: `%${operatorValue}%` };
            break;
          case '$contains':
            result[key] = { like: `%${operatorValue}%` };
            break;
          case '$startsWith':
            result[key] = { like: `${operatorValue}%` };
            break;
          case '$endsWith':
            result[key] = { like: `%${operatorValue}` };
            break;

          // Case insensitive text operations
          case '$iregex':
            result[key] = { ilike: `%${operatorValue}%` };
            break;
          case '$icontains':
            result[key] = { ilike: `%${operatorValue}%` };
            break;
          case '$istartsWith':
            result[key] = { ilike: `${operatorValue}%` };
            break;
          case '$iendsWith':
            result[key] = { ilike: `%${operatorValue}` };
            break;

          default:
            throw new Error(`Unsupported operator: ${operator}`);
        }
        continue;
      }

      // Direct equality
      result[key] = value;
    }

    return result;
  }
}
