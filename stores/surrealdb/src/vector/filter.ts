import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type { OperatorSupport, OperatorValueMap, VectorFieldValue, VectorFilter } from '@mastra/core/vector/filter';

type SurrealOperatorValueMap = OperatorValueMap & {
  $contains: VectorFieldValue | Record<string, unknown>;
  $size: number;
};

export type SurrealVectorFilter = VectorFilter<keyof SurrealOperatorValueMap, SurrealOperatorValueMap>;

const LOGICAL = new Set(['$and', '$or', '$nor', '$not']);

/**
 * Validates Mastra's MongoDB-style vector filters and compiles them into a parameterized
 * SurrealQL condition over the `metadata` object of each vector record.
 *
 * Field names never reach the query text: every path segment is passed as a bound
 * parameter (`metadata[$p0][$p1]`), and so is every value.
 */
export class SurrealFilterTranslator extends BaseFilterTranslator<SurrealVectorFilter, string | undefined> {
  #bindings: Record<string, unknown> = {};
  #next = 0;

  protected override getSupportedOperators(): OperatorSupport {
    return { ...BaseFilterTranslator.DEFAULT_OPERATORS, custom: ['$contains', '$size'] };
  }

  /** Compiles `filter`; the values it references are added to `bindings`. */
  translate(filter?: SurrealVectorFilter, bindings: Record<string, unknown> = {}): string | undefined {
    if (this.isEmpty(filter)) return undefined;
    this.validateFilter(filter);
    this.#bindings = bindings;
    this.#next = Object.keys(bindings).filter(k => k.startsWith('vf')).length;
    return this.#node(filter as Record<string, unknown>, 'metadata');
  }

  #bind(value: unknown): string {
    const name = `vf${this.#next++}`;
    this.#bindings[name] = value;
    return `$${name}`;
  }

  /** `base[$p0][$p1]...` for a dotted field path. */
  #path(base: string, field: string): string {
    return field
      .split('.')
      .filter(Boolean)
      .reduce((expr, segment) => `${expr}[${this.#bind(segment)}]`, base);
  }

  /** An object of field conditions and/or logical operators, AND-ed together. */
  #node(node: Record<string, unknown>, base: string): string {
    const parts = Object.entries(node).map(([key, value]) => {
      if (LOGICAL.has(key)) return this.#logical(key, value, base);
      if (key.startsWith('$')) throw new Error(`Unsupported operator at field level: ${key}`);
      return this.#field(this.#path(base, key), value);
    });
    return parts.length === 0 ? 'true' : `(${parts.join(' AND ')})`;
  }

  #logical(operator: string, value: unknown, base: string): string {
    if (operator === '$not') {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
        throw new Error('$not operator cannot be empty');
      }
      return `!(${this.#node(value as Record<string, unknown>, base)})`;
    }
    if (!Array.isArray(value)) throw new Error(`${operator} requires an array of conditions`);
    if (value.length === 0) return operator === '$or' ? 'false' : 'true';
    const branches = value.map(branch => this.#node((branch ?? {}) as Record<string, unknown>, base));
    if (operator === '$and') return `(${branches.join(' AND ')})`;
    const any = `(${branches.join(' OR ')})`;
    return operator === '$nor' ? `!(${any})` : any;
  }

  /** The condition(s) on one field: a literal (equality), an array (`$in`), or operator objects. */
  #field(field: string, condition: unknown): string {
    if (this.isRegex(condition)) return this.#operator(field, '$regex', condition);
    if (Array.isArray(condition)) return this.#operator(field, '$in', condition);
    if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
      return this.#operator(field, '$eq', condition);
    }
    const entries = Object.entries(condition as Record<string, unknown>);
    if (entries.length === 0) return this.#operator(field, '$eq', condition);
    if (!entries.some(([key]) => key.startsWith('$'))) {
      // A nested object without operators addresses sub-fields.
      return `(${entries.map(([key, value]) => this.#field(this.#path(field, key), value)).join(' AND ')})`;
    }
    const options = (condition as { $options?: string }).$options;
    const parts = entries
      .filter(([op]) => op !== '$options')
      .map(([op, value]) => (op === '$regex' ? this.#regex(field, value, options) : this.#operator(field, op, value)));
    return parts.length === 1 ? parts[0]! : `(${parts.join(' AND ')})`;
  }

  #operator(field: string, op: string, value: unknown): string {
    const isSet = `(${field} != NONE AND ${field} != NULL)`;
    const isArray = `type::is_array(${field})`;
    switch (op) {
      case '$eq': {
        if (value === null || value === undefined) return `!(${isSet})`;
        const v = this.#bind(this.normalizeComparisonValue(value));
        return Array.isArray(value)
          ? `${field} = ${v}`
          : `(${field} = ${v} OR (${isArray} AND ${field} CONTAINS ${v}))`;
      }
      case '$ne':
        return `!(${this.#operator(field, '$eq', value)})`;
      case '$gt':
      case '$gte':
      case '$lt':
      case '$lte': {
        const symbol = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[op];
        if (typeof value !== 'number' && typeof value !== 'string' && !(value instanceof Date)) {
          throw new Error(`${op} requires a number, string or date`);
        }
        const normalized = this.normalizeComparisonValue(value);
        // Only values of the same kind compare, so a missing field or a string never matches a number range.
        const kind = typeof normalized === 'number' ? 'number' : typeof normalized === 'boolean' ? 'bool' : 'string';
        return `(type::is_${kind}(${field}) AND ${field} ${symbol} ${this.#bind(normalized)})`;
      }
      case '$in': {
        const values = this.normalizeArrayValues(Array.isArray(value) ? value : [value]);
        if (values.length === 0) return 'false';
        const v = this.#bind(values);
        return `(${field} INSIDE ${v} OR (${isArray} AND ${field} CONTAINSANY ${v}))`;
      }
      case '$nin':
        return `!(${this.#operator(field, '$in', value)})`;
      case '$all': {
        const values = this.normalizeArrayValues(Array.isArray(value) ? value : [value]);
        if (values.length === 0) return 'false';
        return `(${isArray} AND ${field} CONTAINSALL ${this.#bind(values)})`;
      }
      case '$elemMatch': {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('$elemMatch requires an object with conditions');
        }
        const entries = Object.entries(value as Record<string, unknown>);
        const scalar = entries.every(([key]) => key.startsWith('$') && !LOGICAL.has(key));
        const condition = scalar ? this.#field('$this', value) : this.#node(value as Record<string, unknown>, '$this');
        return `(${isArray} AND ${field}[WHERE ${condition}] != [])`;
      }
      case '$exists':
        return value ? `${field} != NONE` : `${field} = NONE`;
      case '$size': {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
          throw new Error('$size requires a non-negative integer');
        }
        return `(${isArray} AND array::len(${field}) = ${this.#bind(value)})`;
      }
      case '$contains': {
        if (Array.isArray(value)) {
          return `(${isArray} AND ${field} CONTAINSANY ${this.#bind(this.normalizeArrayValues(value))})`;
        }
        if (typeof value === 'string') {
          const v = this.#bind(value.toLowerCase());
          return `((type::is_string(${field}) AND string::contains(string::lowercase(${field}), ${v})) OR (${isArray} AND ${field} CONTAINS ${this.#bind(value)}))`;
        }
        return this.#operator(field, '$eq', value);
      }
      case '$not': {
        if (this.isRegex(value)) return `(${isSet} AND !(${this.#operator(field, '$regex', value)}))`;
        if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
          throw new Error('$not operator cannot be empty');
        }
        const negated = `!(${this.#field(field, value)})`;
        // Like SQL, a negated comparison does not match a missing field, unless it is about existence.
        return '$exists' in value ? negated : `(${isSet} AND ${negated})`;
      }
      case '$regex':
        return this.#regex(field, value, undefined);
      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }

  #regex(field: string, value: unknown, options: string | undefined): string {
    let pattern: string;
    let flags = options ?? '';
    if (value instanceof RegExp) {
      pattern = value.source;
      flags += value.flags;
    } else if (typeof value === 'string') {
      pattern = value;
    } else {
      throw new Error('$regex requires a string or RegExp');
    }
    const inline = [...new Set(flags.split('').filter(f => 'imsx'.includes(f)))].join('');
    const regex = inline ? `(?${inline})${pattern}` : pattern;
    return `(type::is_string(${field}) AND string::matches(${field}, ${this.#bind(regex)}))`;
  }
}
