import { Context } from "../../bundler/context.js";
import { Bundle, BundleHash } from "../../bundler/index.js";
import { NodeDependency } from "./deployApi/modules.js";
import { ComponentDefinitionPath } from "./components/definition/directoryStructure.js";
export { productionProvisionHost, provisionHost } from "./utils/utils.js";
/** Type representing auth configuration. */
export interface AuthInfo {
    applicationID: string;
    domain: string;
}
/**
 * convex.json file parsing and rewriting notes
 * - Unknown fields at the top level and in node and codegen are preserved
 *   so that older CLI versions can deploy new projects (this functionality
 *   will be removed in the future).
 * - Deprecated values are tracked only so that we can delete them, or
 *   (for authInfo) migrate to a convex/auth.config.ts and delete.
 * - Default values for properties with an obvious default are removed in order
 *   to keep the config file small so we can delete the file if it only has
 *   deprecated properties or obvious defaults.
 * - convex.json does not allow comments, it will be rewritten
 *   automatically. This could change in the future, a property config
 *   file makes more sense. Previously automatically set values like
 *   productionUrl were written to it, but it's becoming more like a config file.
 */
/** Type representing Convex project configuration. */
export interface ProjectConfig {
    functions: string;
    node: {
        externalPackages: string[];
        nodeVersion?: string | undefined;
    };
    generateCommonJSApi: boolean;
    project?: string | undefined;
    team?: string | undefined;
    prodUrl?: string | undefined;
    authInfo?: AuthInfo[] | undefined;
    codegen: {
        staticApi: boolean;
        staticDataModel: boolean;
        legacyComponentApi?: boolean;
        fileType?: "ts" | "js/dts";
    };
}
export interface Config {
    projectConfig: ProjectConfig;
    modules: Bundle[];
    nodeDependencies: NodeDependency[];
    schemaId?: string;
    udfServerVersion?: string;
    nodeVersion?: string | undefined;
}
export interface ConfigWithModuleHashes {
    projectConfig: ProjectConfig;
    moduleHashes: BundleHash[];
    nodeDependencies: NodeDependency[];
    schemaId?: string;
    udfServerVersion?: string;
}
/** Whether .ts file extensions should be used for generated code (default is false). */
export declare function usesTypeScriptCodegen(projectConfig: ProjectConfig): boolean;
/** Whether the new component API import style should be used (default is false) */
export declare function usesComponentApiImports(projectConfig: ProjectConfig): boolean;
export declare function resetUnknownKeyWarnings(): void;
/** Parse object to ProjectConfig. */
export declare function parseProjectConfig(ctx: Context, obj: any): Promise<ProjectConfig>;
export declare function configName(): string;
export declare function configFilepath(ctx: Context): Promise<string>;
export declare function getFunctionsDirectoryPath(ctx: Context): Promise<string>;
/** Read configuration from a local `convex.json` file. */
export declare function readProjectConfig(ctx: Context): Promise<{
    projectConfig: ProjectConfig;
    configPath: string;
}>;
export declare function enforceDeprecatedConfigField(ctx: Context, config: ProjectConfig, field: "team" | "project" | "prodUrl"): Promise<string>;
/**
 * Given a {@link ProjectConfig}, add in the bundled modules to produce the
 * complete config.
 */
export declare function configFromProjectConfig(ctx: Context, projectConfig: ProjectConfig, configPath: string, verbose: boolean): Promise<{
    config: Config;
    bundledModuleInfos: BundledModuleInfo[];
}>;
/**
 * Bundle modules one by one for good bundler errors.
 */
export declare function debugIsolateEndpointBundles(ctx: Context, projectConfig: ProjectConfig, configPath: string): Promise<void>;
/**
 * Read the config from `convex.json` and bundle all the modules.
 */
export declare function readConfig(ctx: Context, verbose: boolean): Promise<{
    config: Config;
    configPath: string;
    bundledModuleInfos: BundledModuleInfo[];
}>;
export declare function upgradeOldAuthInfoToAuthConfig(ctx: Context, config: ProjectConfig, functionsPath: string): Promise<ProjectConfig>;
/** Write the config to `convex.json` in the current working directory. */
export declare function writeProjectConfig(ctx: Context, projectConfig: ProjectConfig, { deleteIfAllDefault }?: {
    deleteIfAllDefault: boolean;
}): Promise<undefined>;
export declare function removedExistingConfig(ctx: Context, configPath: string, options: {
    allowExistingConfig?: boolean;
}): boolean;
/** Pull configuration from the given remote origin. */
export declare function pullConfig(ctx: Context, project: string | undefined, team: string | undefined, origin: string, adminKey: string): Promise<ConfigWithModuleHashes>;
interface BundledModuleInfo {
    name: string;
    platform: "node" | "convex";
}
/**
 * A component definition spec contains enough information to create bundles
 * of code that must be analyzed in order to construct a ComponentDefinition.
 *
 * Most paths are relative to the directory of the definitionPath.
 */
export type ComponentDefinitionSpec = {
    /** This path is relative to the app (root component) directory. */
    definitionPath: ComponentDefinitionPath;
    /** Dependencies are paths to the directory of the dependency component definition from the app (root component) directory */
    dependencies: ComponentDefinitionPath[];
    definition: Bundle;
    schema: Bundle;
    functions: Bundle[];
};
export type AppDefinitionSpec = Omit<ComponentDefinitionSpec, "definitionPath"> & {
    auth: Bundle | null;
};
export type ComponentDefinitionSpecWithoutImpls = Omit<ComponentDefinitionSpec, "schema" | "functions">;
export type AppDefinitionSpecWithoutImpls = Omit<AppDefinitionSpec, "schema" | "functions" | "auth">;
type ModuleDiffStat = {
    count: number;
    size: number;
};
export type ModuleDiffStats = {
    updated: ModuleDiffStat;
    identical: ModuleDiffStat;
    added: ModuleDiffStat;
    numDropped: number;
};
/** Generate a human-readable diff between the two configs. */
export declare function diffConfig(oldConfig: ConfigWithModuleHashes, newConfig: Config, shouldDiffModules: boolean): {
    diffString: string;
    stats?: ModuleDiffStats | undefined;
};
/** Handle an error from
 * legacy push path:
 * - /api/push_config
 * modern push paths:
 * - /api/deploy2/evaluate_push
 * - /api/deploy2/start_push
 * - /api/deploy2/finish_push
 *
 * finish_push errors are different from start_push errors and in theory could
 * be handled differently, but starting over works for all of them.
 */
export declare function handlePushConfigError(ctx: Context, error: unknown, defaultMessage: string, deploymentName: string | null, deployment?: {
    deploymentUrl: string;
    adminKey: string;
    deploymentNotice: string;
}): Promise<never>;
//# sourceMappingURL=config.d.ts.map