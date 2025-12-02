import PostgrestBuilder from './PostgrestBuilder'
import PostgrestFilterBuilder, { InvalidMethodError } from './PostgrestFilterBuilder'
import { GetResult } from './select-query-parser/result'
import { CheckMatchingArrayTypes, MaxAffectedEnabled } from './types/types'
import { ClientServerOptions, GenericSchema } from './types/common/common'

export default class PostgrestTransformBuilder<
  ClientOptions extends ClientServerOptions,
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  Result,
  RelationName = unknown,
  Relationships = unknown,
  Method = unknown,
> extends PostgrestBuilder<ClientOptions, Result> {
  /**
   * Perform a SELECT on the query result.
   *
   * By default, `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not
   * return modified rows. By calling this method, modified rows are returned in
   * `data`.
   *
   * @param columns - The columns to retrieve, separated by commas
   */
  select<
    Query extends string = '*',
    NewResultOne = GetResult<Schema, Row, RelationName, Relationships, Query, ClientOptions>,
  >(
    columns?: Query
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    Row,
    Method extends 'RPC'
      ? Result extends unknown[]
        ? NewResultOne[]
        : NewResultOne
      : NewResultOne[],
    RelationName,
    Relationships,
    Method
  > {
    // Remove whitespaces except when quoted
    let quoted = false
    const cleanedColumns = (columns ?? '*')
      .split('')
      .map((c) => {
        if (/\s/.test(c) && !quoted) {
          return ''
        }
        if (c === '"') {
          quoted = !quoted
        }
        return c
      })
      .join('')
    this.url.searchParams.set('select', cleanedColumns)
    this.headers.append('Prefer', 'return=representation')
    return this as unknown as PostgrestFilterBuilder<
      ClientOptions,
      Schema,
      Row,
      Method extends 'RPC'
        ? Result extends unknown[]
          ? NewResultOne[]
          : NewResultOne
        : NewResultOne[],
      RelationName,
      Relationships,
      Method
    >
  }

  order<ColumnName extends string & keyof Row>(
    column: ColumnName,
    options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: undefined }
  ): this
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string }
  ): this
  /**
   * @deprecated Use `options.referencedTable` instead of `options.foreignTable`
   */
  order<ColumnName extends string & keyof Row>(
    column: ColumnName,
    options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: undefined }
  ): this
  /**
   * @deprecated Use `options.referencedTable` instead of `options.foreignTable`
   */
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string }
  ): this
  /**
   * Order the query result by `column`.
   *
   * You can call this method multiple times to order by multiple columns.
   *
   * You can order referenced tables, but it only affects the ordering of the
   * parent table if you use `!inner` in the query.
   *
   * @param column - The column to order by
   * @param options - Named parameters
   * @param options.ascending - If `true`, the result will be in ascending order
   * @param options.nullsFirst - If `true`, `null`s appear first. If `false`,
   * `null`s appear last.
   * @param options.referencedTable - Set this to order a referenced table by
   * its columns
   * @param options.foreignTable - Deprecated, use `options.referencedTable`
   * instead
   */
  order(
    column: string,
    {
      ascending = true,
      nullsFirst,
      foreignTable,
      referencedTable = foreignTable,
    }: {
      ascending?: boolean
      nullsFirst?: boolean
      foreignTable?: string
      referencedTable?: string
    } = {}
  ): this {
    const key = referencedTable ? `${referencedTable}.order` : 'order'
    const existingOrder = this.url.searchParams.get(key)

    this.url.searchParams.set(
      key,
      `${existingOrder ? `${existingOrder},` : ''}${column}.${ascending ? 'asc' : 'desc'}${
        nullsFirst === undefined ? '' : nullsFirst ? '.nullsfirst' : '.nullslast'
      }`
    )
    return this
  }

  /**
   * Limit the query result by `count`.
   *
   * @param count - The maximum number of rows to return
   * @param options - Named parameters
   * @param options.referencedTable - Set this to limit rows of referenced
   * tables instead of the parent table
   * @param options.foreignTable - Deprecated, use `options.referencedTable`
   * instead
   */
  limit(
    count: number,
    {
      foreignTable,
      referencedTable = foreignTable,
    }: { foreignTable?: string; referencedTable?: string } = {}
  ): this {
    const key = typeof referencedTable === 'undefined' ? 'limit' : `${referencedTable}.limit`
    this.url.searchParams.set(key, `${count}`)
    return this
  }

  /**
   * Limit the query result by starting at an offset `from` and ending at the offset `to`.
   * Only records within this range are returned.
   * This respects the query order and if there is no order clause the range could behave unexpectedly.
   * The `from` and `to` values are 0-based and inclusive: `range(1, 3)` will include the second, third
   * and fourth rows of the query.
   *
   * @param from - The starting index from which to limit the result
   * @param to - The last index to which to limit the result
   * @param options - Named parameters
   * @param options.referencedTable - Set this to limit rows of referenced
   * tables instead of the parent table
   * @param options.foreignTable - Deprecated, use `options.referencedTable`
   * instead
   */
  range(
    from: number,
    to: number,
    {
      foreignTable,
      referencedTable = foreignTable,
    }: { foreignTable?: string; referencedTable?: string } = {}
  ): this {
    const keyOffset =
      typeof referencedTable === 'undefined' ? 'offset' : `${referencedTable}.offset`
    const keyLimit = typeof referencedTable === 'undefined' ? 'limit' : `${referencedTable}.limit`
    this.url.searchParams.set(keyOffset, `${from}`)
    // Range is inclusive, so add 1
    this.url.searchParams.set(keyLimit, `${to - from + 1}`)
    return this
  }

  /**
   * Set the AbortSignal for the fetch request.
   *
   * @param signal - The AbortSignal to use for the fetch request
   */
  abortSignal(signal: AbortSignal): this {
    this.signal = signal
    return this
  }

  /**
   * Return `data` as a single object instead of an array of objects.
   *
   * Query result must be one row (e.g. using `.limit(1)`), otherwise this
   * returns an error.
   */
  single<ResultOne = Result extends (infer ResultOne)[] ? ResultOne : never>(): PostgrestBuilder<
    ClientOptions,
    ResultOne
  > {
    this.headers.set('Accept', 'application/vnd.pgrst.object+json')
    return this as unknown as PostgrestBuilder<ClientOptions, ResultOne>
  }

  /**
   * Return `data` as a single object instead of an array of objects.
   *
   * Query result must be zero or one row (e.g. using `.limit(1)`), otherwise
   * this returns an error.
   */
  maybeSingle<
    ResultOne = Result extends (infer ResultOne)[] ? ResultOne : never,
  >(): PostgrestBuilder<ClientOptions, ResultOne | null> {
    // Temporary partial fix for https://github.com/supabase/postgrest-js/issues/361
    // Issue persists e.g. for `.insert([...]).select().maybeSingle()`
    if (this.method === 'GET') {
      this.headers.set('Accept', 'application/json')
    } else {
      this.headers.set('Accept', 'application/vnd.pgrst.object+json')
    }
    this.isMaybeSingle = true
    return this as unknown as PostgrestBuilder<ClientOptions, ResultOne | null>
  }

  /**
   * Return `data` as a string in CSV format.
   */
  csv(): PostgrestBuilder<ClientOptions, string> {
    this.headers.set('Accept', 'text/csv')
    return this as unknown as PostgrestBuilder<ClientOptions, string>
  }

  /**
   * Return `data` as an object in [GeoJSON](https://geojson.org) format.
   */
  geojson(): PostgrestBuilder<ClientOptions, Record<string, unknown>> {
    this.headers.set('Accept', 'application/geo+json')
    return this as unknown as PostgrestBuilder<ClientOptions, Record<string, unknown>>
  }

  /**
   * Return `data` as the EXPLAIN plan for the query.
   *
   * You need to enable the
   * [db_plan_enabled](https://supabase.com/docs/guides/database/debugging-performance#enabling-explain)
   * setting before using this method.
   *
   * @param options - Named parameters
   *
   * @param options.analyze - If `true`, the query will be executed and the
   * actual run time will be returned
   *
   * @param options.verbose - If `true`, the query identifier will be returned
   * and `data` will include the output columns of the query
   *
   * @param options.settings - If `true`, include information on configuration
   * parameters that affect query planning
   *
   * @param options.buffers - If `true`, include information on buffer usage
   *
   * @param options.wal - If `true`, include information on WAL record generation
   *
   * @param options.format - The format of the output, can be `"text"` (default)
   * or `"json"`
   */
  explain({
    analyze = false,
    verbose = false,
    settings = false,
    buffers = false,
    wal = false,
    format = 'text',
  }: {
    analyze?: boolean
    verbose?: boolean
    settings?: boolean
    buffers?: boolean
    wal?: boolean
    format?: 'json' | 'text'
  } = {}) {
    const options = [
      analyze ? 'analyze' : null,
      verbose ? 'verbose' : null,
      settings ? 'settings' : null,
      buffers ? 'buffers' : null,
      wal ? 'wal' : null,
    ]
      .filter(Boolean)
      .join('|')
    // An Accept header can carry multiple media types but postgrest-js always sends one
    const forMediatype = this.headers.get('Accept') ?? 'application/json'
    this.headers.set(
      'Accept',
      `application/vnd.pgrst.plan+${format}; for="${forMediatype}"; options=${options};`
    )
    if (format === 'json') {
      return this as unknown as PostgrestBuilder<ClientOptions, Record<string, unknown>[]>
    } else {
      return this as unknown as PostgrestBuilder<ClientOptions, string>
    }
  }

  /**
   * Rollback the query.
   *
   * `data` will still be returned, but the query is not committed.
   */
  rollback(): this {
    this.headers.append('Prefer', 'tx=rollback')
    return this
  }

  /**
   * Override the type of the returned `data`.
   *
   * @typeParam NewResult - The new result type to override with
   * @deprecated Use overrideTypes<yourType, { merge: false }>() method at the end of your call chain instead
   */
  returns<NewResult>(): PostgrestTransformBuilder<
    ClientOptions,
    Schema,
    Row,
    CheckMatchingArrayTypes<Result, NewResult>,
    RelationName,
    Relationships,
    Method
  > {
    return this as unknown as PostgrestTransformBuilder<
      ClientOptions,
      Schema,
      Row,
      CheckMatchingArrayTypes<Result, NewResult>,
      RelationName,
      Relationships,
      Method
    >
  }

  /**
   * Set the maximum number of rows that can be affected by the query.
   * Only available in PostgREST v13+ and only works with PATCH and DELETE methods.
   *
   * @param value - The maximum number of rows that can be affected
   */
  maxAffected(value: number): MaxAffectedEnabled<ClientOptions['PostgrestVersion']> extends true
    ? // TODO: update the RPC case to only work on RPC that returns SETOF rows
      Method extends 'PATCH' | 'DELETE' | 'RPC'
      ? this
      : InvalidMethodError<'maxAffected method only available on update or delete'>
    : InvalidMethodError<'maxAffected method only available on postgrest 13+'> {
    this.headers.append('Prefer', 'handling=strict')
    this.headers.append('Prefer', `max-affected=${value}`)
    return this as unknown as MaxAffectedEnabled<ClientOptions['PostgrestVersion']> extends true
      ? Method extends 'PATCH' | 'DELETE' | 'RPC'
        ? this
        : InvalidMethodError<'maxAffected method only available on update or delete'>
      : InvalidMethodError<'maxAffected method only available on postgrest 13+'>
  }
}
