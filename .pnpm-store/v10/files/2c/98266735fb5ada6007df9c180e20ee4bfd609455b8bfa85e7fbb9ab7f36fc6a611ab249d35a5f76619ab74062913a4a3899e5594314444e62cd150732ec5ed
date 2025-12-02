import SupabaseClient from './SupabaseClient';
export * from '@supabase/auth-js';
export { PostgrestError, } from '@supabase/postgrest-js';
export { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError, FunctionsError, FunctionRegion, } from '@supabase/functions-js';
export * from '@supabase/realtime-js';
export { default as SupabaseClient } from './SupabaseClient';
/**
 * Creates a new Supabase Client.
 */
export const createClient = (supabaseUrl, supabaseKey, options) => {
    return new SupabaseClient(supabaseUrl, supabaseKey, options);
};
// Check for Node.js <= 18 deprecation
function shouldShowDeprecationWarning() {
    // Skip in browser environments
    if (typeof window !== 'undefined') {
        return false;
    }
    // Skip if process is not available (e.g., Edge Runtime)
    if (typeof process === 'undefined') {
        return false;
    }
    // Use dynamic property access to avoid Next.js Edge Runtime static analysis warnings
    const processVersion = process['version'];
    if (processVersion === undefined || processVersion === null) {
        return false;
    }
    const versionMatch = processVersion.match(/^v(\d+)\./);
    if (!versionMatch) {
        return false;
    }
    const majorVersion = parseInt(versionMatch[1], 10);
    return majorVersion <= 18;
}
if (shouldShowDeprecationWarning()) {
    console.warn(`⚠️  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. ` +
        `Please upgrade to Node.js 20 or later. ` +
        `For more information, visit: https://github.com/orgs/supabase/discussions/37217`);
}
//# sourceMappingURL=index.js.map