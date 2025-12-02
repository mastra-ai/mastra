"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var import_extra_typings = require("@commander-js/extra-typings");
var import_init = require("./init.js");
var import_dashboard = require("./dashboard.js");
var import_deployments = require("./deployments.js");
var import_docs = require("./docs.js");
var import_run = require("./run.js");
var import_version = require("./version.js");
var import_auth = require("./auth.js");
var import_codegen = require("./codegen.js");
var import_reinit = require("./reinit.js");
var import_update = require("./update.js");
var import_typecheck = require("./typecheck.js");
var import_login = require("./login.js");
var import_logout = require("./logout.js");
var import_chalk = __toESM(require("chalk"), 1);
var Sentry = __toESM(require("@sentry/node"), 1);
var import_sentry = require("./lib/utils/sentry.js");
var import_dev = require("./dev.js");
var import_deploy = require("./deploy.js");
var import_logs = require("./logs.js");
var import_network_test = require("./network_test.js");
var import_convexExport = require("./convexExport.js");
var import_convexImport = require("./convexImport.js");
var import_env = require("./env.js");
var import_data = require("./data.js");
var import_inquirer = __toESM(require("inquirer"), 1);
var import_inquirer_search_list = __toESM(require("inquirer-search-list"), 1);
var import_util = require("util");
var import_functionSpec = require("./functionSpec.js");
var import_disableLocalDev = require("./disableLocalDev.js");
var import_mcp = require("./mcp.js");
var import_node_dns = __toESM(require("node:dns"), 1);
var import_node_net = __toESM(require("node:net"), 1);
var import_integration = require("./integration.js");
var import_undici = require("undici");
var import_log = require("../bundler/log.js");
const MINIMUM_MAJOR_VERSION = 16;
const MINIMUM_MINOR_VERSION = 15;
function logToStderr(...args) {
  process.stderr.write(`${(0, import_util.format)(...args)}
`);
}
async function main() {
  const nodeVersion = process.versions.node;
  const majorVersion = parseInt(nodeVersion.split(".")[0], 10);
  const minorVersion = parseInt(nodeVersion.split(".")[1], 10);
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) {
    (0, import_undici.setGlobalDispatcher)(new import_undici.EnvHttpProxyAgent());
    (0, import_log.logVerbose)(`[proxy-bootstrap] Using proxy: ${proxy}`);
  }
  import_node_dns.default.setDefaultResultOrder("ipv4first");
  if (majorVersion >= 20) {
    import_node_net.default.setDefaultAutoSelectFamilyAttemptTimeout?.(1e3);
  }
  (0, import_sentry.initSentry)();
  import_inquirer.default.registerPrompt("search-list", import_inquirer_search_list.default);
  if (majorVersion < MINIMUM_MAJOR_VERSION || majorVersion === MINIMUM_MAJOR_VERSION && minorVersion < MINIMUM_MINOR_VERSION) {
    logToStderr(
      import_chalk.default.red(
        `Your Node version ${nodeVersion} is too old. Convex requires at least Node v${MINIMUM_MAJOR_VERSION}.${MINIMUM_MINOR_VERSION}`
      )
    );
    logToStderr(
      import_chalk.default.gray(
        `You can use ${import_chalk.default.bold(
          "nvm"
        )} (https://github.com/nvm-sh/nvm#installing-and-updating) to manage different versions of Node.`
      )
    );
    logToStderr(
      import_chalk.default.gray(
        "After installing `nvm`, install the latest version of Node with " + import_chalk.default.bold("`nvm install node`.")
      )
    );
    logToStderr(
      import_chalk.default.gray(
        "Then, activate the installed version in your terminal with " + import_chalk.default.bold("`nvm use`.")
      )
    );
    process.exit(1);
  }
  const program = new import_extra_typings.Command();
  program.name("convex").usage("<command> [options]").description("Start developing with Convex by running `npx convex dev`.").addCommand(import_login.login, { hidden: true }).addCommand(import_init.init, { hidden: true }).addCommand(import_reinit.reinit, { hidden: true }).addCommand(import_dev.dev).addCommand(import_deploy.deploy).addCommand(import_deployments.deployments, { hidden: true }).addCommand(import_run.run).addCommand(import_convexImport.convexImport).addCommand(import_dashboard.dashboard).addCommand(import_docs.docs).addCommand(import_logs.logs).addCommand(import_typecheck.typecheck, { hidden: true }).addCommand(import_auth.auth, { hidden: true }).addCommand(import_convexExport.convexExport).addCommand(import_env.env).addCommand(import_data.data).addCommand(import_codegen.codegen).addCommand(import_update.update).addCommand(import_logout.logout).addCommand(import_network_test.networkTest, { hidden: true }).addCommand(import_integration.integration, { hidden: true }).addCommand(import_functionSpec.functionSpec).addCommand(import_disableLocalDev.disableLocalDeployments).addCommand(import_mcp.mcp).addHelpCommand("help <command>", "Show help for given <command>").version(import_version.version).configureHelp({ visibleOptions: () => [] }).showHelpAfterError();
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    Sentry.captureException(e);
    process.exitCode = 1;
    console.error(import_chalk.default.red("Unexpected Error: " + e));
  } finally {
    await Sentry.close();
  }
  process.exit();
}
void main();
//# sourceMappingURL=index.js.map
