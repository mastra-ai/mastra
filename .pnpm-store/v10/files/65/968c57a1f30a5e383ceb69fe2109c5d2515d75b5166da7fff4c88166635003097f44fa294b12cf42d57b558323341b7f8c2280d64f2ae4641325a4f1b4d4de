import path from "path";
import prettier from "prettier";
import { withTmpDir, TempDir } from "../../bundler/fs.js";
import { entryPoints } from "../../bundler/index.js";
import { apiCodegen } from "../codegen_templates/api.js";
import { apiCjsCodegen } from "../codegen_templates/api_cjs.js";
import {
  dynamicDataModelDTS,
  dynamicDataModelTS,
  noSchemaDataModelDTS,
  noSchemaDataModelTS,
  staticDataModelDTS,
  staticDataModelTS,
} from "../codegen_templates/dataModel.js";
import { readmeCodegen } from "../codegen_templates/readme.js";
import { serverCodegen } from "../codegen_templates/server.js";
import { tsconfigCodegen } from "../codegen_templates/tsconfig.js";
import { Context } from "../../bundler/context.js";
import {
  logError,
  logMessage,
  logOutput,
  logVerbose,
} from "../../bundler/log.js";
import { typeCheckFunctionsInMode, TypeCheckMode } from "./typecheck.js";
import {
  configFilepath,
  readProjectConfig,
  usesTypeScriptCodegen,
  usesComponentApiImports,
} from "./config.js";
import { recursivelyDelete } from "./fsUtils.js";
import { componentServerTS } from "../codegen_templates/component_server.js";
import {
  ComponentDirectory,
  isComponentDirectory,
} from "./components/definition/directoryStructure.js";
import { StartPushResponse } from "./deployApi/startPush.js";
import {
  componentApiDTS,
  componentApiJs,
  componentApiStubDTS,
  componentApiStubTS,
  componentApiTSWithTypes,
  componentTS,
  rootComponentApiCJS,
} from "../codegen_templates/component_api.js";
import { functionsDir } from "./utils/utils.js";
import { LargeIndexDeletionCheck } from "./indexes.js";

export type CodegenOptions = {
  url?: string | undefined;
  adminKey?: string | undefined;
  dryRun: boolean;
  debug: boolean;
  typecheck: TypeCheckMode;
  init: boolean;
  commonjs: boolean;
  liveComponentSources: boolean;
  debugNodeApis: boolean;
  systemUdfs: boolean;
  largeIndexDeletionCheck: LargeIndexDeletionCheck;
  codegenOnlyThisComponent?: string | undefined;
};

export async function doCodegenForNewProject(ctx: Context) {
  const { projectConfig: existingProjectConfig } = await readProjectConfig(ctx);
  const configPath = await configFilepath(ctx);
  const functionsPath = functionsDir(configPath, existingProjectConfig);
  await doInitCodegen(ctx, functionsPath, true);

  const componentDir = isComponentDirectory(ctx, functionsPath, true);
  if (componentDir.kind === "err") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Invalid component directory: ${componentDir.why}`,
    });
  }

  if (componentDir.component.isRootWithoutConfig) {
    // Disable typechecking since there isn't any code yet.
    await doCodegen(ctx, functionsPath, "disable");
  } else {
    await withTmpDir(async (tmpDir) => {
      await doInitialComponentCodegen(ctx, tmpDir, componentDir.component);
    });
  }
}

export async function doInitCodegen(
  ctx: Context,
  functionsDir: string,
  skipIfExists: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
): Promise<void> {
  await prepareForCodegen(ctx, functionsDir, opts);
  await withTmpDir(async (tmpDir) => {
    await doReadmeCodegen(ctx, tmpDir, functionsDir, skipIfExists, opts);
    await doTsconfigCodegen(ctx, tmpDir, functionsDir, skipIfExists, opts);
  });
}

async function prepareForCodegen(
  ctx: Context,
  functionsDir: string,
  opts?: { dryRun?: boolean },
) {
  // Delete the old _generated.ts because v0.1.2 used to put the react generated
  // code there
  const legacyCodegenPath = path.join(functionsDir, "_generated.ts");
  if (ctx.fs.exists(legacyCodegenPath)) {
    if (opts?.dryRun) {
      logError(
        `Command would delete legacy codegen file: ${legacyCodegenPath}}`,
      );
    } else {
      logError(`Deleting legacy codegen file: ${legacyCodegenPath}}`);
      ctx.fs.unlink(legacyCodegenPath);
    }
  }

  // Create the codegen dir if it doesn't already exist.
  const codegenDir = path.join(functionsDir, "_generated");
  ctx.fs.mkdir(codegenDir, { allowExisting: true, recursive: true });
  return codegenDir;
}

/** Codegen only for an application (a root component) */
export async function doCodegen(
  ctx: Context,
  functionsDir: string,
  typeCheckMode: TypeCheckMode,
  opts?: { dryRun?: boolean; generateCommonJSApi?: boolean; debug?: boolean },
) {
  const { projectConfig } = await readProjectConfig(ctx);
  const codegenDir = await prepareForCodegen(ctx, functionsDir, opts);

  await withTmpDir(async (tmpDir) => {
    // Write files in dependency order so a watching dev server doesn't
    // see inconsistent results where a file we write imports from a
    // file that doesn't exist yet. We'll collect all the paths we write
    // and then delete any remaining paths at the end.
    const writtenFiles = [];

    const useTypeScript = usesTypeScriptCodegen(projectConfig);
    const generateCommonJSApi =
      opts?.generateCommonJSApi || projectConfig.generateCommonJSApi;

    // First, `dataModel.d.ts` imports from the developer's `schema.js` file.
    const schemaFiles = await doDataModelCodegen(
      ctx,
      tmpDir,
      functionsDir,
      codegenDir,
      useTypeScript,
      opts,
    );
    writtenFiles.push(...schemaFiles);

    // Next, the `server.d.ts` file imports from `dataModel.d.ts`.
    const serverFiles = await writeServerFiles(
      ctx,
      tmpDir,
      codegenDir,
      useTypeScript,
      opts,
    );
    writtenFiles.push(...serverFiles);

    // The `api.d.ts` file imports from the developer's modules, which then
    // import from `server.d.ts`. Note that there's a cycle here, since the
    // developer's modules could also import from the `api.{js,d.ts}` files.
    const apiFiles = await doApiCodegen(
      ctx,
      tmpDir,
      functionsDir,
      codegenDir,
      useTypeScript,
      generateCommonJSApi,
      opts,
    );
    writtenFiles.push(...apiFiles);

    // Cleanup any files that weren't written in this run.
    // Skip cleanup in debug mode since we don't actually write files in that mode.
    if (!opts?.debug) {
      for (const file of ctx.fs.listDir(codegenDir)) {
        if (!writtenFiles.includes(file.name)) {
          recursivelyDelete(ctx, path.join(codegenDir, file.name), opts);
        }
      }
    }

    // Generated code is updated, typecheck the query and mutation functions.
    await typeCheckFunctionsInMode(ctx, typeCheckMode, functionsDir);
  });
}

// Just enough to be able to bundle code for analysis: we need an api proxy object
// so that imports aren't broken, we need basics in server, we need something in
// data model.
export async function doInitialComponentCodegen(
  ctx: Context,
  tmpDir: TempDir,
  componentDirectory: ComponentDirectory,
  opts?: {
    dryRun?: boolean;
    generateCommonJSApi?: boolean;
    debug?: boolean;
    verbose?: boolean;
  },
) {
  const { projectConfig } = await readProjectConfig(ctx);

  if (isPublishedPackage(componentDirectory)) {
    if (opts?.verbose) {
      logMessage(
        `skipping initial codegen for installed package ${componentDirectory.path}`,
      );
    }
    return;
  }

  const codegenDir = await prepareForCodegen(
    ctx,
    componentDirectory.path,
    opts,
  );

  // Write files in dependency order so a watching dev server doesn't
  // see inconsistent results where a file we write imports from a
  // file that doesn't exist yet. We'll collect all the paths we write
  // and then delete any remaining paths at the end.
  const writtenFiles = [];

  // Non-root components always use .ts files; root components respect the config
  // But for initial (placeholder, stub) codegen we don't care, just use .d.ts and .js.
  const useTypeScript =
    !componentDirectory.isRoot || usesTypeScriptCodegen(projectConfig);

  const generateCommonJSApi =
    opts?.generateCommonJSApi || projectConfig.generateCommonJSApi;

  // First, `dataModel.d.ts` imports from the developer's `schema.js` file.
  const dataModelFiles = await doInitialComponentDataModelCodegen(
    ctx,
    tmpDir,
    componentDirectory,
    codegenDir,
    useTypeScript,
    opts,
  );
  writtenFiles.push(...dataModelFiles);

  // Next, the `server.d.ts` file imports from `dataModel.d.ts`.
  const serverFiles = await doInitialComponentServerCodegen(
    ctx,
    componentDirectory.isRoot,
    tmpDir,
    codegenDir,
    useTypeScript,
    opts,
  );
  writtenFiles.push(...serverFiles);

  // The `api.d.ts` file imports from the developer's modules, which then
  // import from `server.d.ts`. Note that there's a cycle here, since the
  // developer's modules could also import from the `api.{js,d.ts}` files.
  const apiFiles = await doInitialComponentApiCodegen(
    ctx,
    componentDirectory.isRoot,
    tmpDir,
    codegenDir,
    useTypeScript,
    generateCommonJSApi,
    opts,
  );
  writtenFiles.push(...apiFiles);

  // component.ts is generated in doFinalComponentCodegen, but don't delete
  // if it already exists from a previous full codegen run.
  if (!componentDirectory.isRoot) {
    const componentTSPath = path.join(codegenDir, "component.ts");
    if (ctx.fs.exists(componentTSPath)) {
      writtenFiles.push("component.ts");
    }
  }

  // Cleanup any files that weren't written in this run.
  // Skip cleanup in debug mode since we don't actually write files in that mode.
  if (!opts?.debug) {
    for (const file of ctx.fs.listDir(codegenDir)) {
      if (!writtenFiles.includes(file.name)) {
        recursivelyDelete(ctx, path.join(codegenDir, file.name), opts);
      }
    }
  }
}

/* This component defined in a dist directory; it is probably in a node_module
 * directory, installed from a package. It is stuck with the files it has.
 * Heuristics for this:
 * - component definition has a dist/ directory as an ancestor
 * - component definition is a .js file
 * - presence of .js.map files
 * We may improve this heuristic.
 */
export function isPublishedPackage(componentDirectory: ComponentDirectory) {
  return (
    componentDirectory.definitionPath.endsWith(".js") &&
    !componentDirectory.isRoot
  );
}

// Handles root and non-root components; it's "component" codegen because
// it's not the old legacy path.
export async function doFinalComponentCodegen(
  ctx: Context,
  tmpDir: TempDir,
  rootComponent: ComponentDirectory,
  componentDirectory: ComponentDirectory,
  startPushResponse: StartPushResponse,
  componentsMap: Map<string, ComponentDirectory>,
  opts?: {
    dryRun?: boolean;
    debug?: boolean;
    generateCommonJSApi?: boolean;
  },
) {
  const { projectConfig } = await readProjectConfig(ctx);

  const isPublishedPackage =
    componentDirectory.definitionPath.endsWith(".js") &&
    !componentDirectory.isRoot;
  // We never codegen for a published package (you need to link to the convex.config.ts file instead).
  if (isPublishedPackage) {
    return;
  }

  const codegenDir = path.join(componentDirectory.path, "_generated");
  ctx.fs.mkdir(codegenDir, { allowExisting: true, recursive: true });

  // Non-root components always use .ts files; root components respect the config
  const useTypeScript =
    !componentDirectory.isRoot || usesTypeScriptCodegen(projectConfig);

  // `dataModel` and `api` files depend on analyze results so will get replaced
  // in the later post-analysis codegen phase,  but `server` files don't need
  // analysis info so the stubs from initial codegen are sufficient.

  // dataModel
  const hasSchemaFile = schemaFileExists(ctx, componentDirectory.path);
  let dataModelContents: string;
  if (hasSchemaFile) {
    if (projectConfig.codegen.staticDataModel) {
      dataModelContents = useTypeScript
        ? await staticDataModelTS(
            ctx,
            startPushResponse,
            rootComponent,
            componentDirectory,
          )
        : await staticDataModelDTS(
            ctx,
            startPushResponse,
            rootComponent,
            componentDirectory,
          );
    } else {
      dataModelContents = useTypeScript
        ? dynamicDataModelTS()
        : dynamicDataModelDTS();
    }
  } else {
    dataModelContents = useTypeScript
      ? noSchemaDataModelTS()
      : noSchemaDataModelDTS();
  }
  const dataModelPath = path.join(
    codegenDir,
    useTypeScript ? "dataModel.ts" : "dataModel.d.ts",
  );
  await writeFormattedFile(
    ctx,
    tmpDir,
    dataModelContents,
    "typescript",
    dataModelPath,
    opts,
  );

  // component.ts
  if (!componentDirectory.isRoot) {
    const componentTSPath = path.join(codegenDir, "component.ts");
    const componentTSContents = await componentTS(
      ctx,
      startPushResponse,
      rootComponent,
      componentDirectory,
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      componentTSContents,
      "typescript",
      componentTSPath,
      opts,
    );
  }

  // server.ts - regenerate it in final codegen for consistency, even though
  // the stub from initial codegen would be sufficient.
  await writeServerFilesForComponent(
    ctx,
    componentDirectory.isRoot,
    tmpDir,
    codegenDir,
    useTypeScript,
    opts,
  );

  // api
  if (!useTypeScript) {
    const apiDTSPath = path.join(codegenDir, "api.d.ts");
    const apiContents = await componentApiDTS(
      ctx,
      startPushResponse,
      rootComponent,
      componentDirectory,
      componentsMap,
      {
        staticApi: projectConfig.codegen.staticApi,
        useComponentApiImports: usesComponentApiImports(projectConfig),
      },
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContents,
      "typescript",
      apiDTSPath,
      opts,
    );

    if (opts?.generateCommonJSApi || projectConfig.generateCommonJSApi) {
      const apiCjsDTSPath = path.join(codegenDir, "api_cjs.d.cts");
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiContents,
        "typescript",
        apiCjsDTSPath,
        opts,
      );
    }
  } else {
    const apiTSPath = path.join(codegenDir, "api.ts");
    const apiContents = await componentApiTSWithTypes(
      ctx,
      startPushResponse,
      rootComponent,
      componentDirectory,
      componentsMap,
      {
        staticApi: projectConfig.codegen.staticApi,
        useComponentApiImports: usesComponentApiImports(projectConfig),
      },
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContents,
      "typescript",
      apiTSPath,
      opts,
    );
  }
}

async function doReadmeCodegen(
  ctx: Context,
  tmpDir: TempDir,
  functionsDir: string,
  skipIfExists: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
) {
  const readmePath = path.join(functionsDir, "README.md");
  if (skipIfExists && ctx.fs.exists(readmePath)) {
    logVerbose(`Not overwriting README.md.`);
    return;
  }
  await writeFormattedFile(
    ctx,
    tmpDir,
    readmeCodegen(),
    "markdown",
    readmePath,
    opts,
  );
}

async function doTsconfigCodegen(
  ctx: Context,
  tmpDir: TempDir,
  functionsDir: string,
  skipIfExists: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
) {
  const tsconfigPath = path.join(functionsDir, "tsconfig.json");
  if (skipIfExists && ctx.fs.exists(tsconfigPath)) {
    logVerbose(`Not overwriting tsconfig.json.`);
    return;
  }
  await writeFormattedFile(
    ctx,
    tmpDir,
    tsconfigCodegen(),
    "json",
    tsconfigPath,
    opts,
  );
}

function schemaFileExists(ctx: Context, functionsDir: string) {
  let schemaPath = path.join(functionsDir, "schema.ts");
  let hasSchemaFile = ctx.fs.exists(schemaPath);
  if (!hasSchemaFile) {
    schemaPath = path.join(functionsDir, "schema.js");
    hasSchemaFile = ctx.fs.exists(schemaPath);
  }
  return hasSchemaFile;
}

async function doDataModelCodegen(
  ctx: Context,
  tmpDir: TempDir,
  functionsDir: string,
  codegenDir: string,
  useTypeScript: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
) {
  const hasSchemaFile = schemaFileExists(ctx, functionsDir);
  const schemaContent = hasSchemaFile
    ? useTypeScript
      ? dynamicDataModelTS()
      : dynamicDataModelDTS()
    : useTypeScript
      ? noSchemaDataModelTS()
      : noSchemaDataModelDTS();

  const filename = useTypeScript ? "dataModel.ts" : "dataModel.d.ts";
  await writeFormattedFile(
    ctx,
    tmpDir,
    schemaContent,
    "typescript",
    path.join(codegenDir, filename),
    opts,
  );
  return [filename];
}

/**
 * Write server.ts/.js/.d.ts files for root components.
 * Returns list of filenames written.
 */
async function writeServerFiles(
  ctx: Context,
  tmpDir: TempDir,
  codegenDir: string,
  useTypeScript: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
): Promise<string[]> {
  if (!useTypeScript) {
    const serverContent = serverCodegen({ useTypeScript: false });
    await writeFormattedFile(
      ctx,
      tmpDir,
      serverContent.JS!,
      "typescript",
      path.join(codegenDir, "server.js"),
      opts,
    );

    await writeFormattedFile(
      ctx,
      tmpDir,
      serverContent.DTS!,
      "typescript",
      path.join(codegenDir, "server.d.ts"),
      opts,
    );

    return ["server.js", "server.d.ts"];
  } else {
    const serverContent = serverCodegen({ useTypeScript: true });
    await writeFormattedFile(
      ctx,
      tmpDir,
      serverContent.TS!,
      "typescript",
      path.join(codegenDir, "server.ts"),
      opts,
    );

    return ["server.ts"];
  }
}

/**
 * Write server.ts file for non-root components.
 * Returns list of filenames written.
 */
async function writeComponentServerFile(
  ctx: Context,
  tmpDir: TempDir,
  codegenDir: string,
  opts?: { dryRun?: boolean; debug?: boolean },
): Promise<string[]> {
  const serverTSPath = path.join(codegenDir, "server.ts");
  const serverTSContents = componentServerTS(false);
  await writeFormattedFile(
    ctx,
    tmpDir,
    serverTSContents,
    "typescript",
    serverTSPath,
    opts,
  );
  return ["server.ts"];
}

/**
 * Write server files for either root or non-root components.
 * Root components get server.ts/server.js/server.d.ts based on useTypeScript.
 * Non-root components always get server.ts.
 * Returns list of filenames written.
 */
async function writeServerFilesForComponent(
  ctx: Context,
  isRoot: boolean,
  tmpDir: TempDir,
  codegenDir: string,
  useTypeScript: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
): Promise<string[]> {
  if (isRoot) {
    return await writeServerFiles(ctx, tmpDir, codegenDir, useTypeScript, opts);
  } else {
    return await writeComponentServerFile(ctx, tmpDir, codegenDir, opts);
  }
}

async function doInitialComponentServerCodegen(
  ctx: Context,
  isRoot: boolean,
  tmpDir: TempDir,
  codegenDir: string,
  useTypeScript: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
) {
  return await writeServerFilesForComponent(
    ctx,
    isRoot,
    tmpDir,
    codegenDir,
    useTypeScript,
    opts,
  );
}

async function doInitialComponentDataModelCodegen(
  ctx: Context,
  tmpDir: TempDir,
  componentDirectory: ComponentDirectory,
  codegenDir: string,
  useTypeScript: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
) {
  const hasSchemaFile = schemaFileExists(ctx, componentDirectory.path);
  const dataModelContent = hasSchemaFile
    ? useTypeScript
      ? dynamicDataModelTS()
      : dynamicDataModelDTS()
    : useTypeScript
      ? noSchemaDataModelTS()
      : noSchemaDataModelDTS();
  const filename = useTypeScript ? "dataModel.ts" : "dataModel.d.ts";
  const dataModelPath = path.join(codegenDir, filename);

  // Don't write our stub if the file already exists, since it may have
  // better type information from `doFinalComponentDataModelCodegen`.
  if (!ctx.fs.exists(dataModelPath)) {
    await writeFormattedFile(
      ctx,
      tmpDir,
      dataModelContent,
      "typescript",
      dataModelPath,
      opts,
    );
  }
  return [filename];
}

async function doInitialComponentApiCodegen(
  ctx: Context,
  isRoot: boolean,
  tmpDir: TempDir,
  codegenDir: string,
  useTypeScript: boolean,
  generateCommonJSApi: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
) {
  const writtenFiles: string[] = [];

  if (!useTypeScript) {
    const apiJS = componentApiJs();
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiJS,
      "typescript",
      path.join(codegenDir, "api.js"),
      opts,
    );

    // Don't write the `.d.ts` stub if it already exists.
    const apiDTSPath = path.join(codegenDir, "api.d.ts");
    const apiStubDTS = componentApiStubDTS();
    if (!ctx.fs.exists(apiDTSPath)) {
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiStubDTS,
        "typescript",
        apiDTSPath,
        opts,
      );
    }

    writtenFiles.push("api.js", "api.d.ts");

    if (generateCommonJSApi && isRoot) {
      const apiCjsJS = rootComponentApiCJS();
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiCjsJS,
        "typescript",
        path.join(codegenDir, "api_cjs.cjs"),
        opts,
      );

      const cjsStubPath = path.join(codegenDir, "api_cjs.d.cts");
      if (!ctx.fs.exists(cjsStubPath)) {
        await writeFormattedFile(
          ctx,
          tmpDir,
          apiStubDTS,
          "typescript",
          cjsStubPath,
          opts,
        );
      }
      writtenFiles.push("api_cjs.cjs", "api_cjs.d.cts");
    }
  } else {
    const apiTSPath = path.join(codegenDir, "api.ts");
    const apiTS = componentApiStubTS();
    // Don't write the `.ts` stub if it already exists.
    if (!ctx.fs.exists(apiTSPath)) {
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiTS,
        "typescript",
        apiTSPath,
        opts,
      );
    }
    writtenFiles.push("api.ts");
  }

  return writtenFiles;
}

async function doApiCodegen(
  ctx: Context,
  tmpDir: TempDir,
  functionsDir: string,
  codegenDir: string,
  useTypeScript: boolean,
  generateCommonJSApi: boolean,
  opts?: { dryRun?: boolean; debug?: boolean },
) {
  const absModulePaths = await entryPoints(ctx, functionsDir);
  const modulePaths = absModulePaths
    .map((p) => path.relative(functionsDir, p))
    .sort();

  const writtenFiles: string[] = [];

  if (!useTypeScript) {
    const apiContent = apiCodegen(modulePaths, { useTypeScript: false });
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContent.JS!,
      "typescript",
      path.join(codegenDir, "api.js"),
      opts,
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContent.DTS!,
      "typescript",
      path.join(codegenDir, "api.d.ts"),
      opts,
    );
    writtenFiles.push("api.js", "api.d.ts");

    if (generateCommonJSApi) {
      const apiCjsContent = apiCjsCodegen(modulePaths);
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiCjsContent.JS!,
        "typescript",
        path.join(codegenDir, "api_cjs.cjs"),
        opts,
      );
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiCjsContent.DTS!,
        "typescript",
        path.join(codegenDir, "api_cjs.d.cts"),
        opts,
      );
      writtenFiles.push("api_cjs.cjs", "api_cjs.d.cts");
    }
  } else {
    const apiContent = apiCodegen(modulePaths, { useTypeScript: true });
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContent.TS!,
      "typescript",
      path.join(codegenDir, "api.ts"),
      opts,
    );
    writtenFiles.push("api.ts");
  }

  return writtenFiles;
}

async function writeFormattedFile(
  ctx: Context,
  tmpDir: TempDir,
  contents: string,
  filetype: string,
  destination: string,
  options?: {
    dryRun?: boolean;
    debug?: boolean;
  },
) {
  // Run prettier so we don't have to think about formatting!
  //
  // This is a little sketchy because we are using the default prettier config
  // (not our user's one) but it's better than nothing.
  const formattedContents = await prettier.format(contents, {
    parser: filetype,
    pluginSearchDirs: false,
  });
  if (options?.debug) {
    // NB: The `test_codegen_projects_are_up_to_date` smoke test depends
    // on this output format.
    logOutput(`# ${path.resolve(destination)}`);
    logOutput(formattedContents);
    return;
  }
  try {
    const existing = ctx.fs.readUtf8File(destination);
    if (existing === formattedContents) {
      return;
    }
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      // eslint-disable-next-line no-restricted-syntax
      throw err;
    }
  }
  if (options?.dryRun) {
    logOutput(`Command would write file: ${destination}`);
    return;
  }
  const tmpPath = tmpDir.writeUtf8File(formattedContents);
  ctx.fs.swapTmpFile(tmpPath, destination);
}
