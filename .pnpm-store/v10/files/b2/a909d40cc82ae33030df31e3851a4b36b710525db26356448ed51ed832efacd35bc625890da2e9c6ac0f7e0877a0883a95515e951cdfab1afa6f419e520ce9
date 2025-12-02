// helpers.ts
import { SupabaseClientOptions } from './types'

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : url + '/'
}

export const isBrowser = () => typeof window !== 'undefined'

export function applySettingDefaults<
  Database = any,
  SchemaName extends string & keyof Database = 'public' extends keyof Database
    ? 'public'
    : string & keyof Database,
>(
  options: SupabaseClientOptions<SchemaName>,
  defaults: SupabaseClientOptions<any>
): Required<SupabaseClientOptions<SchemaName>> {
  const {
    db: dbOptions,
    auth: authOptions,
    realtime: realtimeOptions,
    global: globalOptions,
  } = options
  const {
    db: DEFAULT_DB_OPTIONS,
    auth: DEFAULT_AUTH_OPTIONS,
    realtime: DEFAULT_REALTIME_OPTIONS,
    global: DEFAULT_GLOBAL_OPTIONS,
  } = defaults

  const result: Required<SupabaseClientOptions<SchemaName>> = {
    db: {
      ...DEFAULT_DB_OPTIONS,
      ...dbOptions,
    },
    auth: {
      ...DEFAULT_AUTH_OPTIONS,
      ...authOptions,
    },
    realtime: {
      ...DEFAULT_REALTIME_OPTIONS,
      ...realtimeOptions,
    },
    storage: {},
    global: {
      ...DEFAULT_GLOBAL_OPTIONS,
      ...globalOptions,
      headers: {
        ...(DEFAULT_GLOBAL_OPTIONS?.headers ?? {}),
        ...(globalOptions?.headers ?? {}),
      },
    },
    accessToken: async () => '',
  }

  if (options.accessToken) {
    result.accessToken = options.accessToken
  } else {
    // hack around Required<>
    delete (result as any).accessToken
  }

  return result
}

/**
 * Validates a Supabase client URL
 *
 * @param {string} supabaseUrl - The Supabase client URL string.
 * @returns {URL} - The validated base URL.
 * @throws {Error}
 */
export function validateSupabaseUrl(supabaseUrl: string): URL {
  const trimmedUrl = supabaseUrl?.trim()

  if (!trimmedUrl) {
    throw new Error('supabaseUrl is required.')
  }

  if (!trimmedUrl.match(/^https?:\/\//i)) {
    throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.')
  }

  try {
    return new URL(ensureTrailingSlash(trimmedUrl))
  } catch {
    throw Error('Invalid supabaseUrl: Provided URL is malformed.')
  }
}
