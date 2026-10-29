import { readFile } from 'node:fs/promises';
import type { IMastraLogger } from '@internal/core/logger';
import { parse } from 'dotenv';

type PnpmWorkspaceValue =
  | null
  | boolean
  | number
  | string
  | PnpmWorkspaceValue[]
  | { [key: string]: PnpmWorkspaceValue };

export type BundlerConfig = {
  /**
   * Controls which dependencies are excluded from the bundle and installed separately.
   * - `true`: Excludes all non-workspace packages from bundling
   * - `string[]`: Specifies custom packages to exclude (merged with global externals like 'pg', '@libsql/client')
   */
  externals?: boolean | string[];
  /**
   * Enables source map generation for debugging bundled code.
   * Generates `.mjs.map` files alongside bundled output.
   */
  sourcemap?: boolean;
  /**
   * Minifies the generated bundle, stripping whitespace, comments and shortening
   * local identifiers. Off by default so that build output stays readable and
   * stack traces stay meaningful.
   *
   * Enable it when packaging for production — a smaller bundle is cheaper to
   * ship in a container image or to an on-prem target.
   *
   * @example
   * ```typescript
   * bundler: {
   *   minify: true
   * }
   * ```
   */
  minify?: boolean;
  /**
   * Packages requiring TypeScript/modern JS transpilation during bundling.
   * Automatically includes workspace packages.
   */
  transpilePackages?: string[];
  /**
   * Packages that are loaded dynamically at runtime and cannot be detected by static analysis.
   * These packages will be included in the final dependencies even if not statically imported.
   *
   * Use this for packages loaded via string references like plugin systems, custom loggers,
   * or other dynamic module loading patterns.
   *
   * @example
   * ```typescript
   * bundler: {
   *   dynamicPackages: ['my-custom-pino-transport', 'some-plugin']
   * }
   * ```
   */
  dynamicPackages?: string[];
  /**
   * Explicit pnpm workspace settings to write to the deployment workspace.
   * Overrides copied source settings. Only applies to pnpm installs.
   * Supports install-policy keys only (build approvals, minimumReleaseAge, trustPolicy, blockExoticSubdeps).
   */
  pnpmWorkspaceSettings?: Record<string, PnpmWorkspaceValue>;

  [key: symbol]: boolean | undefined;
};

export interface IBundler {
  __setLogger(logger: IMastraLogger): void;
  loadEnvVars(): Promise<Map<string, string>>;
  getEnvFiles(): Promise<string[]>;
  getAllToolPaths(mastraDir: string, toolsPaths: (string | string[])[]): (string | string[])[];
  bundle(
    entryFile: string,
    outputDirectory: string,
    options: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void>;
  prepare(outputDirectory: string): Promise<void>;
  writePackageJson(outputDirectory: string, dependencies: Map<string, string>): Promise<void>;
  lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void>;
}

/**
 * Reads dotenv files in order into one map; values from later files override earlier ones.
 */
export async function loadEnvVars(files: string[]): Promise<Map<string, string>> {
  const envVars = new Map<string, string>();

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const config = parse(content);

    Object.entries(config).forEach(([key, value]) => {
      envVars.set(key, value);
    });
  }

  return envVars;
}
