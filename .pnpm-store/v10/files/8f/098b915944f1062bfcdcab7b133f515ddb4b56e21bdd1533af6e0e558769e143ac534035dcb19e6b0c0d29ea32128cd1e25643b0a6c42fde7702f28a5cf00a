import PostgrestQueryBuilder from './PostgrestQueryBuilder';
import PostgrestFilterBuilder from './PostgrestFilterBuilder';
import { Fetch, GenericSchema, ClientServerOptions } from './types/common/common';
import { GetRpcFunctionFilterBuilderByArgs } from './types/common/rpc';
/**
 * PostgREST client.
 *
 * @typeParam Database - Types for the schema from the [type
 * generator](https://supabase.com/docs/reference/javascript/next/typescript-support)
 *
 * @typeParam SchemaName - Postgres schema to switch to. Must be a string
 * literal, the same one passed to the constructor. If the schema is not
 * `"public"`, this must be supplied manually.
 */
export default class PostgrestClient<Database = any, ClientOptions extends ClientServerOptions = Database extends {
    __InternalSupabase: infer I extends ClientServerOptions;
} ? I : {}, SchemaName extends string & keyof Omit<Database, '__InternalSupabase'> = 'public' extends keyof Omit<Database, '__InternalSupabase'> ? 'public' : string & keyof Omit<Database, '__InternalSupabase'>, Schema extends GenericSchema = Omit<Database, '__InternalSupabase'>[SchemaName] extends GenericSchema ? Omit<Database, '__InternalSupabase'>[SchemaName] : any> {
    url: string;
    headers: Headers;
    schemaName?: SchemaName;
    fetch?: Fetch;
    /**
     * Creates a PostgREST client.
     *
     * @param url - URL of the PostgREST endpoint
     * @param options - Named parameters
     * @param options.headers - Custom headers
     * @param options.schema - Postgres schema to switch to
     * @param options.fetch - Custom fetch
     */
    constructor(url: string, { headers, schema, fetch, }?: {
        headers?: HeadersInit;
        schema?: SchemaName;
        fetch?: Fetch;
    });
    from<TableName extends string & keyof Schema['Tables'], Table extends Schema['Tables'][TableName]>(relation: TableName): PostgrestQueryBuilder<ClientOptions, Schema, Table, TableName>;
    from<ViewName extends string & keyof Schema['Views'], View extends Schema['Views'][ViewName]>(relation: ViewName): PostgrestQueryBuilder<ClientOptions, Schema, View, ViewName>;
    /**
     * Select a schema to query or perform an function (rpc) call.
     *
     * The schema needs to be on the list of exposed schemas inside Supabase.
     *
     * @param schema - The schema to query
     */
    schema<DynamicSchema extends string & keyof Omit<Database, '__InternalSupabase'>>(schema: DynamicSchema): PostgrestClient<Database, ClientOptions, DynamicSchema, Database[DynamicSchema] extends GenericSchema ? Database[DynamicSchema] : any>;
    /**
     * Perform a function call.
     *
     * @param fn - The function name to call
     * @param args - The arguments to pass to the function call
     * @param options - Named parameters
     * @param options.head - When set to `true`, `data` will not be returned.
     * Useful if you only need the count.
     * @param options.get - When set to `true`, the function will be called with
     * read-only access mode.
     * @param options.count - Count algorithm to use to count rows returned by the
     * function. Only applicable for [set-returning
     * functions](https://www.postgresql.org/docs/current/functions-srf.html).
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
    rpc<FnName extends string & keyof Schema['Functions'], Args extends Schema['Functions'][FnName]['Args'] = never, FilterBuilder extends GetRpcFunctionFilterBuilderByArgs<Schema, FnName, Args> = GetRpcFunctionFilterBuilderByArgs<Schema, FnName, Args>>(fn: FnName, args?: Args, { head, get, count, }?: {
        head?: boolean;
        get?: boolean;
        count?: 'exact' | 'planned' | 'estimated';
    }): PostgrestFilterBuilder<ClientOptions, Schema, FilterBuilder['Row'], FilterBuilder['Result'], FilterBuilder['RelationName'], FilterBuilder['Relationships'], 'RPC'>;
}
//# sourceMappingURL=PostgrestClient.d.ts.map