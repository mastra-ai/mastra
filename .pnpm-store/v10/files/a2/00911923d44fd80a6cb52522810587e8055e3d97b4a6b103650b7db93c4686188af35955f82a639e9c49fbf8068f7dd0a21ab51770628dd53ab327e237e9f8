import type { Plugin } from 'rollup';
type MaybeFalsy<T> = (T) | undefined | null | false;
type MaybeArray<T> = (T) | (T)[];
export interface ExternalsOptions {
    /**
     * Mark node built-in modules like `path`, `fs`... as external.
     *
     * Defaults to `true`.
     */
    builtins?: boolean;
    /**
     * node: prefix handing for importing Node builtins:
     * - `'add'`    turns `'path'` to `'node:path'`
     * - `'strip'`  turns `'node:path'` to `'path'`
     * - `'ignore'` leaves Node builtin names as-is
     *
     * Defaults to `add`.
     */
    builtinsPrefix?: 'add' | 'strip' | 'ignore';
    /**
     * Path/to/your/package.json file (or array of paths).
     *
     * Defaults to all package.json files found in parent directories recursively.
     * Won't go outside of a git repository.
     */
    packagePath?: string | string[];
    /**
     * Mark dependencies as external.
     *
     * Defaults to `true`.
     */
    deps?: boolean;
    /**
     * Mark devDependencies as external.
     *
     * Defaults to `false`.
     */
    devDeps?: boolean;
    /**
     * Mark peerDependencies as external.
     *
     * Defaults to `true`.
     */
    peerDeps?: boolean;
    /**
     * Mark optionalDependencies as external.
     *
     * Defaults to `true`.
     */
    optDeps?: boolean;
    /**
     * Force include these deps in the list of externals, regardless of other settings.
     *
     * Defaults to `[]` (force include nothing).
     */
    include?: MaybeArray<MaybeFalsy<string | RegExp>>;
    /**
     * Force exclude these deps from the list of externals, regardless of other settings.
     *
     * Defaults to `[]` (force exclude nothing).
     */
    exclude?: MaybeArray<MaybeFalsy<string | RegExp>>;
}
/**
 * A Rollup/Vite plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
declare function nodeExternals(options?: ExternalsOptions): Plugin;
export default nodeExternals;
export { nodeExternals };
