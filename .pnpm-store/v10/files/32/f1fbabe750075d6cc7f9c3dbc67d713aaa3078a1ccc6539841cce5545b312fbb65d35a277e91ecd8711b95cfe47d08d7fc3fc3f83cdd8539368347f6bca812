import SupabaseClient from './SupabaseClient';
import type { SupabaseClientOptions } from './lib/types';
export * from '@supabase/auth-js';
export type { User as AuthUser, Session as AuthSession } from '@supabase/auth-js';
export { type PostgrestResponse, type PostgrestSingleResponse, type PostgrestMaybeSingleResponse, PostgrestError, } from '@supabase/postgrest-js';
export { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError, FunctionsError, type FunctionInvokeOptions, FunctionRegion, } from '@supabase/functions-js';
export * from '@supabase/realtime-js';
export { default as SupabaseClient } from './SupabaseClient';
export type { SupabaseClientOptions, QueryResult, QueryData, QueryError } from './lib/types';
/**
 * Creates a new Supabase Client.
 */
export declare const createClient: <Database = any, SchemaNameOrClientOptions extends (string & keyof Omit<Database, "__InternalSupabase">) | {
    PostgrestVersion: string;
} = "public" extends keyof Omit<Database, "__InternalSupabase"> ? "public" : string & keyof Omit<Database, "__InternalSupabase">, SchemaName extends string & keyof Omit<Database, "__InternalSupabase"> = SchemaNameOrClientOptions extends string & keyof Omit<Database, "__InternalSupabase"> ? SchemaNameOrClientOptions : "public" extends keyof Omit<Database, "__InternalSupabase"> ? "public" : string & keyof Omit<Omit<Database, "__InternalSupabase">, "__InternalSupabase">>(supabaseUrl: string, supabaseKey: string, options?: SupabaseClientOptions<SchemaName>) => SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName>;
//# sourceMappingURL=index.d.ts.map