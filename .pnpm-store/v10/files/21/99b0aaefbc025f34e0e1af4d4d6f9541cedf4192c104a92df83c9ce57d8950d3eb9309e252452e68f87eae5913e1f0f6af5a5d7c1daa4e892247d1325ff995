import { AuthClient } from '@supabase/auth-js'
import { RealtimeClientOptions } from '@supabase/realtime-js'
import { PostgrestError } from '@supabase/postgrest-js'
import type { StorageClientOptions } from '@supabase/storage-js'
import type {
  GenericSchema,
  GenericRelationship,
  GenericTable,
  GenericUpdatableView,
  GenericNonUpdatableView,
  GenericView,
  GenericFunction,
} from './rest/types/common/common'
export type {
  GenericSchema,
  GenericRelationship,
  GenericTable,
  GenericUpdatableView,
  GenericNonUpdatableView,
  GenericView,
  GenericFunction,
}

type AuthClientOptions = ConstructorParameters<typeof AuthClient>[0]

export interface SupabaseAuthClientOptions extends AuthClientOptions {}

export type Fetch = typeof fetch

export type SupabaseClientOptions<SchemaName> = {
  /**
   * The Postgres schema which your tables belong to. Must be on the list of exposed schemas in Supabase. Defaults to `public`.
   */
  db?: {
    schema?: SchemaName
  }

  auth?: {
    /**
     * Automatically refreshes the token for logged-in users. Defaults to true.
     */
    autoRefreshToken?: boolean
    /**
     * Optional key name used for storing tokens in local storage.
     */
    storageKey?: string
    /**
     * Whether to persist a logged-in session to storage. Defaults to true.
     */
    persistSession?: boolean
    /**
     * Detect a session from the URL. Used for OAuth login callbacks. Defaults to true.
     */
    detectSessionInUrl?: boolean
    /**
     * A storage provider. Used to store the logged-in session.
     */
    storage?: SupabaseAuthClientOptions['storage']
    /**
     * A storage provider to store the user profile separately from the session.
     * Useful when you need to store the session information in cookies,
     * without bloating the data with the redundant user object.
     *
     * @experimental
     */
    userStorage?: SupabaseAuthClientOptions['userStorage']
    /**
     * OAuth flow to use - defaults to implicit flow. PKCE is recommended for mobile and server-side applications.
     */
    flowType?: SupabaseAuthClientOptions['flowType']
    /**
     * If debug messages for authentication client are emitted. Can be used to inspect the behavior of the library.
     */
    debug?: SupabaseAuthClientOptions['debug']
    /**
     * Provide your own locking mechanism based on the environment. By default no locking is done at this time.
     *
     * @experimental
     */
    lock?: SupabaseAuthClientOptions['lock']
  }
  /**
   * Options passed to the realtime-js instance
   */
  realtime?: RealtimeClientOptions
  storage?: StorageClientOptions
  global?: {
    /**
     * A custom `fetch` implementation.
     */
    fetch?: Fetch
    /**
     * Optional headers for initializing the client.
     */
    headers?: Record<string, string>
  }
  /**
   * Optional function for using a third-party authentication system with
   * Supabase. The function should return an access token or ID token (JWT) by
   * obtaining it from the third-party auth SDK. Note that this
   * function may be called concurrently and many times. Use memoization and
   * locking techniques if this is not supported by the SDKs.
   *
   * When set, the `auth` namespace of the Supabase client cannot be used.
   * Create another client if you wish to use Supabase Auth and third-party
   * authentications concurrently in the same application.
   */
  accessToken?: () => Promise<string | null>
}

/**
 * Helper types for query results.
 */
export type QueryResult<T> = T extends PromiseLike<infer U> ? U : never
export type QueryData<T> = T extends PromiseLike<{ data: infer U }> ? Exclude<U, null> : never
export type QueryError = PostgrestError
