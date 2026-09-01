import type { FilterResult } from './filters';

export const CLICKHOUSE_TRUSTED_QUERY_SCOPE = Symbol('CLICKHOUSE_TRUSTED_QUERY_SCOPE');

export type TrustedQueryScope = Readonly<Record<string, string>>;

const CLICKHOUSE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function buildTrustedQueryScopeFilter(scope: TrustedQueryScope | undefined): FilterResult {
  const result: FilterResult = { conditions: [], params: {} };
  if (!scope) return result;

  for (const [column, value] of Object.entries(scope)) {
    if (!CLICKHOUSE_IDENTIFIER.test(column)) {
      throw new Error(`Invalid trusted query scope column: ${column}`);
    }

    const param = `trustedScope_${column}`;
    result.conditions.push(`${column} = {${param}:String}`);
    result.params[param] = value;
  }

  return result;
}
