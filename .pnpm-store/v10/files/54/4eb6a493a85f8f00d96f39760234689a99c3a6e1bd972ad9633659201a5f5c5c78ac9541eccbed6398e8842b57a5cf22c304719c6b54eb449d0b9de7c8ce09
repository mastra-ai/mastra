declare const DEV_BROWSER_JWT_KEY = "__clerk_db_jwt";
declare const DEV_BROWSER_JWT_HEADER = "Clerk-Db-Jwt";
declare function setDevBrowserJWTInURL(url: URL, jwt: string): URL;
/**
 * Gets the __clerk_db_jwt JWT from either the hash or the search
 * Side effect:
 * Removes __clerk_db_jwt JWT from the URL (hash and searchParams) and updates the browser history
 */
declare function extractDevBrowserJWTFromURL(url: URL): string;

export { DEV_BROWSER_JWT_HEADER, DEV_BROWSER_JWT_KEY, extractDevBrowserJWTFromURL, setDevBrowserJWTInURL };
