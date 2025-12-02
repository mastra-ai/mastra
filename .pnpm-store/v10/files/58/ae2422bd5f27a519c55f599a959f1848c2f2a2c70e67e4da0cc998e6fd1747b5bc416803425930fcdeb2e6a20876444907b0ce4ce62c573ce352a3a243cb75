import { Context } from "../../../../bundler/context.js";
/**
 * A component definition's location on the local filesystem using absolute paths.
 *
 * For module resolution it would be useful to avoid resolving any symlinks:
 * node modules are often symlinked by e.g. pnpm but relative paths should generally be
 * understood from their symlink location. We don't currently do this though, it made
 * Windows harder to support.
 *
 * None of these properties are the import string, which might have been an unqualifed import
 * (e.g. 'convex-waitlist' instead of '../node_modules/convex-waitlist/convex.config.ts')
 */
export type ComponentDirectory = {
    /**
     * Is this component directory for the root component?
     */
    isRoot: boolean;
    /**
     * Absolute local filesystem path to the component definition's directory.
     */
    path: string;
    /**
     * Absolute local filesystem path to the `convex.config.{ts,js}` file within the component definition.
     */
    definitionPath: string;
    /**
     * Is this component a root without a config file?
     */
    isRootWithoutConfig: boolean;
    /**
     * The import specifier used to import this component, with `/convex.config.*` stripped.
     * For example, if imported as `@convex-dev/workpool/convex.config`, this would be `@convex-dev/workpool`.
     * For relative imports like `../examples/foo/convex.config.js`, this would be `../examples/foo`.
     * This is undefined for components discovered through the filesystem (not through imports).
     */
    importSpecifier?: string;
    /**
     * For synthetic configs (used with --component-dir flag), the path to the component
     * that should be imported in the virtual convex.config.ts.
     */
    syntheticComponentImport?: string;
};
/**
 * Qualify (ensure a leading dot) a path and make it relative to a working dir.
 * Qualifying a path clarifies to esbuild that it represents a local file system
 * path, not a remote path on the npm registry.
 *
 * If this path were made relative without resolving symlinks it would be a
 * prettier identifier for the component directory, but instead symlinks are
 * always resolved.
 */
export declare function qualifiedDefinitionPath(directory: ComponentDirectory, workingDir?: string): string;
export declare function isComponentDirectory(ctx: Context, directory: string, isRoot: boolean): {
    kind: "ok";
    component: ComponentDirectory;
} | {
    kind: "err";
    why: string;
};
export declare function buildComponentDirectory(ctx: Context, definitionPath: string): Promise<ComponentDirectory>;
/**
 * ComponentPath is the local path identifying a
 * component definition. It is the unqualified (it never starts with "./")
 * relative path from the convex directory of the app (root component)
 * to the directory where a component definition lives.
 *
 * Note the convex/ directory of the root component is not necessarily
 * the working directory. It is currently never the same as the working
 * directory since `npx convex` must be invoked from the package root instead.
 */
export type ComponentDefinitionPath = string & {
    __brand: "ComponentDefinitionPath";
};
export declare function toComponentDefinitionPath(rootComponent: ComponentDirectory, component: ComponentDirectory): ComponentDefinitionPath;
export declare function toAbsolutePath(rootComponent: ComponentDirectory, componentDefinitionPath: ComponentDefinitionPath): string;
//# sourceMappingURL=directoryStructure.d.ts.map