import { Tool, MonorepoRoot } from "@manypkg/tools";
export declare class NoPkgJsonFound extends Error {
    directory: string;
    constructor(directory: string);
}
export declare class NoMatchingMonorepoFound extends Error {
    directory: string;
    constructor(directory: string);
}
/**
 * Configuration options for `findRoot` and `findRootSync` functions.
 */
export interface FindRootOptions {
    /**
     * Override the list of monorepo tool implementations that are used during the search.
     */
    tools?: Tool[];
}
/**
 * Given a starting folder, search that folder and its parents until a supported monorepo
 * is found, and return a `MonorepoRoot` object with the discovered directory and a
 * corresponding monorepo `Tool` object.
 *
 * By default, all predefined `Tool` implementations are included in the search -- the
 * caller can provide a list of desired tools to restrict the types of monorepos discovered,
 * or to provide a custom tool implementation.
 */
export declare function findRoot(cwd: string, options?: FindRootOptions): Promise<MonorepoRoot>;
/**
 * A synchronous version of {@link findRoot}.
 */
export declare function findRootSync(cwd: string, options?: FindRootOptions): MonorepoRoot;
