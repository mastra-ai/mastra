/**
 * Cache busting parameter for Netlify to prevent cached responses
 * during handshake flows with Clerk development instances.
 *
 * Note: This query parameter will be removed in the "@clerk/clerk-js" package.
 *
 * @internal
 */
declare const CLERK_NETLIFY_CACHE_BUST_PARAM = "__clerk_netlify_cache_bust";
/**
 * Prevents infinite redirects in Netlify's functions by adding a cache bust parameter
 * to the original redirect URL. This ensures that Netlify doesn't serve a cached response
 * during the handshake flow.
 *
 * The issue happens only on Clerk development instances running on Netlify. This is
 * a workaround until we find a better solution.
 *
 * See https://answers.netlify.com/t/cache-handling-recommendation-for-authentication-handshake-redirects/143969/1.
 *
 * @internal
 */
declare function handleNetlifyCacheInDevInstance({ locationHeader, requestStateHeaders, publishableKey, }: {
    locationHeader: string;
    requestStateHeaders: Headers;
    publishableKey: string;
}): void;

export { CLERK_NETLIFY_CACHE_BUST_PARAM, handleNetlifyCacheInDevInstance };
