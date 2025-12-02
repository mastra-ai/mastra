import chalk from "chalk";
import equal from "deep-equal";
import { EOL } from "os";
import path from "path";
import { z } from "zod";
import { Context } from "../../bundler/context.js";
import {
  changeSpinner,
  logError,
  logFailure,
  logFinishedStep,
  logMessage,
  showSpinner,
} from "../../bundler/log.js";
import {
  Bundle,
  BundleHash,
  bundle,
  bundleAuthConfig,
  entryPointsByEnvironment,
} from "../../bundler/index.js";
import { version } from "../version.js";
import { deploymentDashboardUrlPage } from "./dashboard.js";
import {
  formatSize,
  functionsDir,
  ErrorData,
  loadPackageJson,
  deploymentFetch,
  deprecationCheckWarning,
  logAndHandleFetchError,
  ThrowingFetchError,
  currentPackageHomepage,
} from "./utils/utils.js";
import { createHash } from "crypto";
import { recursivelyDelete } from "./fsUtils.js";
import { NodeDependency } from "./deployApi/modules.js";
import { ComponentDefinitionPath } from "./components/definition/directoryStructure.js";
import {
  LocalDeploymentError,
  printLocalDeploymentOnError,
} from "./localDeployment/errors.js";
import { debugIsolateBundlesSerially } from "../../bundler/debugBundle.js";
import { ensureWorkosEnvironmentProvisioned } from "./workos/workos.js";
export { productionProvisionHost, provisionHost } from "./utils/utils.js";

/** Type representing auth configuration. */
export interface AuthInfo {
  // Provider-specific application identifier. Corresponds to the `aud` field in an OIDC token.
  applicationID: string;
  // Domain used for authentication. Corresponds to the `iss` field in an OIDC token.
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
    // nodeVersion has no default value, its presence/absence is meaningful
    nodeVersion?: string | undefined;
  };
  generateCommonJSApi: boolean;
  // deprecated
  project?: string | undefined;
  // deprecated
  team?: string | undefined;
  // deprecated
  prodUrl?: string | undefined;
  // deprecated
  authInfo?: AuthInfo[] | undefined;

  codegen: {
    staticApi: boolean;
    staticDataModel: boolean;
    legacyComponentApi?: boolean;
    fileType?: "ts" | "js/dts";
  };
}

/** Type written to convex.json (where we elide deleted default values)  */
type DefaultsRemovedProjectConfig = Partial<
  Omit<ProjectConfig, "node" | "codegen"> & {
    node: Partial<ProjectConfig["node"]>;
    codegen: Partial<ProjectConfig["codegen"]>;
  }
>;

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

const DEFAULT_FUNCTIONS_PATH = "convex/";

/** Whether .ts file extensions should be used for generated code (default is false). */
export function usesTypeScriptCodegen(projectConfig: ProjectConfig): boolean {
  return projectConfig.codegen.fileType === "ts";
}

/** Whether the new component API import style should be used (default is false) */
export function usesComponentApiImports(projectConfig: ProjectConfig): boolean {
  return projectConfig.codegen.legacyComponentApi === false;
}

/** Check if object is of AuthInfo type. */
function isAuthInfo(object: any): object is AuthInfo {
  return (
    "applicationID" in object &&
    typeof object.applicationID === "string" &&
    "domain" in object &&
    typeof object.domain === "string"
  );
}

function isAuthInfos(object: any): object is AuthInfo[] {
  return Array.isArray(object) && object.every((item: any) => isAuthInfo(item));
}

/** Error parsing ProjectConfig representation. */
class ParseError extends Error {}

// Zod schema for ProjectConfig
const AuthInfoSchema = z.object({
  applicationID: z.string(),
  domain: z.string(),
});

// Separate Node and Codegen schemas so we can parse these loose or strict
const NodeSchema = z.object({
  externalPackages: z
    .array(z.string())
    .default([])
    .describe(
      "list of npm packages to install at deploy time instead of bundling. Packages with binaries should be added here.",
    ),
  nodeVersion: z
    .string()
    .optional()
    .describe("The Node.js version to use for Node.js functions"),
});

const CodegenSchema = z.object({
  staticApi: z
    .boolean()
    .default(false)
    .describe(
      "Use Convex function argument validators and return value validators to generate a typed API object",
    ),
  staticDataModel: z.boolean().default(false),
  // These optional fields have no defaults - their presence/absence is meaningful
  legacyComponentApi: z.boolean().optional(),
  fileType: z.enum(["ts", "js/dts"]).optional(),
});

const refineToObject = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine((val) => val !== null && !Array.isArray(val), {
    message: "Expected `convex.json` to contain an object",
  });

// Factory function to create schema with strict or passthrough behavior
const createProjectConfigSchema = (strict: boolean) => {
  const nodeSchema = strict ? NodeSchema.strict() : NodeSchema.passthrough();
  const codegenSchema = strict
    ? CodegenSchema.strict()
    : CodegenSchema.passthrough();

  const baseObject = z.object({
    functions: z
      .string()
      .default(DEFAULT_FUNCTIONS_PATH)
      .describe("Relative file path to the convex directory"),
    node: nodeSchema.default({ externalPackages: [] }),
    codegen: codegenSchema.default({
      staticApi: false,
      staticDataModel: false,
    }),
    generateCommonJSApi: z.boolean().default(false),

    // Optional $schema field for JSON schema validation in editors
    $schema: z.string().optional(),

    // Deprecated fields that have been deprecated for years, only here so we
    // know it's safe to delete them.
    project: z.string().optional(),
    team: z.string().optional(),
    prodUrl: z.string().optional(),
    authInfo: z.array(AuthInfoSchema).optional(),
  });

  // Apply strict or passthrough BEFORE refine
  const withStrictness = strict
    ? baseObject.strict()
    : baseObject.passthrough();

  // Now apply the refinement
  return withStrictness.refine(
    (data) => {
      // Validate that generateCommonJSApi is not true when using TypeScript codegen
      if (data.generateCommonJSApi && data.codegen.fileType === "ts") {
        return false;
      }
      return true;
    },
    {
      message:
        'Cannot use `generateCommonJSApi: true` with `codegen.fileType: "ts"`. ' +
        "CommonJS modules require JavaScript generation. " +
        'Either set `codegen.fileType: "js/dts"` or remove `generateCommonJSApi`.',
      path: ["generateCommonJSApi"],
    },
  );
};

// Parse allowing extra fields (for forward compatibility)
const ProjectConfigSchema = refineToObject(createProjectConfigSchema(false));

// Strict schema warn about extra keys
const ProjectConfigSchemaStrict = refineToObject(
  createProjectConfigSchema(true),
);

const warnedUnknownKeys = new Set<string>();
export function resetUnknownKeyWarnings() {
  warnedUnknownKeys.clear();
}

/** Parse object to ProjectConfig. */
export async function parseProjectConfig(
  ctx: Context,
  obj: any,
): Promise<ProjectConfig> {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Expected `convex.json` to contain an object",
    });
  }

  try {
    // Try strict parse first to detect unknown keys
    return ProjectConfigSchemaStrict.parse(obj);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Check if all issues are unrecognized_keys issues
      const unknownKeyIssues = error.issues.filter(
        (issue) => issue.code === "unrecognized_keys",
      );

      if (
        unknownKeyIssues.length > 0 &&
        unknownKeyIssues.length === error.issues.length
      ) {
        // All errors are just unknown keys - warn about them
        for (const issue of unknownKeyIssues) {
          if (issue.code === "unrecognized_keys") {
            const pathPrefix =
              issue.path.length > 0 ? issue.path.join(".") + "." : "";
            const unknownKeys = issue.keys as string[];
            const newUnknownKeys = unknownKeys.filter(
              (key) => !warnedUnknownKeys.has(pathPrefix + key),
            );

            if (newUnknownKeys.length > 0) {
              const fullPath =
                issue.path.length > 0
                  ? `\`${issue.path.join(".")}\``
                  : "`convex.json`";
              logMessage(
                chalk.yellow(
                  `Warning: Unknown ${newUnknownKeys.length === 1 ? "property" : "properties"} in ${fullPath}: ${newUnknownKeys.map((k) => `\`${k}\``).join(", ")}`,
                ),
              );
              logMessage(
                chalk.gray(
                  "  These properties will be preserved but are not recognized by this version of Convex.",
                ),
              );

              // Track that we've warned about these keys
              newUnknownKeys.forEach((key) =>
                warnedUnknownKeys.add(pathPrefix + key),
              );
            }
          }
        }
        // Re-parse with passthrough schema to preserve unknown keys
        return ProjectConfigSchema.parse(obj);
      }

      // Handle validation errors we won't ignore
      if (error instanceof z.ZodError) {
        const issue = error.issues[0];
        const pathStr = issue.path.join(".");
        const message = pathStr
          ? `\`${pathStr}\` in \`convex.json\`: ${issue.message}`
          : `\`convex.json\`: ${issue.message}`;
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: message,
        });
      }
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: (error as any).toString(),
    });
  }
}

// Parse a deployment config returned by the backend, picking out
// the fields we care about.
function parseBackendConfig(obj: any): {
  functions: string;
  authInfo?: AuthInfo[];
  nodeVersion?: string;
} {
  function throwParseError(message: string) {
    // Unexpected error
    // eslint-disable-next-line no-restricted-syntax
    throw new ParseError(message);
  }
  if (typeof obj !== "object") {
    throwParseError("Expected an object");
  }
  const { functions, authInfo, nodeVersion } = obj;
  if (typeof functions !== "string") {
    throwParseError("Expected functions to be a string");
  }

  // Allow the `authInfo` key to be omitted
  if ((authInfo ?? null) !== null && !isAuthInfos(authInfo)) {
    throwParseError("Expected authInfo to be type AuthInfo[]");
  }

  if (typeof nodeVersion !== "undefined" && typeof nodeVersion !== "string") {
    throwParseError("Expected nodeVersion to be a string");
  }

  return {
    functions,
    ...((authInfo ?? null) !== null ? { authInfo: authInfo } : {}),
    ...((nodeVersion ?? null) !== null ? { nodeVersion: nodeVersion } : {}),
  };
}

export function configName(): string {
  return "convex.json";
}

export async function configFilepath(ctx: Context): Promise<string> {
  const configFn = configName();
  // We used to allow src/convex.json, but no longer (as of 10/7/2022).
  // Leave an error message around to help people out. We can remove this
  // error message after a couple months.
  const preferredLocation = configFn;
  const wrongLocation = path.join("src", configFn);

  // Allow either location, but not both.
  const preferredLocationExists = ctx.fs.exists(preferredLocation);
  const wrongLocationExists = ctx.fs.exists(wrongLocation);
  if (preferredLocationExists && wrongLocationExists) {
    const message = `${chalk.red(`Error: both ${preferredLocation} and ${wrongLocation} files exist!`)}\nConsolidate these and remove ${wrongLocation}.`;
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: message,
    });
  }
  if (!preferredLocationExists && wrongLocationExists) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Error: Please move ${wrongLocation} to the root of your project`,
    });
  }

  return preferredLocation;
}

export async function getFunctionsDirectoryPath(ctx: Context): Promise<string> {
  const { projectConfig, configPath } = await readProjectConfig(ctx);
  return functionsDir(configPath, projectConfig);
}

/** Read configuration from a local `convex.json` file. */
export async function readProjectConfig(ctx: Context): Promise<{
  projectConfig: ProjectConfig;
  configPath: string;
}> {
  if (!ctx.fs.exists("convex.json")) {
    // create-react-app bans imports from outside of src, so we can just
    // put the functions directory inside of src/ to work around this issue.
    const packages = await loadPackageJson(ctx);
    const isCreateReactApp = "react-scripts" in packages;
    return {
      projectConfig: {
        functions: isCreateReactApp
          ? `src/${DEFAULT_FUNCTIONS_PATH}`
          : DEFAULT_FUNCTIONS_PATH,
        node: {
          externalPackages: [],
        },
        generateCommonJSApi: false,
        codegen: {
          staticApi: false,
          staticDataModel: false,
        },
      },
      configPath: configName(),
    };
  }
  let projectConfig;
  const configPath = await configFilepath(ctx);
  try {
    projectConfig = await parseProjectConfig(
      ctx,
      JSON.parse(ctx.fs.readUtf8File(configPath)),
    );
  } catch (err) {
    if (err instanceof ParseError || err instanceof SyntaxError) {
      logError(chalk.red(`Error: Parsing "${configPath}" failed`));
      logMessage(chalk.gray(err.toString()));
    } else {
      logFailure(
        `Error: Unable to read project config file "${configPath}"\n` +
          "  Are you running this command from the root directory of a Convex project? If so, run `npx convex dev` first.",
      );
      if (err instanceof Error) {
        logError(chalk.red(err.message));
      }
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      // TODO -- move the logging above in here
      printedMessage: null,
    });
  }
  return {
    projectConfig,
    configPath,
  };
}

export async function enforceDeprecatedConfigField(
  ctx: Context,
  config: ProjectConfig,
  field: "team" | "project" | "prodUrl",
): Promise<string> {
  const value = config[field];
  if (typeof value === "string") {
    return value;
  }
  const err = new ParseError(`Expected ${field} to be a string`);
  return await ctx.crash({
    exitCode: 1,
    errorType: "invalid filesystem data",
    errForSentry: err,
    printedMessage: `Error: Parsing convex.json failed:\n${chalk.gray(err.toString())}`,
  });
}

/**
 * Given a {@link ProjectConfig}, add in the bundled modules to produce the
 * complete config.
 */
export async function configFromProjectConfig(
  ctx: Context,
  projectConfig: ProjectConfig,
  configPath: string,
  verbose: boolean,
): Promise<{
  config: Config;
  bundledModuleInfos: BundledModuleInfo[];
}> {
  const baseDir = functionsDir(configPath, projectConfig);
  // We bundle Node.js and Convex JS runtime functions entry points separately
  // since they execute on different platforms.
  const entryPoints = await entryPointsByEnvironment(ctx, baseDir);
  // es-build prints errors to console which would clobber our spinner.
  if (verbose) {
    showSpinner("Bundling modules for Convex's runtime...");
  }
  const convexResult = await bundle(
    ctx,
    baseDir,
    entryPoints.isolate,
    true,
    "browser",
  );
  if (verbose) {
    logMessage(
      "Convex's runtime modules: ",
      convexResult.modules.map((m) => m.path),
    );
  }

  // Bundle node modules.
  if (verbose && entryPoints.node.length !== 0) {
    showSpinner("Bundling modules for Node.js runtime...");
  }
  const nodeResult = await bundle(
    ctx,
    baseDir,
    entryPoints.node,
    true,
    "node",
    path.join("_deps", "node"),
    projectConfig.node.externalPackages,
  );
  if (verbose && entryPoints.node.length !== 0) {
    logMessage(
      "Node.js runtime modules: ",
      nodeResult.modules.map((m) => m.path),
    );
    if (projectConfig.node.externalPackages.length > 0) {
      logMessage(
        "Node.js runtime external dependencies (to be installed on the server): ",
        [...nodeResult.externalDependencies.entries()].map(
          (a) => `${a[0]}: ${a[1]}`,
        ),
      );
    }
  }
  const modules = convexResult.modules;
  modules.push(...nodeResult.modules);
  modules.push(...(await bundleAuthConfig(ctx, baseDir)));

  const nodeDependencies: NodeDependency[] = [];
  for (const [moduleName, moduleVersion] of nodeResult.externalDependencies) {
    nodeDependencies.push({ name: moduleName, version: moduleVersion });
  }

  const bundledModuleInfos: BundledModuleInfo[] = Array.from(
    convexResult.bundledModuleNames.keys(),
  ).map((moduleName) => {
    return {
      name: moduleName,
      platform: "convex",
    };
  });
  bundledModuleInfos.push(
    ...Array.from(nodeResult.bundledModuleNames.keys()).map(
      (moduleName): BundledModuleInfo => {
        return {
          name: moduleName,
          platform: "node",
        };
      },
    ),
  );

  return {
    config: {
      projectConfig: projectConfig,
      modules: modules,
      nodeDependencies: nodeDependencies,
      // We're just using the version this CLI is running with for now.
      // This could be different than the version of `convex` the app runs with
      // if the CLI is installed globally.
      udfServerVersion: version,
      nodeVersion: projectConfig.node.nodeVersion,
    },
    bundledModuleInfos,
  };
}

/**
 * Bundle modules one by one for good bundler errors.
 */
export async function debugIsolateEndpointBundles(
  ctx: Context,
  projectConfig: ProjectConfig,
  configPath: string,
): Promise<void> {
  const baseDir = functionsDir(configPath, projectConfig);
  const entryPoints = await entryPointsByEnvironment(ctx, baseDir);
  if (entryPoints.isolate.length === 0) {
    logFinishedStep("No non-'use node' modules found.");
  }
  await debugIsolateBundlesSerially(ctx, {
    entryPoints: entryPoints.isolate,
    extraConditions: [],
    dir: baseDir,
  });
}

/**
 * Read the config from `convex.json` and bundle all the modules.
 */
export async function readConfig(
  ctx: Context,
  verbose: boolean,
): Promise<{
  config: Config;
  configPath: string;
  bundledModuleInfos: BundledModuleInfo[];
}> {
  const { projectConfig, configPath } = await readProjectConfig(ctx);
  const { config, bundledModuleInfos } = await configFromProjectConfig(
    ctx,
    projectConfig,
    configPath,
    verbose,
  );
  return { config, configPath, bundledModuleInfos };
}

export async function upgradeOldAuthInfoToAuthConfig(
  ctx: Context,
  config: ProjectConfig,
  functionsPath: string,
) {
  if (config.authInfo !== undefined) {
    const authConfigPathJS = path.resolve(functionsPath, "auth.config.js");
    const authConfigPathTS = path.resolve(functionsPath, "auth.config.js");
    const authConfigPath = ctx.fs.exists(authConfigPathJS)
      ? authConfigPathJS
      : authConfigPathTS;
    const authConfigRelativePath = path.join(
      config.functions,
      ctx.fs.exists(authConfigPathJS) ? "auth.config.js" : "auth.config.ts",
    );
    if (ctx.fs.exists(authConfigPath)) {
      await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage:
          `Cannot set auth config in both \`${authConfigRelativePath}\` and convex.json,` +
          ` remove it from convex.json`,
      });
    }
    if (config.authInfo.length > 0) {
      const providersStringLines = JSON.stringify(
        config.authInfo,
        null,
        2,
      ).split(EOL);
      const indentedProvidersString = [providersStringLines[0]]
        .concat(providersStringLines.slice(1).map((line) => `  ${line}`))
        .join(EOL);
      ctx.fs.writeUtf8File(
        authConfigPath,
        `\
  export default {
    providers: ${indentedProvidersString},
  };`,
      );
      logMessage(
        chalk.yellowBright(
          `Moved auth config from config.json to \`${authConfigRelativePath}\``,
        ),
      );
    }
    delete config.authInfo;
  }
  return config;
}

/** Write the config to `convex.json` in the current working directory. */
export async function writeProjectConfig(
  ctx: Context,
  projectConfig: ProjectConfig,
  { deleteIfAllDefault }: { deleteIfAllDefault: boolean } = {
    deleteIfAllDefault: false,
  },
) {
  const configPath = await configFilepath(ctx);
  const strippedConfig = filterWriteableConfig(stripDefaults(projectConfig));
  if (Object.keys(strippedConfig).length > 0) {
    try {
      const contents = JSON.stringify(strippedConfig, undefined, 2) + "\n";
      ctx.fs.writeUtf8File(configPath, contents, 0o644);
    } catch (err) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        errForSentry: err,
        printedMessage:
          `Error: Unable to write project config file "${configPath}" in current directory\n` +
          "  Are you running this command from the root directory of a Convex project?",
      });
    }
  } else if (deleteIfAllDefault && ctx.fs.exists(configPath)) {
    ctx.fs.unlink(configPath);
    logMessage(
      chalk.yellowBright(
        `Deleted ${configPath} since it completely matched defaults`,
      ),
    );
  }
  ctx.fs.mkdir(functionsDir(configPath, projectConfig), {
    allowExisting: true,
  });
}

function stripDefaults(
  projectConfig: ProjectConfig,
): DefaultsRemovedProjectConfig {
  const stripped: DefaultsRemovedProjectConfig = JSON.parse(
    JSON.stringify(projectConfig),
  );
  if (stripped.functions === DEFAULT_FUNCTIONS_PATH) {
    delete stripped.functions;
  }
  if (Array.isArray(stripped.authInfo) && stripped.authInfo.length === 0) {
    delete stripped.authInfo;
  }
  if (stripped.node!.externalPackages!.length === 0) {
    delete stripped.node!.externalPackages;
  }
  if (stripped.generateCommonJSApi === false) {
    delete stripped.generateCommonJSApi;
  }
  // Remove "node" field if it has nothing nested under it
  if (Object.keys(stripped!.node!).length === 0) {
    delete stripped.node;
  }
  if (stripped.codegen!.staticApi === false) {
    delete stripped.codegen!.staticApi;
  }
  if (stripped.codegen!.staticDataModel === false) {
    delete stripped.codegen!.staticDataModel;
  }

  // `"fileType"` and `"legacyComponentApi"` are optional and undefined by
  // default, and the behavior of undefined may change in the future for these
  // so we don't want to strip them.

  if (Object.keys(stripped.codegen!).length === 0) {
    delete stripped.codegen;
  }
  return stripped;
}

function filterWriteableConfig(
  projectConfig: DefaultsRemovedProjectConfig,
): DefaultsRemovedProjectConfig {
  const writeable: any = { ...projectConfig };
  delete writeable.project;
  delete writeable.team;
  delete writeable.prodUrl;
  return writeable;
}

export function removedExistingConfig(
  ctx: Context,
  configPath: string,
  options: { allowExistingConfig?: boolean },
) {
  if (!options.allowExistingConfig) {
    return false;
  }
  recursivelyDelete(ctx, configPath);
  logFinishedStep(`Removed existing ${configPath}`);
  return true;
}

/** Pull configuration from the given remote origin. */
export async function pullConfig(
  ctx: Context,
  project: string | undefined,
  team: string | undefined,
  origin: string,
  adminKey: string,
): Promise<ConfigWithModuleHashes> {
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: origin,
    adminKey,
  });

  changeSpinner("Downloading current deployment state...");
  try {
    const res = await fetch("/api/get_config_hashes", {
      method: "POST",
      body: JSON.stringify({ version, adminKey }),
    });
    deprecationCheckWarning(ctx, res);
    const data = await res.json();
    const backendConfig = parseBackendConfig(data.config);
    const projectConfig = {
      ...backendConfig,
      node: {
        // This field is not stored in the backend, which is ok since it is also
        // not used to diff configs.
        externalPackages: [],
        nodeVersion: data.nodeVersion,
      },
      // This field is not stored in the backend, it only affects the client.
      generateCommonJSApi: false,
      // This field is also not stored in the backend, it only affects the client.
      codegen: {
        staticApi: false,
        staticDataModel: false,
      },
      project,
      team,
      prodUrl: origin,
    };
    return {
      projectConfig,
      moduleHashes: data.moduleHashes,
      // TODO(presley): Add this to diffConfig().
      nodeDependencies: data.nodeDependencies,
      udfServerVersion: data.udfServerVersion,
    };
  } catch (err: unknown) {
    logFailure(`Error: Unable to pull deployment config from ${origin}`);
    return await logAndHandleFetchError(ctx, err);
  }
}

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

  // All other paths are relative to the directory of the definitionPath above.
  definition: Bundle;
  schema: Bundle;
  functions: Bundle[];
};

export type AppDefinitionSpec = Omit<
  ComponentDefinitionSpec,
  "definitionPath"
> & {
  // Only app (root) component specs contain an auth bundle.
  auth: Bundle | null;
};

export type ComponentDefinitionSpecWithoutImpls = Omit<
  ComponentDefinitionSpec,
  "schema" | "functions"
>;
export type AppDefinitionSpecWithoutImpls = Omit<
  AppDefinitionSpec,
  "schema" | "functions" | "auth"
>;

function renderModule(module: {
  path: string;
  sourceMapSize: number;
  sourceSize: number;
}): string {
  return (
    module.path +
    ` (${formatSize(module.sourceSize)}, source map ${module.sourceMapSize})`
  );
}

function hash(bundle: Bundle) {
  return createHash("sha256")
    .update(bundle.source)
    .update(bundle.sourceMap || "")
    .digest("hex");
}

type ModuleDiffStat = { count: number; size: number };
export type ModuleDiffStats = {
  updated: ModuleDiffStat;
  identical: ModuleDiffStat;
  added: ModuleDiffStat;
  numDropped: number;
};

function compareModules(
  oldModules: BundleHash[],
  newModules: Bundle[],
): {
  diffString: string;
  stats: ModuleDiffStats;
} {
  let diff = "";
  const oldModuleMap = new Map(
    oldModules.map((value) => [value.path, value.hash]),
  );
  const newModuleMap = new Map(
    newModules.map((value) => [
      value.path,
      {
        hash: hash(value),
        sourceMapSize: value.sourceMap?.length ?? 0,
        sourceSize: value.source.length,
      },
    ]),
  );
  const updatedModules: Array<{
    path: string;
    sourceMapSize: number;
    sourceSize: number;
  }> = [];
  const identicalModules: Array<{ path: string; size: number }> = [];
  const droppedModules: Array<string> = [];
  const addedModules: Array<{
    path: string;
    sourceMapSize: number;
    sourceSize: number;
  }> = [];
  for (const [path, oldHash] of oldModuleMap.entries()) {
    const newModule = newModuleMap.get(path);
    if (newModule === undefined) {
      droppedModules.push(path);
    } else if (newModule.hash !== oldHash) {
      updatedModules.push({
        path,
        sourceMapSize: newModule.sourceMapSize,
        sourceSize: newModule.sourceSize,
      });
    } else {
      identicalModules.push({
        path,
        size: newModule.sourceSize + newModule.sourceMapSize,
      });
    }
  }
  for (const [path, newModule] of newModuleMap.entries()) {
    if (oldModuleMap.get(path) === undefined) {
      addedModules.push({
        path,
        sourceMapSize: newModule.sourceMapSize,
        sourceSize: newModule.sourceSize,
      });
    }
  }
  if (droppedModules.length > 0 || updatedModules.length > 0) {
    diff += "Delete the following modules:\n";
    for (const module of droppedModules) {
      diff += `[-] ${module}\n`;
    }
    for (const module of updatedModules) {
      diff += `[-] ${module.path}\n`;
    }
  }

  if (addedModules.length > 0 || updatedModules.length > 0) {
    diff += "Add the following modules:\n";
    for (const module of addedModules) {
      diff += "[+] " + renderModule(module) + "\n";
    }
    for (const module of updatedModules) {
      diff += "[+] " + renderModule(module) + "\n";
    }
  }

  return {
    diffString: diff,
    stats: {
      updated: {
        count: updatedModules.length,
        size: updatedModules.reduce((acc, curr) => {
          return acc + curr.sourceMapSize + curr.sourceSize;
        }, 0),
      },
      identical: {
        count: identicalModules.length,
        size: identicalModules.reduce((acc, curr) => {
          return acc + curr.size;
        }, 0),
      },
      added: {
        count: addedModules.length,
        size: addedModules.reduce((acc, curr) => {
          return acc + curr.sourceMapSize + curr.sourceSize;
        }, 0),
      },
      numDropped: droppedModules.length,
    },
  };
}

/** Generate a human-readable diff between the two configs. */
export function diffConfig(
  oldConfig: ConfigWithModuleHashes,
  newConfig: Config,
  // We don't want to diff modules on the components push path
  // because it has its own diffing logic.
  shouldDiffModules: boolean,
): { diffString: string; stats?: ModuleDiffStats | undefined } {
  let diff = "";
  let stats: ModuleDiffStats | undefined;
  if (shouldDiffModules) {
    const { diffString, stats: moduleStats } = compareModules(
      oldConfig.moduleHashes,
      newConfig.modules,
    );
    diff = diffString;
    stats = moduleStats;
  }
  const droppedAuth = [];
  if (
    oldConfig.projectConfig.authInfo !== undefined &&
    newConfig.projectConfig.authInfo !== undefined
  ) {
    for (const oldAuth of oldConfig.projectConfig.authInfo) {
      let matches = false;
      for (const newAuth of newConfig.projectConfig.authInfo) {
        if (equal(oldAuth, newAuth)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        droppedAuth.push(oldAuth);
      }
    }
    if (droppedAuth.length > 0) {
      diff += "Remove the following auth providers:\n";
      for (const authInfo of droppedAuth) {
        diff += "[-] " + JSON.stringify(authInfo) + "\n";
      }
    }

    const addedAuth = [];
    for (const newAuth of newConfig.projectConfig.authInfo) {
      let matches = false;
      for (const oldAuth of oldConfig.projectConfig.authInfo) {
        if (equal(newAuth, oldAuth)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        addedAuth.push(newAuth);
      }
    }
    if (addedAuth.length > 0) {
      diff += "Add the following auth providers:\n";
      for (const auth of addedAuth) {
        diff += "[+] " + JSON.stringify(auth) + "\n";
      }
    }
  } else if (
    (oldConfig.projectConfig.authInfo !== undefined) !==
    (newConfig.projectConfig.authInfo !== undefined)
  ) {
    diff += "Moved auth config into auth.config.ts\n";
  }

  let versionMessage = "";
  const matches = oldConfig.udfServerVersion === newConfig.udfServerVersion;
  if (oldConfig.udfServerVersion && (!newConfig.udfServerVersion || !matches)) {
    versionMessage += `[-] ${oldConfig.udfServerVersion}\n`;
  }
  if (newConfig.udfServerVersion && (!oldConfig.udfServerVersion || !matches)) {
    versionMessage += `[+] ${newConfig.udfServerVersion}\n`;
  }
  if (versionMessage) {
    diff += "Change the server's function version:\n";
    diff += versionMessage;
  }

  if (oldConfig.projectConfig.node.nodeVersion !== newConfig.nodeVersion) {
    diff += "Change the server's version for Node.js actions:\n";
    if (oldConfig.projectConfig.node.nodeVersion) {
      diff += `[-] ${oldConfig.projectConfig.node.nodeVersion}\n`;
    }
    if (newConfig.nodeVersion) {
      diff += `[+] ${newConfig.nodeVersion}\n`;
    }
  }

  return { diffString: diff, stats };
}

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
export async function handlePushConfigError(
  ctx: Context,
  error: unknown,
  defaultMessage: string,
  deploymentName: string | null,
  deployment?: {
    deploymentUrl: string;
    adminKey: string;
    deploymentNotice: string;
  },
): Promise<never> {
  const data: ErrorData | undefined =
    error instanceof ThrowingFetchError ? error.serverErrorData : undefined;
  if (data?.code === "AuthConfigMissingEnvironmentVariable") {
    const errorMessage = data.message || "(no error message given)";
    const [, variableName] =
      errorMessage.match(/Environment variable (\S+)/i) ?? [];

    // WORKOS_CLIENT_ID is a special environment variable because cloud Convex
    // deployments may be able to supply it by provisioning a fresh WorkOS
    // environment on demand.
    if (variableName === "WORKOS_CLIENT_ID" && deploymentName && deployment) {
      // Initially only specific templates create WorkOS environments on demand
      // because the local environemnt variables are hardcoded for Vite and Next.js.
      const homepage = await currentPackageHomepage(ctx);
      const autoProvisionIfWorkOSTeamAssociated = !!(
        homepage &&
        [
          // FIXME: We don't want to rely on `homepage` from `package.json` for this
          // because it's brittle, and because AuthKit templates are now in get-convex/templates
          "https://github.com/workos/template-convex-nextjs-authkit/#readme",
          "https://github.com/workos/template-convex-react-vite-authkit/#readme",
          "https://github.com:workos/template-convex-react-vite-authkit/#readme",
          "https://github.com/workos/template-convex-tanstack-start-authkit/#readme",
        ].includes(homepage)
      );
      // Initially only specific templates offer team creation.
      // Until this changes it can be done manually with a CLI command.
      const offerToAssociateWorkOSTeam = autoProvisionIfWorkOSTeamAssociated;
      // Initialy only specific template auto-configure WorkOS environments
      // with AuthKit config because these values are currently heuristics.
      // This will be some more explicit opt-in in the future.
      const autoConfigureAuthkitConfig = autoProvisionIfWorkOSTeamAssociated;

      const result = await ensureWorkosEnvironmentProvisioned(
        ctx,
        deploymentName,
        deployment,
        {
          offerToAssociateWorkOSTeam,
          autoProvisionIfWorkOSTeamAssociated,
          autoConfigureAuthkitConfig,
        },
      );
      if (result === "ready") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "already handled",
          printedMessage: null,
        });
      }
    }

    const envVarMessage =
      `Environment variable ${chalk.bold(
        variableName,
      )} is used in auth config file but ` + `its value was not set.`;
    let setEnvVarInstructions =
      "Go set it in the dashboard or using `npx convex env set`";

    // If `npx convex dev` is running using --url there might not be a configured deployment
    if (deploymentName !== null) {
      const variableQuery =
        variableName !== undefined ? `?var=${variableName}` : "";
      const dashboardUrl = deploymentDashboardUrlPage(
        deploymentName,
        `/settings/environment-variables${variableQuery}`,
      );
      setEnvVarInstructions = `Go to:\n\n    ${chalk.bold(
        dashboardUrl,
      )}\n\n  to set it up. `;
    }
    await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem or env vars",
      errForSentry: error,
      printedMessage: envVarMessage + "\n" + setEnvVarInstructions,
    });
  }

  if (data?.code === "RaceDetected") {
    // Environment variables or schema changed during push. This is a transient
    // error that should be retried immediately with exponential backoff.
    const message =
      data.message || "Schema or environment variables changed during push";
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: error,
      printedMessage: chalk.yellow(message),
    });
  }

  if (data?.code === "InternalServerError") {
    if (deploymentName?.startsWith("local-")) {
      printLocalDeploymentOnError();
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: new LocalDeploymentError(
          "InternalServerError while pushing to local deployment",
        ),
        printedMessage: defaultMessage,
      });
    }
  }

  logFailure(defaultMessage);
  return await logAndHandleFetchError(ctx, error);
}
