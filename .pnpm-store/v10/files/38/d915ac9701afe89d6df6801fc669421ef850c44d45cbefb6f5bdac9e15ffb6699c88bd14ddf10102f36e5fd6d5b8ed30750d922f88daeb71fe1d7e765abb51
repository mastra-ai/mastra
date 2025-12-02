import { FindRootOptions } from "@manypkg/find-root";
import { Packages } from "@manypkg/tools";
export type { Tool, Package, Packages } from "@manypkg/tools";
export declare class PackageJsonMissingNameError extends Error {
    directories: string[];
    constructor(directories: string[]);
}
/**
 * Configuration options for `getPackages` and `getPackagesSync` functions.
 */
export interface GetPackagesOptions extends FindRootOptions {
}
/**
 * Given a starting folder, search that folder and its parents until a supported monorepo
 * is found, and return the collection of packages and a corresponding monorepo `Tool`
 * object.
 *
 * By default, all predefined `Tool` implementations are included in the search -- the
 * caller can provide a list of desired tools to restrict the types of monorepos discovered,
 * or to provide a custom tool implementation.
 */
export declare function getPackages(dir: string, options?: GetPackagesOptions): Promise<Packages>;
/**
 * A synchronous version of {@link getPackages}.
 */
export declare function getPackagesSync(dir: string, options?: GetPackagesOptions): Packages;
