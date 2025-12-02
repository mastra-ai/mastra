import SupabaseClient from './SupabaseClient'
import type { SupabaseClientOptions } from './lib/types'

export * from '@supabase/auth-js'
export type { User as AuthUser, Session as AuthSession } from '@supabase/auth-js'
export {
  type PostgrestResponse,
  type PostgrestSingleResponse,
  type PostgrestMaybeSingleResponse,
  PostgrestError,
} from '@supabase/postgrest-js'
export {
  FunctionsHttpError,
  FunctionsFetchError,
  FunctionsRelayError,
  FunctionsError,
  type FunctionInvokeOptions,
  FunctionRegion,
} from '@supabase/functions-js'
export * from '@supabase/realtime-js'
export { default as SupabaseClient } from './SupabaseClient'
export type { SupabaseClientOptions, QueryResult, QueryData, QueryError } from './lib/types'

/**
 * Creates a new Supabase Client.
 */
export const createClient = <
  Database = any,
  SchemaNameOrClientOptions extends
    | (string & keyof Omit<Database, '__InternalSupabase'>)
    | { PostgrestVersion: string } = 'public' extends keyof Omit<Database, '__InternalSupabase'>
    ? 'public'
    : string & keyof Omit<Database, '__InternalSupabase'>,
  SchemaName extends string &
    keyof Omit<Database, '__InternalSupabase'> = SchemaNameOrClientOptions extends string &
    keyof Omit<Database, '__InternalSupabase'>
    ? SchemaNameOrClientOptions
    : 'public' extends keyof Omit<Database, '__InternalSupabase'>
      ? 'public'
      : string & keyof Omit<Omit<Database, '__InternalSupabase'>, '__InternalSupabase'>,
>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<SchemaName>
): SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName> => {
  return new SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName>(
    supabaseUrl,
    supabaseKey,
    options
  )
}

// Check for Node.js <= 18 deprecation
function shouldShowDeprecationWarning(): boolean {
  // Skip in browser environments
  if (typeof window !== 'undefined') {
    return false
  }

  // Skip if process is not available (e.g., Edge Runtime)
  if (typeof process === 'undefined') {
    return false
  }

  // Use dynamic property access to avoid Next.js Edge Runtime static analysis warnings
  const processVersion = (process as any)['version']
  if (processVersion === undefined || processVersion === null) {
    return false
  }

  const versionMatch = processVersion.match(/^v(\d+)\./)
  if (!versionMatch) {
    return false
  }

  const majorVersion = parseInt(versionMatch[1], 10)
  return majorVersion <= 18
}

if (shouldShowDeprecationWarning()) {
  console.warn(
    `⚠️  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. ` +
      `Please upgrade to Node.js 20 or later. ` +
      `For more information, visit: https://github.com/orgs/supabase/discussions/37217`
  )
}
