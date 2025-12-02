export interface GlobOptions {
    /** Treat pattern as case insensitive */
    nocase?: boolean;
    /** Enable extended globbing: ?(pattern), *(pattern), +(pattern), @(pattern), !(pattern) */
    extglob?: boolean;
}
/**
 * Convert a glob pattern to a regular expression
 *
 * Supports:
 * - `/` to separate path segments
 * - `*` to match zero or more characters in a path segment
 * - `?` to match one character in a path segment
 * - `**` to match any number of path segments, including none
 * - `{}` to group conditions (e.g. `{html,txt}`)
 * - `[abc]`, `[a-z]`, `[!a-z]`, `[!abc]` character classes
 * - Extended globbing (when `extglob: true` option is set):
 *   - `?(pattern-list)` zero or one occurrence
 *   - `*(pattern-list)` zero or more occurrences
 *   - `+(pattern-list)` one or more occurrences
 *   - `@(pattern-list)` exactly one of the patterns
 *   - `!(pattern-list)` anything except the patterns
 */
export declare const toRegex: (pattern: string, options?: GlobOptions) => RegExp;
/**
 * A glob pattern to match files paths against. An array or a single pattern
 * can be provided, if an array is given, then individual patterns will be
 * tested in order until one matches (OR short-circuits).
 *
 * For each pattern a string or a regular expression can be provided. If the
 * string starts with `/` and ends with `/<flags>?` it is treated as a regular
 * expression.
 */
export type Pattern = string | RegExp | (string | RegExp)[];
export type Matcher = (path: string) => boolean;
export declare const toMatcher: (pattern: Pattern, options?: GlobOptions) => Matcher;
