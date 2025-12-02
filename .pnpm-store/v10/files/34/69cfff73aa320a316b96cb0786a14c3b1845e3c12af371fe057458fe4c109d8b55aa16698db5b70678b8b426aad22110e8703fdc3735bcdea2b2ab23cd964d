import { FunctionsClient } from '@supabase/functions-js';
import { PostgrestClient, type PostgrestFilterBuilder, type PostgrestQueryBuilder } from '@supabase/postgrest-js';
import { type RealtimeChannel, type RealtimeChannelOptions, RealtimeClient } from '@supabase/realtime-js';
import { StorageClient as SupabaseStorageClient } from '@supabase/storage-js';
import { SupabaseAuthClient } from './lib/SupabaseAuthClient';
import type { Fetch, GenericSchema, SupabaseClientOptions } from './lib/types';
import { GetRpcFunctionFilterBuilderByArgs } from './lib/rest/types/common/rpc';
/**
 * Supabase Client.
 *
 * An isomorphic Javascript client for interacting with Postgres.
 */
export default class SupabaseClient<Database = any, SchemaNameOrClientOptions extends (string & keyof Omit<Database, '__InternalSupabase'>) | {
    PostgrestVersion: string;
} = 'public' extends keyof Omit<Database, '__InternalSupabase'> ? 'public' : string & keyof Omit<Database, '__InternalSupabase'>, SchemaName extends string & keyof Omit<Database, '__InternalSupabase'> = SchemaNameOrClientOptions extends string & keyof Omit<Database, '__InternalSupabase'> ? SchemaNameOrClientOptions : 'public' extends keyof Omit<Database, '__InternalSupabase'> ? 'public' : string & keyof Omit<Omit<Database, '__InternalSupabase'>, '__InternalSupabase'>, Schema extends Omit<Database, '__InternalSupabase'>[SchemaName] extends GenericSchema ? Omit<Database, '__InternalSupabase'>[SchemaName] : never = Omit<Database, '__InternalSupabase'>[SchemaName] extends GenericSchema ? Omit<Database, '__InternalSupabase'>[SchemaName] : never, ClientOptions extends {
    PostgrestVersion: string;
} = SchemaNameOrClientOptions extends string & keyof Omit<Database, '__InternalSupabase'> ? Database extends {
    __InternalSupabase: {
        PostgrestVersion: string;
    };
} ? Database['__InternalSupabase'] : {
    PostgrestVersion: '12';
} : SchemaNameOrClientOptions extends {
    PostgrestVersion: string;
} ? SchemaNameOrClientOptions : never> {
    protected supabaseUrl: string;
    protected supabaseKey: string;
    /**
     * Supabase Auth allows you to create and manage user sessions for access to data that is secured by access policies.
     */
    auth: SupabaseAuthClient;
    realtime: RealtimeClient;
    /**
     * Supabase Storage allows you to manage user-generated content, such as photos or videos.
     */
    storage: SupabaseStorageClient;
    protected realtimeUrl: URL;
    protected authUrl: URL;
    protected storageUrl: URL;
    protected functionsUrl: URL;
    protected rest: PostgrestClient<Database, ClientOptions, SchemaName>;
    protected storageKey: string;
    protected fetch?: Fetch;
    protected changedAccessToken?: string;
    protected accessToken?: () => Promise<string | null>;
    protected headers: Record<string, string>;
    /**
     * Create a new client for use in the browser.
     * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
     * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
     * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
     * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
     * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
     * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
     * @param options.realtime Options passed along to realtime-js constructor.
     * @param options.storage Options passed along to the storage-js constructor.
     * @param options.global.fetch A custom fetch implementation.
     * @param options.global.headers Any additional headers to send with each network request.
     */
    constructor(supabaseUrl: string, supabaseKey: string, options?: SupabaseClientOptions<SchemaName>);
    /**
     * Supabase Functions allows you to deploy and invoke edge functions.
     */
    get functions(): FunctionsClient;
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
    rpc<FnName extends string & keyof Schema['Functions'], Args extends Schema['Functions'][FnName]['Args'] = never, FilterBuilder extends GetRpcFunctionFilterBuilderByArgs<Schema, FnName, Args> = GetRpcFunctionFilterBuilderByArgs<Schema, FnName, Args>>(fn: FnName, args?: Args, options?: {
        head?: boolean;
        get?: boolean;
        count?: 'exact' | 'planned' | 'estimated';
    }): PostgrestFilterBuilder<ClientOptions, Schema, FilterBuilder['Row'], FilterBuilder['Result'], FilterBuilder['RelationName'], FilterBuilder['Relationships'], 'RPC'>;
    /**
     * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
     *
     * @param {string} name - The name of the Realtime channel.
     * @param {Object} opts - The options to pass to the Realtime channel.
     *
     */
    channel(name: string, opts?: RealtimeChannelOptions): RealtimeChannel;
    /**
     * Returns all Realtime channels.
     */
    getChannels(): RealtimeChannel[];
    /**
     * Unsubscribes and removes Realtime channel from Realtime client.
     *
     * @param {RealtimeChannel} channel - The name of the Realtime channel.
     *
     */
    removeChannel(channel: RealtimeChannel): Promise<'ok' | 'timed out' | 'error'>;
    /**
     * Unsubscribes and removes all Realtime channels from Realtime client.
     */
    removeAllChannels(): Promise<('ok' | 'timed out' | 'error')[]>;
    private _getAccessToken;
    private _initSupabaseAuthClient;
    private _initRealtimeClient;
    private _listenForAuthEvents;
    private _handleTokenChanged;
}
//# sourceMappingURL=SupabaseClient.d.ts.map