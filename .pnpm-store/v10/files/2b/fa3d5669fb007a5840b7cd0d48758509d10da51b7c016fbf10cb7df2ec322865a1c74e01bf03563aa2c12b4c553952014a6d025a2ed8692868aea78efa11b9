"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var components_exports = {};
__export(components_exports, {
  runCodegen: () => runCodegen,
  runComponentsPush: () => runComponentsPush,
  runPush: () => runPush
});
module.exports = __toCommonJS(components_exports);
var import_path = __toESM(require("path"), 1);
var import_log = require("../../bundler/log.js");
var import_config = require("./config.js");
var import_deploy2 = require("./deploy2.js");
var import_version = require("../version.js");
var import_utils = require("./utils/utils.js");
var import_bundle = require("./components/definition/bundle.js");
var import_directoryStructure = require("./components/definition/directoryStructure.js");
var import_codegen = require("./codegen.js");
var import_typecheck = require("./typecheck.js");
var import_fs = require("../../bundler/fs.js");
var import_debugBundlePath = require("./debugBundlePath.js");
var import_chalk = __toESM(require("chalk"), 1);
var import_api = require("./api.js");
var import_tracing = require("./tracing.js");
var import_constants = require("./components/constants.js");
var import_dashboard = require("./dashboard.js");
var import_indexes = require("./indexes.js");
var import_checkForLargeIndexDeletion = require("./checkForLargeIndexDeletion.js");
async function runCodegen(ctx, deploymentSelection, options) {
  await (0, import_utils.ensureHasConvexDependency)(ctx, "codegen");
  const { configPath, projectConfig } = await (0, import_config.readProjectConfig)(ctx);
  const functionsDirectoryPath = (0, import_utils.functionsDir)(configPath, projectConfig);
  if (options.init) {
    await (0, import_codegen.doInitCodegen)(ctx, functionsDirectoryPath, false, {
      dryRun: options.dryRun,
      debug: options.debug
    });
  }
  if (!options.systemUdfs) {
    if (deploymentSelection.kind === "preview") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `Codegen requires an existing deployment so doesn't support CONVEX_DEPLOY_KEY.
Generate code in dev and commit it to the repo instead.
https://docs.convex.dev/understanding/best-practices/other-recommendations#check-generated-code-into-version-control`
      });
    }
    const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(options);
    const credentials = await (0, import_api.loadSelectedDeploymentCredentials)(
      ctx,
      deploymentSelection,
      selectionWithinProject
    );
    await startComponentsPushAndCodegen(
      ctx,
      import_tracing.Span.noop(),
      projectConfig,
      configPath,
      {
        ...options,
        deploymentName: credentials.deploymentFields?.deploymentName ?? null,
        url: credentials.url,
        adminKey: credentials.adminKey,
        generateCommonJSApi: options.commonjs,
        verbose: !!process.env.CONVEX_VERBOSE,
        codegen: true,
        liveComponentSources: options.liveComponentSources,
        typecheckComponents: false,
        debugNodeApis: options.debugNodeApis
      }
    );
  } else {
    if (options.typecheck !== "disable") {
      (0, import_log.logMessage)(import_chalk.default.gray("Running TypeScript typecheck\u2026"));
    }
    await (0, import_codegen.doCodegen)(ctx, functionsDirectoryPath, options.typecheck, {
      dryRun: options.dryRun,
      debug: options.debug,
      generateCommonJSApi: options.commonjs
    });
  }
}
async function runPush(ctx, options) {
  const { configPath, projectConfig } = await (0, import_config.readProjectConfig)(ctx);
  await runComponentsPush(ctx, options, configPath, projectConfig);
}
async function startComponentsPushAndCodegen(ctx, parentSpan, projectConfig, configPath, options) {
  const convexDir = await (0, import_config.getFunctionsDirectoryPath)(ctx);
  const absWorkingDir = import_path.default.resolve(".");
  const isComponent = (0, import_directoryStructure.isComponentDirectory)(ctx, convexDir, true);
  if (isComponent.kind === "err") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Invalid component root directory (${isComponent.why}): ${convexDir}`
    });
  }
  let rootComponent = isComponent.component;
  if (options.codegenOnlyThisComponent) {
    const absolutePath = import_path.default.resolve(options.codegenOnlyThisComponent);
    let componentConfigPath;
    componentConfigPath = import_path.default.join(absolutePath, import_constants.DEFINITION_FILENAME_TS);
    if (!ctx.fs.exists(componentConfigPath)) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `Only directories with convex.config.ts files are supported, this directory does not: ${absolutePath}`
      });
    }
    const syntheticConfigPath = import_path.default.join(
      rootComponent.path,
      import_constants.DEFINITION_FILENAME_TS
    );
    rootComponent = {
      isRoot: true,
      path: rootComponent.path,
      definitionPath: syntheticConfigPath,
      isRootWithoutConfig: false,
      syntheticComponentImport: componentConfigPath
    };
  }
  (0, import_log.changeSpinner)("Finding component definitions...");
  const { components, dependencyGraph } = await parentSpan.enterAsync(
    "componentGraph",
    () => (0, import_bundle.componentGraph)(
      ctx,
      absWorkingDir,
      rootComponent,
      !!options.liveComponentSources,
      options.verbose
    )
  );
  if (options.codegen) {
    (0, import_log.changeSpinner)("Generating server code...");
    await parentSpan.enterAsync(
      "doInitialComponentCodegen",
      () => (0, import_fs.withTmpDir)(async (tmpDir) => {
        if (!rootComponent.syntheticComponentImport) {
          await (0, import_codegen.doInitialComponentCodegen)(ctx, tmpDir, rootComponent, options);
        }
        for (const directory of components.values()) {
          if (directory.isRoot) {
            continue;
          }
          if (rootComponent.syntheticComponentImport && directory.definitionPath !== rootComponent.syntheticComponentImport) {
            continue;
          }
          await (0, import_codegen.doInitialComponentCodegen)(ctx, tmpDir, directory, options);
        }
      })
    );
  }
  (0, import_log.changeSpinner)("Bundling component definitions...");
  const {
    appDefinitionSpecWithoutImpls,
    componentDefinitionSpecsWithoutImpls
  } = await parentSpan.enterAsync(
    "bundleDefinitions",
    () => (0, import_bundle.bundleDefinitions)(
      ctx,
      absWorkingDir,
      dependencyGraph,
      rootComponent,
      // Note that this *includes* the root component.
      [...components.values()],
      !!options.liveComponentSources,
      options.verbose
    )
  );
  if (options.debugNodeApis) {
    await (0, import_config.debugIsolateEndpointBundles)(ctx, projectConfig, configPath);
    (0, import_log.logFinishedStep)(
      "All non-'use node' entry points successfully bundled. Skipping rest of push."
    );
    return null;
  }
  (0, import_log.changeSpinner)("Bundling component schemas and implementations...");
  const { appImplementation, componentImplementations } = await parentSpan.enterAsync(
    "bundleImplementations",
    () => (0, import_bundle.bundleImplementations)(
      ctx,
      rootComponent,
      // When running codegen for a specific component, don't bundle the root.
      [...components.values()].filter((dir) => !dir.syntheticComponentImport),
      projectConfig.node.externalPackages,
      options.liveComponentSources ? ["@convex-dev/component-source"] : [],
      options.verbose
    )
  );
  if (options.debugBundlePath) {
    const { config: localConfig } = await (0, import_config.configFromProjectConfig)(
      ctx,
      projectConfig,
      configPath,
      options.verbose
    );
    await (0, import_debugBundlePath.handleDebugBundlePath)(ctx, options.debugBundlePath, localConfig);
    (0, import_log.logMessage)(
      `Wrote bundle and metadata for modules in the root to ${options.debugBundlePath}. Skipping rest of push.`
    );
    return null;
  }
  const udfServerVersion = import_version.version;
  const appDefinition = {
    ...appDefinitionSpecWithoutImpls,
    ...appImplementation,
    udfServerVersion
  };
  const componentDefinitions = [];
  for (const componentDefinition of componentDefinitionSpecsWithoutImpls) {
    const impl = componentImplementations.filter(
      (impl2) => impl2.definitionPath === componentDefinition.definitionPath
    )[0];
    if (!impl) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `missing! couldn't find ${componentDefinition.definitionPath} in ${componentImplementations.map((impl2) => impl2.definitionPath).toString()}`
      });
    }
    componentDefinitions.push({
      ...componentDefinition,
      ...impl,
      udfServerVersion
    });
  }
  const startPushRequest = {
    adminKey: options.adminKey,
    dryRun: options.dryRun,
    functions: projectConfig.functions,
    appDefinition,
    componentDefinitions,
    nodeDependencies: appImplementation.externalNodeDependencies,
    nodeVersion: projectConfig.node.nodeVersion
  };
  if (options.writePushRequest) {
    const pushRequestPath = import_path.default.resolve(options.writePushRequest);
    ctx.fs.writeUtf8File(
      `${pushRequestPath}.json`,
      JSON.stringify(startPushRequest)
    );
    return null;
  }
  logStartPushSizes(parentSpan, startPushRequest);
  if (options.largeIndexDeletionCheck !== "no verification") {
    await parentSpan.enterAsync(
      "checkForLargeIndexDeletion",
      (span) => (0, import_checkForLargeIndexDeletion.checkForLargeIndexDeletion)({
        ctx,
        span,
        request: startPushRequest,
        options,
        askForConfirmation: options.largeIndexDeletionCheck === "ask for confirmation"
      })
    );
  }
  (0, import_log.changeSpinner)("Uploading functions to Convex...");
  const startPushResponse = await parentSpan.enterAsync(
    "startPush",
    (span) => (0, import_deploy2.startPush)(ctx, span, startPushRequest, options)
  );
  if (options.verbose) {
    (0, import_log.logMessage)("startPush: " + JSON.stringify(startPushResponse, null, 2));
  }
  if (options.codegen) {
    (0, import_log.changeSpinner)("Generating TypeScript bindings...");
    await parentSpan.enterAsync(
      "doFinalComponentCodegen",
      () => (0, import_fs.withTmpDir)(async (tmpDir) => {
        if (!rootComponent.syntheticComponentImport) {
          await (0, import_codegen.doFinalComponentCodegen)(
            ctx,
            tmpDir,
            rootComponent,
            rootComponent,
            startPushResponse,
            components,
            options
          );
        }
        for (const directory of components.values()) {
          if (directory.isRoot) {
            continue;
          }
          if (rootComponent.syntheticComponentImport && directory.definitionPath !== rootComponent.syntheticComponentImport) {
            continue;
          }
          await (0, import_codegen.doFinalComponentCodegen)(
            ctx,
            tmpDir,
            rootComponent,
            directory,
            startPushResponse,
            components,
            options
          );
        }
      })
    );
  }
  (0, import_log.changeSpinner)("Running TypeScript...");
  await parentSpan.enterAsync("typeCheckFunctionsInMode", async () => {
    if (!rootComponent.syntheticComponentImport) {
      await (0, import_typecheck.typeCheckFunctionsInMode)(
        ctx,
        options.typecheck,
        rootComponent.path
      );
    }
    if (options.typecheckComponents) {
      for (const directory of components.values()) {
        if (!directory.isRoot) {
          await (0, import_typecheck.typeCheckFunctionsInMode)(
            ctx,
            options.typecheck,
            directory.path
          );
        }
      }
    } else if (rootComponent.syntheticComponentImport) {
      for (const directory of components.values()) {
        if (directory.isRoot || directory.definitionPath !== rootComponent.syntheticComponentImport) {
          continue;
        }
        await (0, import_typecheck.typeCheckFunctionsInMode)(ctx, options.typecheck, directory.path);
      }
    }
  });
  return startPushResponse;
}
function logStartPushSizes(span, startPushRequest) {
  let v8Size = 0;
  let v8Count = 0;
  let nodeSize = 0;
  let nodeCount = 0;
  for (const componentDefinition of startPushRequest.componentDefinitions) {
    for (const module2 of componentDefinition.functions) {
      if (module2.environment === "isolate") {
        v8Size += module2.source.length + (module2.sourceMap ?? "").length;
        v8Count += 1;
      } else if (module2.environment === "node") {
        nodeSize += module2.source.length + (module2.sourceMap ?? "").length;
        nodeCount += 1;
      }
    }
  }
  span.setProperty("v8_size", v8Size.toString());
  span.setProperty("v8_count", v8Count.toString());
  span.setProperty("node_size", nodeSize.toString());
  span.setProperty("node_count", nodeCount.toString());
}
async function runComponentsPush(ctx, options, configPath, projectConfig) {
  const reporter = new import_tracing.Reporter();
  const pushSpan = import_tracing.Span.root(reporter, "runComponentsPush");
  pushSpan.setProperty("cli_version", import_version.version);
  const verbose = options.verbose || options.dryRun;
  await (0, import_utils.ensureHasConvexDependency)(ctx, "push");
  const startPushResponse = await pushSpan.enterAsync(
    "startComponentsPushAndCodegen",
    (span) => startComponentsPushAndCodegen(
      ctx,
      span,
      projectConfig,
      configPath,
      options
    )
  );
  if (!startPushResponse) {
    return;
  }
  await pushSpan.enterAsync(
    "waitForSchema",
    (span) => (0, import_deploy2.waitForSchema)(ctx, span, startPushResponse, options)
  );
  const remoteConfigWithModuleHashes = await (0, import_config.pullConfig)(
    ctx,
    void 0,
    void 0,
    options.url,
    options.adminKey
  );
  const { config: localConfig } = await (0, import_config.configFromProjectConfig)(
    ctx,
    projectConfig,
    configPath,
    options.verbose
  );
  (0, import_log.changeSpinner)("Diffing local code and deployment state...");
  const { diffString } = (0, import_config.diffConfig)(
    remoteConfigWithModuleHashes,
    localConfig,
    false
  );
  if (verbose) {
    (0, import_log.logFinishedStep)(
      `Remote config ${options.dryRun ? "would" : "will"} be overwritten with the following changes:
  ` + diffString.replace(/\n/g, "\n  ")
    );
  }
  const finishPushResponse = await pushSpan.enterAsync(
    "finishPush",
    (span) => (0, import_deploy2.finishPush)(ctx, span, startPushResponse, options)
  );
  printDiff(startPushResponse, finishPushResponse, options);
  pushSpan.end();
  if (!options.dryRun) {
    void (0, import_deploy2.reportPushCompleted)(ctx, options.adminKey, options.url, reporter);
  }
}
function printDiff(startPushResponse, finishPushResponse, opts) {
  if (opts.verbose) {
    const diffString = JSON.stringify(finishPushResponse, null, 2);
    (0, import_log.logMessage)(diffString);
    return;
  }
  const indexDiffs = startPushResponse.schemaChange.indexDiffs;
  const { componentDiffs } = finishPushResponse;
  let rootDiff = indexDiffs?.[""] || componentDiffs[""]?.indexDiff;
  if (rootDiff) {
    if (rootDiff.removed_indexes.length > 0) {
      let msg = `${opts.dryRun ? "Would delete" : "Deleted"} table indexes:
`;
      for (const index of rootDiff.removed_indexes) {
        msg += `  [-] ${(0, import_indexes.formatIndex)(index)}
`;
      }
      msg = msg.slice(0, -1);
      (0, import_log.logFinishedStep)(msg);
    }
    const addedEnabled = rootDiff.added_indexes.filter((i) => !i.staged);
    if (addedEnabled.length > 0) {
      let msg = `${opts.dryRun ? "Would add" : "Added"} table indexes:
`;
      for (const index of addedEnabled) {
        msg += `  [+] ${(0, import_indexes.formatIndex)(index)}
`;
      }
      msg = msg.slice(0, -1);
      (0, import_log.logFinishedStep)(msg);
    }
    const addedStaged = rootDiff.added_indexes.filter((i) => i.staged);
    if (addedStaged.length > 0) {
      let msg = `${opts.dryRun ? "Would add" : "Added"} staged table indexes:
`;
      for (const index of addedStaged) {
        const table = index.name.split(".")[0];
        const progressLink = (0, import_dashboard.deploymentDashboardUrlPage)(
          opts.deploymentName,
          `/data?table=${table}&showIndexes=true`
        );
        msg += `  [+] ${(0, import_indexes.formatIndex)(index)}
`;
        msg += `      See progress: ${progressLink}
`;
      }
      msg = msg.slice(0, -1);
      (0, import_log.logFinishedStep)(msg);
    }
    if (rootDiff.enabled_indexes && rootDiff.enabled_indexes.length > 0) {
      let msg = opts.dryRun ? `These indexes would be enabled:
` : `These indexes are now enabled:
`;
      for (const index of rootDiff.enabled_indexes) {
        msg += `  [*] ${(0, import_indexes.formatIndex)(index)}
`;
      }
      msg = msg.slice(0, -1);
      (0, import_log.logFinishedStep)(msg);
    }
    if (rootDiff.disabled_indexes && rootDiff.disabled_indexes.length > 0) {
      let msg = opts.dryRun ? `These indexes would be staged:
` : `These indexes are now staged:
`;
      for (const index of rootDiff.disabled_indexes) {
        msg += `  [*] ${(0, import_indexes.formatIndex)(index)}
`;
      }
      msg = msg.slice(0, -1);
      (0, import_log.logFinishedStep)(msg);
    }
  }
  for (const [componentPath, componentDiff] of Object.entries(componentDiffs)) {
    if (componentPath === "") {
      continue;
    }
    if (componentDiff.diffType.type === "create") {
      (0, import_log.logFinishedStep)(`Installed component ${componentPath}.`);
    }
    if (componentDiff.diffType.type === "unmount") {
      (0, import_log.logFinishedStep)(`Unmounted component ${componentPath}.`);
    }
    if (componentDiff.diffType.type === "remount") {
      (0, import_log.logFinishedStep)(`Remounted component ${componentPath}.`);
    }
  }
}
//# sourceMappingURL=components.js.map
