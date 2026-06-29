import type {
  BlacklistedRootOperators,
  LogicalOperatorValueMap,
  OperatorSupport,
  OperatorValueMap,
  VectorFilter,
} from '@mastra/core/vector/filter';
import { BaseFilterTranslator } from '@mastra/core/vector/filter';

// Meilisearch cannot express regex (`$regex`/`$options`) or per-element object
// matching (`$elemMatch`). Everything else in the Mongo-style operator set maps
// onto Meilisearch's SQL-like filter syntax.
type MeilisearchOperatorValueMap = Omit<OperatorValueMap, '$regex' | '$options' | '$elemMatch'>;

type MeilisearchLogicalOperatorValueMap = LogicalOperatorValueMap;

export type MeilisearchVectorFilter = VectorFilter<
  keyof MeilisearchOperatorValueMap,
  MeilisearchOperatorValueMap,
  MeilisearchLogicalOperatorValueMap,
  BlacklistedRootOperators
>;

/**
 * Sentinel returned by {@link MeilisearchFilterTranslator.translate} to signal a
 * filter that can never match any document (e.g. an empty `$or`). Meilisearch has
 * no literal "false" filter expression, so the caller short-circuits to an empty
 * result set / no-op instead of issuing a request.
 */
export const MEILISEARCH_MATCH_NONE = Symbol('meilisearch-match-none');

/**
 * Translated filter:
 * - `undefined` -> match everything (no filter applied)
 * - {@link MEILISEARCH_MATCH_NONE} -> match nothing (short-circuit)
 * - `string` -> a Meilisearch filter expression
 */
export type MeilisearchTranslatedFilter = string | undefined | typeof MEILISEARCH_MATCH_NONE;

// Internal three-valued representation used while building the expression so we
// can fold empty/constant branches (ALL / NONE) before emitting a string.
type Node = { kind: 'all' } | { kind: 'none' } | { kind: 'expr'; expr: string };

const ALL: Node = { kind: 'all' };
const NONE: Node = { kind: 'none' };
const expr = (e: string): Node => ({ kind: 'expr', expr: e });

/**
 * Translator from Mongo-style filters to Meilisearch's filter expression syntax.
 *
 * Field names are prefixed with `metadata.` because adapter documents store user
 * metadata under a `metadata` object. The corresponding nested attributes must be
 * declared filterable on the index before they can be used here (handled by the
 * vector store on `createIndex`/`upsert`).
 */
export class MeilisearchFilterTranslator extends BaseFilterTranslator<
  MeilisearchVectorFilter,
  MeilisearchTranslatedFilter
> {
  protected override getSupportedOperators(): OperatorSupport {
    return {
      ...BaseFilterTranslator.DEFAULT_OPERATORS,
      logical: ['$and', '$or', '$not', '$nor'],
      array: ['$in', '$nin', '$all'],
      regex: [],
      custom: [],
    };
  }

  translate(filter?: MeilisearchVectorFilter): MeilisearchTranslatedFilter {
    if (this.isEmpty(filter)) return undefined;
    this.validateFilter(filter as MeilisearchVectorFilter);
    const node = this.translateNode(filter as Record<string, any>);
    if (node.kind === 'all') return undefined;
    if (node.kind === 'none') return MEILISEARCH_MATCH_NONE;
    return node.expr;
  }

  // ---- boolean algebra over ALL / NONE / expr ----

  private and(parts: Node[]): Node {
    if (parts.some(p => p.kind === 'none')) return NONE;
    const exprs = parts.filter((p): p is { kind: 'expr'; expr: string } => p.kind === 'expr');
    if (exprs.length === 0) return ALL;
    if (exprs.length === 1) return exprs[0]!;
    return expr(exprs.map(p => `(${p.expr})`).join(' AND '));
  }

  private or(parts: Node[]): Node {
    if (parts.some(p => p.kind === 'all')) return ALL;
    const exprs = parts.filter((p): p is { kind: 'expr'; expr: string } => p.kind === 'expr');
    if (exprs.length === 0) return NONE;
    if (exprs.length === 1) return exprs[0]!;
    return expr(exprs.map(p => `(${p.expr})`).join(' OR '));
  }

  private not(part: Node): Node {
    if (part.kind === 'all') return NONE;
    if (part.kind === 'none') return ALL;
    return expr(`NOT (${part.expr})`);
  }

  private translateNode(node: Record<string, any>): Node {
    if (this.isEmpty(node)) return ALL;

    const parts: Node[] = [];
    for (const [key, value] of Object.entries(node)) {
      if (key === '$and') {
        parts.push(this.and(this.asArray('$and', value).map(v => this.translateNode(v))));
      } else if (key === '$or') {
        parts.push(this.or(this.asArray('$or', value).map(v => this.translateNode(v))));
      } else if (key === '$nor') {
        parts.push(this.not(this.or(this.asArray('$nor', value).map(v => this.translateNode(v)))));
      } else if (key === '$not') {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new Error('$not operator requires an object');
        }
        parts.push(this.not(this.translateNode(value)));
      } else if (this.isOperator(key)) {
        throw new Error(`Unsupported operator: ${key}`);
      } else {
        parts.push(this.translateField(key, value));
      }
    }
    return this.and(parts);
  }

  private asArray(op: string, value: any): any[] {
    if (!Array.isArray(value)) {
      throw new Error(`Logical operator ${op} requires an array value`);
    }
    return value;
  }

  private field(name: string): string {
    return name.startsWith('metadata.') ? name : `metadata.${name}`;
  }

  private translateField(name: string, value: any): Node {
    const field = this.field(name);

    // Operator object, e.g. { $gt: 5, $lte: 10 }
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      return this.translateOperators(field, value);
    }

    // Bare array -> membership ($in semantics)
    if (Array.isArray(value)) {
      if (value.length === 0) return NONE;
      return expr(`${field} IN [${value.map(v => this.formatValue(v)).join(', ')}]`);
    }

    // Primitive equality
    if (value === null) return expr(`${field} IS NULL`);
    return expr(`${field} = ${this.formatValue(value)}`);
  }

  private translateOperators(field: string, ops: Record<string, any>): Node {
    const parts: Node[] = [];

    for (const [op, raw] of Object.entries(ops)) {
      const value = this.normalizeComparisonValue(raw);
      switch (op) {
        case '$eq':
          parts.push(raw === null ? expr(`${field} IS NULL`) : expr(`${field} = ${this.formatValue(value)}`));
          break;
        case '$ne':
          parts.push(raw === null ? expr(`${field} IS NOT NULL`) : expr(`${field} != ${this.formatValue(value)}`));
          break;
        case '$gt':
        case '$gte':
        case '$lt':
        case '$lte': {
          const symbol = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[op]!;
          parts.push(expr(`${field} ${symbol} ${this.formatComparison(op, value)}`));
          break;
        }
        case '$in': {
          const arr = this.asArray('$in', raw);
          parts.push(arr.length === 0 ? NONE : expr(`${field} IN [${arr.map(v => this.formatValue(v)).join(', ')}]`));
          break;
        }
        case '$nin': {
          const arr = this.asArray('$nin', raw);
          parts.push(
            arr.length === 0 ? ALL : this.not(expr(`${field} IN [${arr.map(v => this.formatValue(v)).join(', ')}]`)),
          );
          break;
        }
        case '$all': {
          // Meilisearch has no $all; array membership is plain equality, so
          // require each value to be present (AND of equalities).
          const arr = this.asArray('$all', raw);
          parts.push(arr.length === 0 ? NONE : this.and(arr.map(v => expr(`${field} = ${this.formatValue(v)}`))));
          break;
        }
        case '$exists':
          parts.push(raw ? expr(`${field} EXISTS`) : this.not(expr(`${field} EXISTS`)));
          break;
        case '$not':
          if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            throw new Error('$not operator requires an object');
          }
          parts.push(this.not(this.translateOperators(field, raw)));
          break;
        default:
          throw new Error(`Unsupported operator: ${op}`);
      }
    }

    return this.and(parts);
  }

  private formatComparison(op: string, value: any): string {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return this.quote(value);
    throw new Error(`Operator ${op} requires a number, string, or Date value`);
  }

  private formatValue(value: any): string {
    if (value === null) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return this.quote(String(value));
  }

  private quote(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
}
