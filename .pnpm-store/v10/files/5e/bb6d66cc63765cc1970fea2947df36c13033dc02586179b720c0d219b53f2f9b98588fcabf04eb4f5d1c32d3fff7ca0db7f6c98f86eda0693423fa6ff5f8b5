/**
 * A package.json access type.
 */
export type PackageAccessType = "public" | "restricted";

/**
 * An in-memory representation of a package.json file.
 */
export interface PackageJSON {
  name: string;
  version: string;
  dependencies?: {
    [key: string]: string;
  };
  peerDependencies?: {
    [key: string]: string;
  };
  devDependencies?: {
    [key: string]: string;
  };
  optionalDependencies?: {
    [key: string]: string;
  };
  private?: boolean;
  publishConfig?: {
    access?: PackageAccessType;
    directory?: string;
    registry?: string;
  };
  manypkg?: {
    [key: string]: string;
  };
}

/**
 * An individual package json structure, along with the directory it lives in,
 * relative to the root of the current monorepo.
 */
export interface Package {
  /**
   * The pre-loaded package json structure.
   */
  packageJson: PackageJSON;

  /**
   * Absolute path to the directory containing this package.
   */
  dir: string;

  /**
   * Relative path to the directory containing this package, relative to the monorepo
   * root (for a "root package", this is the string ".").
   */
  relativeDir: string;
}

/**
 * A collection of packages, along with the monorepo tool used to load them,
 * and (if supported by the tool) the associated "root" package.
 */
export interface Packages {
  /**
   * The underlying tool implementation for this monorepo.
   */
  tool: Tool;

  /**
   * A collection of disocvered packages.
   */
  packages: Package[];

  /**
   * If supported by the tool, this is the "root package" for the monorepo.
   */
  rootPackage?: Package;

  /**
   * The absolute path of the root directory of this monorepo.
   */
  rootDir: string;
}

/**
 * An object representing the root of a specific monorepo, with the root
 * directory and associated monorepo tool.
 *
 * Note that this type is currently not used by Tool definitions directly,
 * but it is the suggested way to pass around a reference to a monorepo root
 * directory and associated tool.
 */
export interface MonorepoRoot {
  /**
   * The absolute path to the root directory of this monorepo.
   */
  rootDir: string;

  /**
   * The underlying tool implementation for this monorepo.
   */
  tool: Tool;
}

/**
 * Monorepo tools may throw this error if a caller attempts to get the package
 * collection from a directory that is not a valid monorepo root.
 */
export class InvalidMonorepoError extends Error {}

/**
 * A monorepo tool is a specific implementation of monorepos, whether provided built-in
 * by a package manager or via some other wrapper.
 *
 * Each tool defines a common interface for detecting whether a directory is
 * a valid instance of this type of monorepo, how to retrieve the packages, etc.
 */
export interface Tool {
  /**
   * A string identifier for this monorepo tool. Should be unique among monorepo tools
   * exported by manypkg.
   */
  readonly type: string;

  /**
   * Determine whether the specified directory is a valid root for this monorepo tool.
   */
  isMonorepoRoot(directory: string): Promise<boolean>;

  /**
   * A synchronous version of {@link Tool#isMonorepoRoot}.
   */
  isMonorepoRootSync(directory: string): boolean;

  /**
   * Return the package collection from the specified directory. Rejects with an error
   * if the directory is not a valid monorepo root for this tool.
   */
  getPackages(directory: string): Promise<Packages>;

  /**
   * A synchronous version of {@link Tool#getPackages}.
   */
  getPackagesSync(directory: string): Packages;
}
