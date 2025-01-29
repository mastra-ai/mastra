// Pinecone's filter format
class PineconeTranslator implements FilterTranslator {
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
        return { $or: value.map((f: any) => this.convertFilter(f)) };
      }
      if (key === '$and') {
        return { $and: value.map((f: any) => this.convertFilter(f)) };
      }

      // Handle value operators
      if (typeof value === 'object' && !Array.isArray(value)) {
        const [[operator, operatorValue]] = Object.entries(value);
        // Pinecone uses the same operator syntax as Sift for most operators
        conditions.push({ [key]: { [operator]: operatorValue } });
      } else {
        // Direct equality
        conditions.push({ [key]: { $eq: value } });
      }
    }

    // If multiple conditions, wrap in $and
    return conditions.length > 1 ? { $and: conditions } : conditions[0];
  }
}
