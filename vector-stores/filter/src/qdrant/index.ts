// Qdrant's filter format
class QdrantTranslator implements FilterTranslator {
  translate(siftFilter: any): any {
    if (!siftFilter || Object.keys(siftFilter).length === 0) {
      return {};
    }

    return this.convertFilter(siftFilter);
  }

  private convertFilter(filter: any): any {
    const entries = Object.entries(filter);

    // Handle empty filter
    if (entries.length === 0) return {};

    const conditions: any[] = [];

    for (const [key, value] of entries) {
      // Handle logical operators
      if (key === '$or') {
        return { should: value.map((f: any) => this.convertFilter(f)) };
      }
      if (key === '$and') {
        return { must: value.map((f: any) => this.convertFilter(f)) };
      }

      // Handle value operators
      if (typeof value === 'object' && !Array.isArray(value)) {
        const [[operator, operatorValue]] = Object.entries(value);

        // Map Sift operators to Qdrant operators
        switch (operator) {
          case '$eq':
            conditions.push({ key, match: { value: operatorValue } });
            break;
          case '$ne':
            conditions.push({ key, match: { value: operatorValue }, must_not: true });
            break;
          case '$gt':
            conditions.push({ key, range: { gt: operatorValue } });
            break;
          case '$gte':
            conditions.push({ key, range: { gte: operatorValue } });
            break;
          case '$lt':
            conditions.push({ key, range: { lt: operatorValue } });
            break;
          case '$lte':
            conditions.push({ key, range: { lte: operatorValue } });
            break;
          case '$in':
            conditions.push({ key, match: { any: operatorValue } });
            break;
          case '$nin':
            conditions.push({ key, match: { any: operatorValue }, must_not: true });
            break;
        }
      } else {
        // Direct equality
        conditions.push({ key, match: { value } });
      }
    }

    // If multiple conditions, wrap in must (AND)
    return conditions.length > 1 ? { must: conditions } : conditions[0];
  }
}
