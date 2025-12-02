"use strict";
import { Command } from "@commander-js/extra-typings";
import { init } from "./init.js";
import { dashboard } from "./dashboard.js";
import { deployments } from "./deployments.js";
import { docs } from "./docs.js";
import { run } from "./run.js";
import { version } from "./version.js";
import { auth } from "./auth.js";
import { codegen } from "./codegen.js";
import { reinit } from "./reinit.js";
import { update } from "./update.js";
import { typecheck } from "./typecheck.js";
import { login } from "./login.js";
import { logout } from "./logout.js";
import chalk from "chalk";
import * as Sentry from "@sentry/node";
import { initSentry } from "./lib/utils/sentry.js";
import { dev } from "./dev.js";
import { deploy } from "./deploy.js";
import { logs } from "./logs.js";
import { networkTest } from "./network_test.js";
import { convexExport } from "./convexExport.js";
import { convexImport } from "./convexImport.js";
import { env } from "./env.js";
import { data } from "./data.js";
import inquirer from "inquirer";
import inquirerSearchList from "inquirer-search-list";
import { format } from "util";
import { functionSpec } from "./functionSpec.js";
import { disableLocalDeployments } from "./disableLocalDev.js";
import { mcp } from "./mcp.js";
import dns from "node:dns";
import net from "node:net";
import { integration } from "./integration.js";
import { setGlobalDispatcher, EnvHttpProxyAgent } from "undici";
import { logVerbose } from "../bundler/log.js";
const MINIMUM_MAJOR_VERSION = 16;
const MINIMUM_MINOR_VERSION = 15;
function logToStderr(...args) {
  process.stderr.write(`${format(...args)}
`);
}
async function main() {
  const nodeVersion = process.versions.node;
  const majorVersion = parseInt(nodeVersion.split(".")[0], 10);
  const minorVersion = parseInt(nodeVersion.split(".")[1], 10);
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) {
    setGlobalDispatcher(new EnvHttpProxyAgent());
    logVerbose(`[proxy-bootstrap] Using proxy: ${proxy}`);
  }
  dns.setDefaultResultOrder("ipv4first");
  if (majorVersion >= 20) {
    net.setDefaultAutoSelectFamilyAttemptTimeout?.(1e3);
  }
  initSentry();
  inquirer.registerPrompt("search-list", inquirerSearchList);
  if (majorVersion < MINIMUM_MAJOR_VERSION || majorVersion === MINIMUM_MAJOR_VERSION && minorVersion < MINIMUM_MINOR_VERSION) {
    logToStderr(
      chalk.red(
        `Your Node version ${nodeVersion} is too old. Convex requires at least Node v${MINIMUM_MAJOR_VERSION}.${MINIMUM_MINOR_VERSION}`
      )
    );
    logToStderr(
      chalk.gray(
        `You can use ${chalk.bold(
          "nvm"
        )} (https://github.com/nvm-sh/nvm#installing-and-updating) to manage different versions of Node.`
      )
    );
    logToStderr(
      chalk.gray(
        "After installing `nvm`, install the latest version of Node with " + chalk.bold("`nvm install node`.")
      )
    );
    logToStderr(
      chalk.gray(
        "Then, activate the installed version in your terminal with " + chalk.bold("`nvm use`.")
      )
    );
    process.exit(1);
  }
  const program = new Command();
  program.name("convex").usage("<command> [options]").description("Start developing with Convex by running `npx convex dev`.").addCommand(login, { hidden: true }).addCommand(init, { hidden: true }).addCommand(reinit, { hidden: true }).addCommand(dev).addCommand(deploy).addCommand(deployments, { hidden: true }).addCommand(run).addCommand(convexImport).addCommand(dashboard).addCommand(docs).addCommand(logs).addCommand(typecheck, { hidden: true }).addCommand(auth, { hidden: true }).addCommand(convexExport).addCommand(env).addCommand(data).addCommand(codegen).addCommand(update).addCommand(logout).addCommand(networkTest, { hidden: true }).addCommand(integration, { hidden: true }).addCommand(functionSpec).addCommand(disableLocalDeployments).addCommand(mcp).addHelpCommand("help <command>", "Show help for given <command>").version(version).configureHelp({ visibleOptions: () => [] }).showHelpAfterError();
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    Sentry.captureException(e);
    process.exitCode = 1;
    console.error(chalk.red("Unexpected Error: " + e));
  } finally {
    await Sentry.close();
  }
  process.exit();
}
void main();
//# sourceMappingURL=index.js.map
