import { BaseFilterTranslator } from '@mastra/core/filter';
import type { FieldCondition, Filter, LogicalOperator, OperatorSupport } from '@mastra/core/filter';

/**
 * Translates MongoDB-style filters to Qdrant compatible filters.
 *
 * Key transformations:
 * - $and -> must
 * - $or -> should
 * - $not -> must_not
 * - { field: { $op: value } } -> { key: field, match/range: { value/gt/lt: value } }
 *
 * Custom operators (Qdrant-specific):
 * - $count -> values_count (array length/value count)
 * - $geo -> geo filters (box, radius, polygon)
 * - $hasId -> has_id filter
 * - $nested -> nested object filters
 * - $hasVector -> vector existence check
 * - $datetime -> RFC 3339 datetime range
 * - $null -> is_null check
 * - $empty -> is_empty check
 */
export class QdrantFilterTranslator extends BaseFilterTranslator {
  protected override isLogicalOperator(key: string): key is LogicalOperator {
    return super.isLogicalOperator(key) || key === '$hasId' || key === '$hasVector';
  }

  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or', '$not'],
      array: ['$in', '$nin'],
      regex: ['$regex'],
      custom: ['$count', '$geo', '$nested', '$datetime', '$null', '$empty', '$hasId', '$hasVector'],
    };
  }

  translate(filter?: Filter): Filter | undefined {
    if (this.isEmpty(filter)) return filter;
    this.validateFilter(filter as Filter);
    return this.translateNode(filter);
  }

  private createCondition(type: string, value: any, fieldKey?: string) {
    const condition = { [type]: value };
    return fieldKey ? { key: fieldKey, ...condition } : condition;
  }

  private translateNode(node: Filter | FieldCondition, isNested: boolean = false, fieldKey?: string): any {
    if (!this.isEmpty(node) && typeof node === 'object' && 'must' in node) {
      return node;
    }

    if (this.isPrimitive(node)) {
      if (node === null) {
        return { is_null: { key: fieldKey } };
      }
      return this.createCondition('match', { value: this.normalizeComparisonValue(node) }, fieldKey);
    }

    if (this.isRegex(node)) {
      throw new Error('Direct regex pattern format is not supported in Qdrant');
    }

    if (Array.isArray(node)) {
      return node.length === 0
        ? { is_empty: { key: fieldKey } }
        : this.createCondition('match', { any: this.normalizeArrayValues(node) }, fieldKey);
    }

    const entries = Object.entries(node as Record<string, any>);

    // Handle logical operators first
    const logicalResult = this.handleLogicalOperators(entries, isNested);
    if (logicalResult) {
      return logicalResult;
    }

    // Handle field conditions
    const { conditions, range, matchCondition } = this.handleFieldConditions(entries, fieldKey);

    if (Object.keys(range).length > 0) {
      conditions.push({ key: fieldKey, range });
    }

    if (matchCondition) {
      conditions.push({ key: fieldKey, match: matchCondition });
    }

    return this.buildFinalConditions(conditions, isNested);
  }

  private buildFinalConditions(conditions: any[], isNested: boolean): any {
    if (conditions.length === 0) {
      return {};
    } else if (conditions.length === 1 && isNested) {
      return conditions[0];
    } else {
      return { must: conditions };
    }
  }

  private handleLogicalOperators(entries: [string, any][], isNested: boolean): any | null {
    const firstKey = entries[0]?.[0];

    if (firstKey && this.isLogicalOperator(firstKey) && !this.isCustomOperator(firstKey)) {
      const [key, value] = entries[0]!;
      const qdrantOp = this.getQdrantLogicalOp(key);
      return {
        [qdrantOp]: Array.isArray(value)
          ? value.map(v => this.translateNode(v, true))
          : [this.translateNode(value, true)],
      };
    }

    if (
      entries.length > 1 &&
      !isNested &&
      entries.every(([key]) => !this.isOperator(key) && !this.isCustomOperator(key))
    ) {
      return {
        must: entries.map(([key, value]) => this.translateNode(value, true, key)),
      };
    }

    return null;
  }

  private handleFieldConditions(
    entries: [string, any][],
    fieldKey?: string,
  ): { conditions: any[]; range: Record<string, any>; matchCondition: Record<string, any> | null } {
    const conditions = [];
    let range: Record<string, any> = {};
    let matchCondition: Record<string, any> | null = null;

    for (const [key, value] of entries) {
      if (this.isCustomOperator(key)) {
        const customOp = this.translateCustomOperator(key, value, fieldKey);
        conditions.push(customOp);
      } else if (this.isOperator(key)) {
        const opResult = this.translateOperatorValue(key, value);
        if (opResult.range) {
          Object.assign(range, opResult.range);
        } else {
          matchCondition = opResult;
        }
      } else {
        const nestedKey = fieldKey ? `${fieldKey}.${key}` : key;
        const nestedCondition = this.translateNode(value, true, nestedKey);

        if (nestedCondition.must) {
          conditions.push(...nestedCondition.must);
        } else if (!this.isEmpty(nestedCondition)) {
          conditions.push(nestedCondition);
        }
      }
    }

    return { conditions, range, matchCondition };
  }

  private translateCustomOperator(op: string, value: any, fieldKey?: string): any {
    switch (op) {
      case '$count':
        const countConditions = Object.entries(value).reduce(
          (acc, [k, v]) => ({
            ...acc,
            [k.replace('$', '')]: v,
          }),
          {},
        );
        return { key: fieldKey, values_count: countConditions };
      case '$geo':
        const geoOp = this.translateGeoFilter(value.type, value);
        return { key: fieldKey, ...geoOp };
      case '$hasId':
        return { has_id: Array.isArray(value) ? value : [value] };
      case '$nested':
        return {
          nested: {
            key: fieldKey,
            filter: this.translateNode(value),
          },
        };
      case '$hasVector':
        return { has_vector: value };
      case '$datetime':
        return {
          key: fieldKey,
          range: this.normalizeDatetimeRange(value.range),
        };
      case '$null':
        return { is_null: { key: fieldKey } };
      case '$empty':
        return { is_empty: { key: fieldKey } };
      default:
        throw new Error(`Unsupported custom operator: ${op}`);
    }
  }

  private getQdrantLogicalOp(op: string): string {
    switch (op) {
      case '$and':
        return 'must';
      case '$or':
        return 'should';
      case '$not':
        return 'must_not';
      default:
        throw new Error(`Unsupported logical operator: ${op}`);
    }
  }

  private translateOperatorValue(operator: string, value: any): any {
    const normalizedValue = this.normalizeComparisonValue(value);

    switch (operator) {
      case '$eq':
        return { value: normalizedValue };
      case '$ne':
        return { except: [normalizedValue] };
      case '$gt':
        return { range: { gt: normalizedValue } };
      case '$gte':
        return { range: { gte: normalizedValue } };
      case '$lt':
        return { range: { lt: normalizedValue } };
      case '$lte':
        return { range: { lte: normalizedValue } };
      case '$in':
        return { any: this.normalizeArrayValues(value) };
      case '$nin':
        return { except: this.normalizeArrayValues(value) };
      case '$regex':
        return { text: value };
      case 'exists':
        return value
          ? {
              must_not: [{ is_null: { key: value } }, { is_empty: { key: value } }],
            }
          : {
              is_empty: { key: value },
            };
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  private translateGeoFilter(type: string, value: any): any {
    switch (type) {
      case 'box':
        return {
          geo_bounding_box: {
            top_left: value.top_left,
            bottom_right: value.bottom_right,
          },
        };
      case 'radius':
        return {
          geo_radius: {
            center: value.center,
            radius: value.radius,
          },
        };
      case 'polygon':
        return {
          geo_polygon: {
            exterior: value.exterior,
            interiors: value.interiors,
          },
        };
      default:
        throw new Error(`Unsupported geo filter type: ${type}`);
    }
  }

  private normalizeDatetimeRange(value: any): any {
    const range: Record<string, string> = {};
    for (const [op, val] of Object.entries(value)) {
      if (val instanceof Date) {
        range[op] = val.toISOString();
      } else if (typeof val === 'string') {
        // Assume string is already in proper format
        range[op] = val;
      }
    }
    return range;
  }
}
