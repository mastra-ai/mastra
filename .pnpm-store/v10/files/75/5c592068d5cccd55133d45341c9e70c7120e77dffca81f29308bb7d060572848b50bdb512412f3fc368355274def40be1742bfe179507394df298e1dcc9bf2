import { type MonorepoRoot, type Tool } from "@manypkg/tools";
/**
 * A default ordering for monorepo tool checks.
 *
 * This ordering is designed to check the most typical package.json-based
 * monorepo implementations first, with tools based on custom file schemas
 * checked last.
 */
export declare const DEFAULT_TOOLS: Tool[];
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
