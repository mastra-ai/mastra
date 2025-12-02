declare function parseSearchParams(queryString?: string): URLSearchParams;
declare function stripScheme(url?: string): string;
declare function addClerkPrefix(str: string | undefined): string;
/**
 *
 * Retrieve the clerk-js major tag using the major version from the pkgVersion
 * param or use the frontendApi to determine if the canary tag should be used.
 * The default tag is `latest`.
 */
declare const getClerkJsMajorVersionOrTag: (frontendApi: string, version?: string) => string;
/**
 *
 * Retrieve the clerk-js script url from the frontendApi and the major tag
 * using the {@link getClerkJsMajorVersionOrTag} or a provided clerkJSVersion tag.
 */
declare const getScriptUrl: (frontendApi: string, { clerkJSVersion }: {
    clerkJSVersion?: string;
}) => string;
declare function isLegacyDevAccountPortalOrigin(host: string): boolean;
declare function isCurrentDevAccountPortalOrigin(host: string): boolean;
declare function hasTrailingSlash(input?: string, respectQueryAndFragment?: boolean): boolean;
declare function withTrailingSlash(input?: string, respectQueryAndFragment?: boolean): string;
declare function withoutTrailingSlash(input?: string, respectQueryAndFragment?: boolean): string;
declare function hasLeadingSlash(input?: string): boolean;
declare function withoutLeadingSlash(input?: string): string;
declare function withLeadingSlash(input?: string): string;
declare function cleanDoubleSlashes(input?: string): string;
declare function isNonEmptyURL(url: string): boolean | "";
declare function joinURL(base: string, ...input: string[]): string;
declare const isAbsoluteUrl: (url: string) => boolean;

export { addClerkPrefix, cleanDoubleSlashes, getClerkJsMajorVersionOrTag, getScriptUrl, hasLeadingSlash, hasTrailingSlash, isAbsoluteUrl, isCurrentDevAccountPortalOrigin, isLegacyDevAccountPortalOrigin, isNonEmptyURL, joinURL, parseSearchParams, stripScheme, withLeadingSlash, withTrailingSlash, withoutLeadingSlash, withoutTrailingSlash };
