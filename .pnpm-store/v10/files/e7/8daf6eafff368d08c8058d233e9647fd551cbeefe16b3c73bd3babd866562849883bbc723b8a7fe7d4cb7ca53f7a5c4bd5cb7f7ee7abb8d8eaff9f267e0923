import PostgrestFilterBuilder from './PostgrestFilterBuilder';
import { GetResult } from './select-query-parser/result';
import { ClientServerOptions, Fetch, GenericSchema, GenericTable, GenericView } from './types/common/common';
export default class PostgrestQueryBuilder<ClientOptions extends ClientServerOptions, Schema extends GenericSchema, Relation extends GenericTable | GenericView, RelationName = unknown, Relationships = Relation extends {
    Relationships: infer R;
} ? R : unknown> {
    url: URL;
    headers: Headers;
    schema?: string;
    signal?: AbortSignal;
    fetch?: Fetch;
    constructor(url: URL, { headers, schema, fetch, }: {
        headers?: HeadersInit;
        schema?: string;
        fetch?: Fetch;
    });
    /**
     * Perform a SELECT query on the table or view.
     *
     * @param columns - The columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`
     *
     * @param options - Named parameters
     *
     * @param options.head - When set to `true`, `data` will not be returned.
     * Useful if you only need the count.
     *
     * @param options.count - Count algorithm to use to count rows in the table or view.
     *
     * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
     * hood.
     *
     * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
     * statistics under the hood.
     *
     * `"estimated"`: Uses exact count for low numbers and planned count for high
     * numbers.
     */
    select<Query extends string = '*', ResultOne = GetResult<Schema, Relation['Row'], RelationName, Relationships, Query, ClientOptions>>(columns?: Query, options?: {
        head?: boolean;
        count?: 'exact' | 'planned' | 'estimated';
    }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], ResultOne[], RelationName, Relationships, 'GET'>;
    insert<Row extends Relation extends {
        Insert: unknown;
    } ? Relation['Insert'] : never>(values: Row, options?: {
        count?: 'exact' | 'planned' | 'estimated';
    }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'POST'>;
    insert<Row extends Relation extends {
        Insert: unknown;
    } ? Relation['Insert'] : never>(values: Row[], options?: {
        count?: 'exact' | 'planned' | 'estimated';
        defaultToNull?: boolean;
    }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'POST'>;
    upsert<Row extends Relation extends {
        Insert: unknown;
    } ? Relation['Insert'] : never>(values: Row, options?: {
        onConflict?: string;
        ignoreDuplicates?: boolean;
        count?: 'exact' | 'planned' | 'estimated';
    }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'POST'>;
    upsert<Row extends Relation extends {
        Insert: unknown;
    } ? Relation['Insert'] : never>(values: Row[], options?: {
        onConflict?: string;
        ignoreDuplicates?: boolean;
        count?: 'exact' | 'planned' | 'estimated';
        defaultToNull?: boolean;
    }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'POST'>;
    /**
     * Perform an UPDATE on the table or view.
     *
     * By default, updated rows are not returned. To return it, chain the call
     * with `.select()` after filters.
     *
     * @param values - The values to update with
     *
     * @param options - Named parameters
     *
     * @param options.count - Count algorithm to use to count updated rows.
     *
     * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
     * hood.
     *
     * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
     * statistics under the hood.
     *
     * `"estimated"`: Uses exact count for low numbers and planned count for high
     * numbers.
     */
    update<Row extends Relation extends {
        Update: unknown;
    } ? Relation['Update'] : never>(values: Row, { count, }?: {
        count?: 'exact' | 'planned' | 'estimated';
    }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'PATCH'>;
    /**
     * Perform a DELETE on the table or view.
     *
     * By default, deleted rows are not returned. To return it, chain the call
     * with `.select()` after filters.
     *
     * @param options - Named parameters
     *
     * @param options.count - Count algorithm to use to count deleted rows.
     *
     * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
     * hood.
     *
     * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
     * statistics under the hood.
     *
     * `"estimated"`: Uses exact count for low numbers and planned count for high
     * numbers.
     */
    delete({ count, }?: {
        count?: 'exact' | 'planned' | 'estimated';
    }): PostgrestFilterBuilder<ClientOptions, Schema, Relation['Row'], null, RelationName, Relationships, 'DELETE'>;
}
//# sourceMappingURL=PostgrestQueryBuilder.d.ts.map