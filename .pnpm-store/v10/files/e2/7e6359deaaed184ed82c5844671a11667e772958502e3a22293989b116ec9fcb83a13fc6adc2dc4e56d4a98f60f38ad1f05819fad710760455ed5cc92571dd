"use strict";
import path from "path";
import prettier from "prettier";
import { withTmpDir } from "../../bundler/fs.js";
import { entryPoints } from "../../bundler/index.js";
import { apiCodegen } from "../codegen_templates/api.js";
import { apiCjsCodegen } from "../codegen_templates/api_cjs.js";
import {
  dynamicDataModelDTS,
  dynamicDataModelTS,
  noSchemaDataModelDTS,
  noSchemaDataModelTS,
  staticDataModelDTS,
  staticDataModelTS
} from "../codegen_templates/dataModel.js";
import { readmeCodegen } from "../codegen_templates/readme.js";
import { serverCodegen } from "../codegen_templates/server.js";
import { tsconfigCodegen } from "../codegen_templates/tsconfig.js";
import {
  logError,
  logMessage,
  logOutput,
  logVerbose
} from "../../bundler/log.js";
import { typeCheckFunctionsInMode } from "./typecheck.js";
import {
  configFilepath,
  readProjectConfig,
  usesTypeScriptCodegen,
  usesComponentApiImports
} from "./config.js";
import { recursivelyDelete } from "./fsUtils.js";
import { componentServerTS } from "../codegen_templates/component_server.js";
import {
  isComponentDirectory
} from "./components/definition/directoryStructure.js";
import {
  componentApiDTS,
  componentApiJs,
  componentApiStubDTS,
  componentApiStubTS,
  componentApiTSWithTypes,
  componentTS,
  rootComponentApiCJS
} from "../codegen_templates/component_api.js";
import { functionsDir } from "./utils/utils.js";
export async function doCodegenForNewProject(ctx) {
  const { projectConfig: existingProjectConfig } = await readProjectConfig(ctx);
  const configPath = await configFilepath(ctx);
  const functionsPath = functionsDir(configPath, existingProjectConfig);
  await doInitCodegen(ctx, functionsPath, true);
  const componentDir = isComponentDirectory(ctx, functionsPath, true);
  if (componentDir.kind === "err") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Invalid component directory: ${componentDir.why}`
    });
  }
  if (componentDir.component.isRootWithoutConfig) {
    await doCodegen(ctx, functionsPath, "disable");
  } else {
    await withTmpDir(async (tmpDir) => {
      await doInitialComponentCodegen(ctx, tmpDir, componentDir.component);
    });
  }
}
export async function doInitCodegen(ctx, functionsDir2, skipIfExists, opts) {
  await prepareForCodegen(ctx, functionsDir2, opts);
  await withTmpDir(async (tmpDir) => {
    await doReadmeCodegen(ctx, tmpDir, functionsDir2, skipIfExists, opts);
    await doTsconfigCodegen(ctx, tmpDir, functionsDir2, skipIfExists, opts);
  });
}
async function prepareForCodegen(ctx, functionsDir2, opts) {
  const legacyCodegenPath = path.join(functionsDir2, "_generated.ts");
  if (ctx.fs.exists(legacyCodegenPath)) {
    if (opts?.dryRun) {
      logError(
        `Command would delete legacy codegen file: ${legacyCodegenPath}}`
      );
    } else {
      logError(`Deleting legacy codegen file: ${legacyCodegenPath}}`);
      ctx.fs.unlink(legacyCodegenPath);
    }
  }
  const codegenDir = path.join(functionsDir2, "_generated");
  ctx.fs.mkdir(codegenDir, { allowExisting: true, recursive: true });
  return codegenDir;
}
export async function doCodegen(ctx, functionsDir2, typeCheckMode, opts) {
  const { projectConfig } = await readProjectConfig(ctx);
  const codegenDir = await prepareForCodegen(ctx, functionsDir2, opts);
  await withTmpDir(async (tmpDir) => {
    const writtenFiles = [];
    const useTypeScript = usesTypeScriptCodegen(projectConfig);
    const generateCommonJSApi = opts?.generateCommonJSApi || projectConfig.generateCommonJSApi;
    const schemaFiles = await doDataModelCodegen(
      ctx,
      tmpDir,
      functionsDir2,
      codegenDir,
      useTypeScript,
      opts
    );
    writtenFiles.push(...schemaFiles);
    const serverFiles = await writeServerFiles(
      ctx,
      tmpDir,
      codegenDir,
      useTypeScript,
      opts
    );
    writtenFiles.push(...serverFiles);
    const apiFiles = await doApiCodegen(
      ctx,
      tmpDir,
      functionsDir2,
      codegenDir,
      useTypeScript,
      generateCommonJSApi,
      opts
    );
    writtenFiles.push(...apiFiles);
    if (!opts?.debug) {
      for (const file of ctx.fs.listDir(codegenDir)) {
        if (!writtenFiles.includes(file.name)) {
          recursivelyDelete(ctx, path.join(codegenDir, file.name), opts);
        }
      }
    }
    await typeCheckFunctionsInMode(ctx, typeCheckMode, functionsDir2);
  });
}
export async function doInitialComponentCodegen(ctx, tmpDir, componentDirectory, opts) {
  const { projectConfig } = await readProjectConfig(ctx);
  if (isPublishedPackage(componentDirectory)) {
    if (opts?.verbose) {
      logMessage(
        `skipping initial codegen for installed package ${componentDirectory.path}`
      );
    }
    return;
  }
  const codegenDir = await prepareForCodegen(
    ctx,
    componentDirectory.path,
    opts
  );
  const writtenFiles = [];
  const useTypeScript = !componentDirectory.isRoot || usesTypeScriptCodegen(projectConfig);
  const generateCommonJSApi = opts?.generateCommonJSApi || projectConfig.generateCommonJSApi;
  const dataModelFiles = await doInitialComponentDataModelCodegen(
    ctx,
    tmpDir,
    componentDirectory,
    codegenDir,
    useTypeScript,
    opts
  );
  writtenFiles.push(...dataModelFiles);
  const serverFiles = await doInitialComponentServerCodegen(
    ctx,
    componentDirectory.isRoot,
    tmpDir,
    codegenDir,
    useTypeScript,
    opts
  );
  writtenFiles.push(...serverFiles);
  const apiFiles = await doInitialComponentApiCodegen(
    ctx,
    componentDirectory.isRoot,
    tmpDir,
    codegenDir,
    useTypeScript,
    generateCommonJSApi,
    opts
  );
  writtenFiles.push(...apiFiles);
  if (!componentDirectory.isRoot) {
    const componentTSPath = path.join(codegenDir, "component.ts");
    if (ctx.fs.exists(componentTSPath)) {
      writtenFiles.push("component.ts");
    }
  }
  if (!opts?.debug) {
    for (const file of ctx.fs.listDir(codegenDir)) {
      if (!writtenFiles.includes(file.name)) {
        recursivelyDelete(ctx, path.join(codegenDir, file.name), opts);
      }
    }
  }
}
export function isPublishedPackage(componentDirectory) {
  return componentDirectory.definitionPath.endsWith(".js") && !componentDirectory.isRoot;
}
export async function doFinalComponentCodegen(ctx, tmpDir, rootComponent, componentDirectory, startPushResponse, componentsMap, opts) {
  const { projectConfig } = await readProjectConfig(ctx);
  const isPublishedPackage2 = componentDirectory.definitionPath.endsWith(".js") && !componentDirectory.isRoot;
  if (isPublishedPackage2) {
    return;
  }
  const codegenDir = path.join(componentDirectory.path, "_generated");
  ctx.fs.mkdir(codegenDir, { allowExisting: true, recursive: true });
  const useTypeScript = !componentDirectory.isRoot || usesTypeScriptCodegen(projectConfig);
  const hasSchemaFile = schemaFileExists(ctx, componentDirectory.path);
  let dataModelContents;
  if (hasSchemaFile) {
    if (projectConfig.codegen.staticDataModel) {
      dataModelContents = useTypeScript ? await staticDataModelTS(
        ctx,
        startPushResponse,
        rootComponent,
        componentDirectory
      ) : await staticDataModelDTS(
        ctx,
        startPushResponse,
        rootComponent,
        componentDirectory
      );
    } else {
      dataModelContents = useTypeScript ? dynamicDataModelTS() : dynamicDataModelDTS();
    }
  } else {
    dataModelContents = useTypeScript ? noSchemaDataModelTS() : noSchemaDataModelDTS();
  }
  const dataModelPath = path.join(
    codegenDir,
    useTypeScript ? "dataModel.ts" : "dataModel.d.ts"
  );
  await writeFormattedFile(
    ctx,
    tmpDir,
    dataModelContents,
    "typescript",
    dataModelPath,
    opts
  );
  if (!componentDirectory.isRoot) {
    const componentTSPath = path.join(codegenDir, "component.ts");
    const componentTSContents = await componentTS(
      ctx,
      startPushResponse,
      rootComponent,
      componentDirectory
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      componentTSContents,
      "typescript",
      componentTSPath,
      opts
    );
  }
  await writeServerFilesForComponent(
    ctx,
    componentDirectory.isRoot,
    tmpDir,
    codegenDir,
    useTypeScript,
    opts
  );
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
        useComponentApiImports: usesComponentApiImports(projectConfig)
      }
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContents,
      "typescript",
      apiDTSPath,
      opts
    );
    if (opts?.generateCommonJSApi || projectConfig.generateCommonJSApi) {
      const apiCjsDTSPath = path.join(codegenDir, "api_cjs.d.cts");
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiContents,
        "typescript",
        apiCjsDTSPath,
        opts
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
        useComponentApiImports: usesComponentApiImports(projectConfig)
      }
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContents,
      "typescript",
      apiTSPath,
      opts
    );
  }
}
async function doReadmeCodegen(ctx, tmpDir, functionsDir2, skipIfExists, opts) {
  const readmePath = path.join(functionsDir2, "README.md");
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
    opts
  );
}
async function doTsconfigCodegen(ctx, tmpDir, functionsDir2, skipIfExists, opts) {
  const tsconfigPath = path.join(functionsDir2, "tsconfig.json");
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
    opts
  );
}
function schemaFileExists(ctx, functionsDir2) {
  let schemaPath = path.join(functionsDir2, "schema.ts");
  let hasSchemaFile = ctx.fs.exists(schemaPath);
  if (!hasSchemaFile) {
    schemaPath = path.join(functionsDir2, "schema.js");
    hasSchemaFile = ctx.fs.exists(schemaPath);
  }
  return hasSchemaFile;
}
async function doDataModelCodegen(ctx, tmpDir, functionsDir2, codegenDir, useTypeScript, opts) {
  const hasSchemaFile = schemaFileExists(ctx, functionsDir2);
  const schemaContent = hasSchemaFile ? useTypeScript ? dynamicDataModelTS() : dynamicDataModelDTS() : useTypeScript ? noSchemaDataModelTS() : noSchemaDataModelDTS();
  const filename = useTypeScript ? "dataModel.ts" : "dataModel.d.ts";
  await writeFormattedFile(
    ctx,
    tmpDir,
    schemaContent,
    "typescript",
    path.join(codegenDir, filename),
    opts
  );
  return [filename];
}
async function writeServerFiles(ctx, tmpDir, codegenDir, useTypeScript, opts) {
  if (!useTypeScript) {
    const serverContent = serverCodegen({ useTypeScript: false });
    await writeFormattedFile(
      ctx,
      tmpDir,
      serverContent.JS,
      "typescript",
      path.join(codegenDir, "server.js"),
      opts
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      serverContent.DTS,
      "typescript",
      path.join(codegenDir, "server.d.ts"),
      opts
    );
    return ["server.js", "server.d.ts"];
  } else {
    const serverContent = serverCodegen({ useTypeScript: true });
    await writeFormattedFile(
      ctx,
      tmpDir,
      serverContent.TS,
      "typescript",
      path.join(codegenDir, "server.ts"),
      opts
    );
    return ["server.ts"];
  }
}
async function writeComponentServerFile(ctx, tmpDir, codegenDir, opts) {
  const serverTSPath = path.join(codegenDir, "server.ts");
  const serverTSContents = componentServerTS(false);
  await writeFormattedFile(
    ctx,
    tmpDir,
    serverTSContents,
    "typescript",
    serverTSPath,
    opts
  );
  return ["server.ts"];
}
async function writeServerFilesForComponent(ctx, isRoot, tmpDir, codegenDir, useTypeScript, opts) {
  if (isRoot) {
    return await writeServerFiles(ctx, tmpDir, codegenDir, useTypeScript, opts);
  } else {
    return await writeComponentServerFile(ctx, tmpDir, codegenDir, opts);
  }
}
async function doInitialComponentServerCodegen(ctx, isRoot, tmpDir, codegenDir, useTypeScript, opts) {
  return await writeServerFilesForComponent(
    ctx,
    isRoot,
    tmpDir,
    codegenDir,
    useTypeScript,
    opts
  );
}
async function doInitialComponentDataModelCodegen(ctx, tmpDir, componentDirectory, codegenDir, useTypeScript, opts) {
  const hasSchemaFile = schemaFileExists(ctx, componentDirectory.path);
  const dataModelContent = hasSchemaFile ? useTypeScript ? dynamicDataModelTS() : dynamicDataModelDTS() : useTypeScript ? noSchemaDataModelTS() : noSchemaDataModelDTS();
  const filename = useTypeScript ? "dataModel.ts" : "dataModel.d.ts";
  const dataModelPath = path.join(codegenDir, filename);
  if (!ctx.fs.exists(dataModelPath)) {
    await writeFormattedFile(
      ctx,
      tmpDir,
      dataModelContent,
      "typescript",
      dataModelPath,
      opts
    );
  }
  return [filename];
}
async function doInitialComponentApiCodegen(ctx, isRoot, tmpDir, codegenDir, useTypeScript, generateCommonJSApi, opts) {
  const writtenFiles = [];
  if (!useTypeScript) {
    const apiJS = componentApiJs();
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiJS,
      "typescript",
      path.join(codegenDir, "api.js"),
      opts
    );
    const apiDTSPath = path.join(codegenDir, "api.d.ts");
    const apiStubDTS = componentApiStubDTS();
    if (!ctx.fs.exists(apiDTSPath)) {
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiStubDTS,
        "typescript",
        apiDTSPath,
        opts
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
        opts
      );
      const cjsStubPath = path.join(codegenDir, "api_cjs.d.cts");
      if (!ctx.fs.exists(cjsStubPath)) {
        await writeFormattedFile(
          ctx,
          tmpDir,
          apiStubDTS,
          "typescript",
          cjsStubPath,
          opts
        );
      }
      writtenFiles.push("api_cjs.cjs", "api_cjs.d.cts");
    }
  } else {
    const apiTSPath = path.join(codegenDir, "api.ts");
    const apiTS = componentApiStubTS();
    if (!ctx.fs.exists(apiTSPath)) {
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiTS,
        "typescript",
        apiTSPath,
        opts
      );
    }
    writtenFiles.push("api.ts");
  }
  return writtenFiles;
}
async function doApiCodegen(ctx, tmpDir, functionsDir2, codegenDir, useTypeScript, generateCommonJSApi, opts) {
  const absModulePaths = await entryPoints(ctx, functionsDir2);
  const modulePaths = absModulePaths.map((p) => path.relative(functionsDir2, p)).sort();
  const writtenFiles = [];
  if (!useTypeScript) {
    const apiContent = apiCodegen(modulePaths, { useTypeScript: false });
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContent.JS,
      "typescript",
      path.join(codegenDir, "api.js"),
      opts
    );
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContent.DTS,
      "typescript",
      path.join(codegenDir, "api.d.ts"),
      opts
    );
    writtenFiles.push("api.js", "api.d.ts");
    if (generateCommonJSApi) {
      const apiCjsContent = apiCjsCodegen(modulePaths);
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiCjsContent.JS,
        "typescript",
        path.join(codegenDir, "api_cjs.cjs"),
        opts
      );
      await writeFormattedFile(
        ctx,
        tmpDir,
        apiCjsContent.DTS,
        "typescript",
        path.join(codegenDir, "api_cjs.d.cts"),
        opts
      );
      writtenFiles.push("api_cjs.cjs", "api_cjs.d.cts");
    }
  } else {
    const apiContent = apiCodegen(modulePaths, { useTypeScript: true });
    await writeFormattedFile(
      ctx,
      tmpDir,
      apiContent.TS,
      "typescript",
      path.join(codegenDir, "api.ts"),
      opts
    );
    writtenFiles.push("api.ts");
  }
  return writtenFiles;
}
async function writeFormattedFile(ctx, tmpDir, contents, filetype, destination, options) {
  const formattedContents = await prettier.format(contents, {
    parser: filetype,
    pluginSearchDirs: false
  });
  if (options?.debug) {
    logOutput(`# ${path.resolve(destination)}`);
    logOutput(formattedContents);
    return;
  }
  try {
    const existing = ctx.fs.readUtf8File(destination);
    if (existing === formattedContents) {
      return;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
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
//# sourceMappingURL=codegen.js.map
