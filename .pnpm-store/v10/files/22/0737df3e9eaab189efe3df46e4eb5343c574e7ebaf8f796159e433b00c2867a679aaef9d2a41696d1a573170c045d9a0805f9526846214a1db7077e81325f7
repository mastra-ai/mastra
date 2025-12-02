"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var command_exports = {};
__export(command_exports, {
  actionDescription: () => actionDescription,
  normalizeDevOptions: () => normalizeDevOptions
});
module.exports = __toCommonJS(command_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_utils = require("./utils/utils.js");
import_extra_typings.Command.prototype.addDeploymentSelectionOptions = function(action) {
  return this.addOption(
    new import_extra_typings.Option("--url <url>").conflicts(["--prod", "--preview-name", "--deployment-name"]).hideHelp()
  ).addOption(new import_extra_typings.Option("--admin-key <adminKey>").hideHelp()).addOption(
    new import_extra_typings.Option(
      "--env-file <envFile>",
      `Path to a custom file of environment variables, for choosing the deployment, e.g. ${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} or ${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME}. Same format as .env.local or .env files, and overrides them.`
    )
  ).addOption(
    new import_extra_typings.Option(
      "--prod",
      action + " this project's production deployment."
    ).conflicts(["--preview-name", "--deployment-name", "--url"])
  ).addOption(
    new import_extra_typings.Option(
      "--preview-name <previewName>",
      action + " the preview deployment with the given name."
    ).conflicts(["--prod", "--deployment-name", "--url"])
  ).addOption(
    new import_extra_typings.Option(
      "--deployment-name <deploymentName>",
      action + " the specified deployment."
    ).conflicts(["--prod", "--preview-name", "--url"])
  );
};
function actionDescription(action) {
  return action;
}
async function normalizeDevOptions(ctx, cmdOptions) {
  if (cmdOptions.runComponent && !cmdOptions.run) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Can't specify `--run-component` option without `--run`"
    });
  }
  if (cmdOptions.debugBundlePath !== void 0 && !cmdOptions.once) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--debug-bundle-path` can only be used with `--once`."
    });
  }
  if (cmdOptions.debugNodeApis && !cmdOptions.once) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`--debug-node-apis` can only be used with `--once`."
    });
  }
  return {
    verbose: !!cmdOptions.verbose,
    typecheck: cmdOptions.typecheck,
    typecheckComponents: !!cmdOptions.typecheckComponents,
    codegen: cmdOptions.codegen === "enable",
    once: !!cmdOptions.once,
    untilSuccess: cmdOptions.untilSuccess,
    run: cmdOptions.run !== void 0 ? {
      kind: "function",
      name: cmdOptions.run,
      component: cmdOptions.runComponent
    } : cmdOptions.runSh !== void 0 ? {
      kind: "shell",
      command: cmdOptions.runSh
    } : void 0,
    tailLogs: typeof cmdOptions.tailLogs === "string" ? cmdOptions.tailLogs : "pause-on-deploy",
    traceEvents: cmdOptions.traceEvents,
    debugBundlePath: cmdOptions.debugBundlePath,
    debugNodeApis: !!cmdOptions.debugNodeApis,
    liveComponentSources: !!cmdOptions.liveComponentSources
  };
}
import_extra_typings.Command.prototype.addDeployOptions = function() {
  return this.option("-v, --verbose", "Show full listing of changes").option(
    "--dry-run",
    "Print out the generated configuration without deploying to your Convex deployment"
  ).option("-y, --yes", "Skip confirmation prompt when running locally").addOption(
    new import_extra_typings.Option(
      "--typecheck <mode>",
      `Whether to check TypeScript files with \`tsc --noEmit\` before deploying.`
    ).choices(["enable", "try", "disable"]).default("try")
  ).option(
    "--typecheck-components",
    "Check TypeScript files within component implementations with `tsc --noEmit`.",
    false
  ).addOption(
    new import_extra_typings.Option(
      "--codegen <mode>",
      "Whether to regenerate code in `convex/_generated/` before pushing."
    ).choices(["enable", "disable"]).default("enable")
  ).addOption(
    new import_extra_typings.Option(
      "--cmd <command>",
      "Command to run as part of deploying your app (e.g. `vite build`). This command can depend on the environment variables specified in `--cmd-url-env-var-name` being set."
    )
  ).addOption(
    new import_extra_typings.Option(
      "--cmd-url-env-var-name <name>",
      "Environment variable name to set Convex deployment URL (e.g. `VITE_CONVEX_URL`) when using `--cmd`"
    )
  ).addOption(new import_extra_typings.Option("--debug-bundle-path <path>").hideHelp()).addOption(new import_extra_typings.Option("--debug").hideHelp()).addOption(new import_extra_typings.Option("--write-push-request <writePushRequest>").hideHelp()).addOption(new import_extra_typings.Option("--live-component-sources").hideHelp());
};
import_extra_typings.Command.prototype.addSelfHostOptions = function() {
  return this.option(
    "--admin-key <adminKey>",
    `An admin key for the deployment. Can alternatively be set as \`${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME}\` environment variable.`
  ).option(
    "--url <url>",
    `The url of the deployment. Can alternatively be set as \`${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME}\` environment variable.`
  ).option(
    "--env <env>",
    `Path to a custom file of environment variables, containing \`${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME}\` and \`${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME}\`.`
  );
};
import_extra_typings.Command.prototype.addRunOptions = function() {
  return this.argument(
    "functionName",
    "identifier of the function to run, like `listMessages` or `dir/file:myFunction`"
  ).argument(
    "[args]",
    "JSON-formatted arguments object to pass to the function."
  ).option(
    "-w, --watch",
    "Watch a query, printing its result if the underlying data changes. Given function must be a query."
  ).option("--push", "Push code to deployment before running the function.").addOption(
    new import_extra_typings.Option(
      "--identity <identity>",
      `JSON-formatted UserIdentity object, e.g. '{ name: "John", address: "0x123" }'`
    )
  ).addOption(new import_extra_typings.Option("--no-push").hideHelp()).addOption(
    new import_extra_typings.Option(
      "--typecheck <mode>",
      `Whether to check TypeScript files with \`tsc --noEmit\`.`
    ).choices(["enable", "try", "disable"]).default("try")
  ).option(
    "--typecheck-components",
    "Check TypeScript files within component implementations with `tsc --noEmit`.",
    false
  ).addOption(
    new import_extra_typings.Option(
      "--codegen <mode>",
      "Regenerate code in `convex/_generated/`"
    ).choices(["enable", "disable"]).default("enable")
  ).addOption(
    new import_extra_typings.Option(
      "--component <path>",
      "Path to the component in the component tree defined in convex.config.ts."
    )
  ).addOption(new import_extra_typings.Option("--live-component-sources").hideHelp());
};
import_extra_typings.Command.prototype.addImportOptions = function() {
  return this.argument("<path>", "Path to the input file").addOption(
    new import_extra_typings.Option(
      "--table <table>",
      "Destination table name. Required if format is csv, jsonLines, or jsonArray. Not supported if format is zip."
    )
  ).addOption(
    new import_extra_typings.Option(
      "--replace",
      "Replace all existing data in any of the imported tables"
    ).conflicts("--append").conflicts("--replace-all")
  ).addOption(
    new import_extra_typings.Option("--append", "Append imported data to any existing tables").conflicts("--replace-all").conflicts("--replace")
  ).addOption(
    new import_extra_typings.Option(
      "--replace-all",
      "Replace all existing data in the deployment with the imported tables,\n  deleting tables that don't appear in the import file or the schema,\n  and clearing tables that appear in the schema but not in the import file"
    ).conflicts("--append").conflicts("--replace")
  ).option(
    "-y, --yes",
    "Skip confirmation prompt when import leads to deleting existing documents"
  ).addOption(
    new import_extra_typings.Option(
      "--format <format>",
      "Input file format. This flag is only required if the filename is missing an extension.\n- CSV files must have a header, and each row's entries are interpreted either as a (floating point) number or a string.\n- JSON files must be an array of JSON objects.\n- JSONLines files must have a JSON object per line.\n- ZIP files must have one directory per table, containing <table>/documents.jsonl. Snapshot exports from the Convex dashboard have this format."
    ).choices(["csv", "jsonLines", "jsonArray", "zip"])
  ).addOption(
    new import_extra_typings.Option(
      "--component <path>",
      "Path to the component in the component tree defined in convex.config.ts."
    )
  );
};
import_extra_typings.Command.prototype.addExportOptions = function() {
  return this.requiredOption(
    "--path <zipFilePath>",
    "Exports data into a ZIP file at this path, which may be a directory or unoccupied .zip path"
  ).addOption(
    new import_extra_typings.Option(
      "--include-file-storage",
      "Includes stored files (https://dashboard.convex.dev/deployment/files) in a _storage folder within the ZIP file"
    )
  );
};
import_extra_typings.Command.prototype.addDataOptions = function() {
  return this.addOption(
    new import_extra_typings.Option(
      "--limit <n>",
      "List only the `n` the most recently created documents."
    ).default(100).argParser(import_utils.parsePositiveInteger)
  ).addOption(
    new import_extra_typings.Option(
      "--order <choice>",
      "Order the documents by their `_creationTime`."
    ).choices(["asc", "desc"]).default("desc")
  ).addOption(
    new import_extra_typings.Option(
      "--component <path>",
      "Path to the component in the component tree defined in convex.config.ts."
    )
  ).addOption(
    new import_extra_typings.Option(
      "--format <format>",
      "Format to print the data in. This flag is only required if the filename is missing an extension.\n- jsonArray (aka json): print the data as a JSON array of objects.\n- jsonLines (aka jsonl): print the data as a JSON object per line.\n- pretty: print the data in a human-readable format."
    ).choices(["jsonArray", "json", "jsonLines", "jsonl", "pretty"])
  ).argument("[table]", "If specified, list documents in this table.");
};
import_extra_typings.Command.prototype.addLogsOptions = function() {
  return this.option(
    "--history [n]",
    "Show `n` most recent logs. Defaults to showing all available logs.",
    import_utils.parseInteger
  ).option(
    "--success",
    "Print a log line for every successful function execution",
    false
  ).option("--jsonl", "Output raw log events as JSONL", false);
};
import_extra_typings.Command.prototype.addNetworkTestOptions = function() {
  return this.addOption(
    new import_extra_typings.Option(
      "--timeout <timeout>",
      "Timeout in seconds for the network test (default: 30)."
    )
  ).addOption(
    new import_extra_typings.Option(
      "--ip-family <ipFamily>",
      "IP family to use (ipv4, ipv6, or auto)"
    )
  ).addOption(
    new import_extra_typings.Option(
      "--speed-test",
      "Perform a large echo test to measure network speed."
    )
  );
};
//# sourceMappingURL=command.js.map
