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
var program_exports = {};
__export(program_exports, {
  decorateCommand: () => decorateCommand
});
module.exports = __toCommonJS(program_exports);
var import_utilsBundle = require("playwright-core/lib/utilsBundle");
var mcpServer = __toESM(require("./sdk/server"));
var import_config = require("./browser/config");
var import_watchdog = require("./browser/watchdog");
var import_browserContextFactory = require("./browser/browserContextFactory");
var import_proxyBackend = require("./sdk/proxyBackend");
var import_browserServerBackend = require("./browser/browserServerBackend");
var import_extensionContextFactory = require("./extension/extensionContextFactory");
function decorateCommand(command, version) {
  command.option("--allowed-hosts <hosts...>", "comma-separated list of hosts this server is allowed to serve from. Defaults to the host the server is bound to. Pass '*' to disable the host check.", import_config.commaSeparatedList).option("--allowed-origins <origins>", "semicolon-separated list of origins to allow the browser to request. Default is to allow all.", import_config.semicolonSeparatedList).option("--blocked-origins <origins>", "semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist. If used without the allowlist, requests not matching the blocklist are still allowed.", import_config.semicolonSeparatedList).option("--block-service-workers", "block service workers").option("--browser <browser>", "browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.").option("--caps <caps>", "comma-separated list of additional capabilities to enable, possible values: vision, pdf.", import_config.commaSeparatedList).option("--cdp-endpoint <endpoint>", "CDP endpoint to connect to.").option("--cdp-header <headers...>", "CDP headers to send with the connect request, multiple can be specified.", import_config.headerParser).option("--config <path>", "path to the configuration file.").option("--device <device>", 'device to emulate, for example: "iPhone 15"').option("--executable-path <path>", "path to the browser executable.").option("--extension", 'Connect to a running browser instance (Edge/Chrome only). Requires the "Playwright MCP Bridge" browser extension to be installed.').option("--grant-permissions <permissions...>", 'List of permissions to grant to the browser context, for example "geolocation", "clipboard-read", "clipboard-write".', import_config.commaSeparatedList).option("--headless", "run browser in headless mode, headed by default").option("--host <host>", "host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.").option("--ignore-https-errors", "ignore https errors").option("--init-script <path...>", "path to JavaScript file to add as an initialization script. The script will be evaluated in every page before any of the page's scripts. Can be specified multiple times.").option("--isolated", "keep the browser profile in memory, do not save it to disk.").option("--image-responses <mode>", 'whether to send image responses to the client. Can be "allow" or "omit", Defaults to "allow".').option("--no-sandbox", "disable the sandbox for all process types that are normally sandboxed.").option("--output-dir <path>", "path to the directory for output files.").option("--port <port>", "port to listen on for SSE transport.").option("--proxy-bypass <bypass>", 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"').option("--proxy-server <proxy>", 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"').option("--save-session", "Whether to save the Playwright MCP session into the output directory.").option("--save-trace", "Whether to save the Playwright Trace of the session into the output directory.").option("--save-video <size>", 'Whether to save the video of the session into the output directory. For example "--save-video=800x600"', import_config.resolutionParser.bind(null, "--save-video")).option("--secrets <path>", "path to a file containing secrets in the dotenv format", import_config.dotenvFileLoader).option("--shared-browser-context", "reuse the same browser context between all connected HTTP clients.").option("--storage-state <path>", "path to the storage state file for isolated sessions.").option("--timeout-action <timeout>", "specify action timeout in milliseconds, defaults to 5000ms", import_config.numberParser).option("--timeout-navigation <timeout>", "specify navigation timeout in milliseconds, defaults to 60000ms", import_config.numberParser).option("--user-agent <ua string>", "specify user agent string").option("--user-data-dir <path>", "path to the user data directory. If not specified, a temporary directory will be created.").option("--viewport-size <size>", 'specify browser viewport size in pixels, for example "1280x720"', import_config.resolutionParser.bind(null, "--viewport-size")).addOption(new import_utilsBundle.ProgramOption("--connect-tool", "Allow to switch between different browser connection methods.").hideHelp()).addOption(new import_utilsBundle.ProgramOption("--vision", "Legacy option, use --caps=vision instead").hideHelp()).action(async (options) => {
    (0, import_watchdog.setupExitWatchdog)();
    if (options.vision) {
      console.error("The --vision option is deprecated, use --caps=vision instead");
      options.caps = "vision";
    }
    const config = await (0, import_config.resolveCLIConfig)(options);
    const browserContextFactory = (0, import_browserContextFactory.contextFactory)(config);
    const extensionContextFactory = new import_extensionContextFactory.ExtensionContextFactory(config.browser.launchOptions.channel || "chrome", config.browser.userDataDir, config.browser.launchOptions.executablePath);
    if (options.extension) {
      const serverBackendFactory = {
        name: "Playwright w/ extension",
        nameInConfig: "playwright-extension",
        version,
        create: () => new import_browserServerBackend.BrowserServerBackend(config, extensionContextFactory)
      };
      await mcpServer.start(serverBackendFactory, config.server);
      return;
    }
    if (options.connectTool) {
      const providers = [
        {
          name: "default",
          description: "Starts standalone browser",
          connect: () => mcpServer.wrapInProcess(new import_browserServerBackend.BrowserServerBackend(config, browserContextFactory))
        },
        {
          name: "extension",
          description: "Connect to a browser using the Playwright MCP extension",
          connect: () => mcpServer.wrapInProcess(new import_browserServerBackend.BrowserServerBackend(config, extensionContextFactory))
        }
      ];
      const factory2 = {
        name: "Playwright w/ switch",
        nameInConfig: "playwright-switch",
        version,
        create: () => new import_proxyBackend.ProxyBackend(providers)
      };
      await mcpServer.start(factory2, config.server);
      return;
    }
    const factory = {
      name: "Playwright",
      nameInConfig: "playwright",
      version,
      create: () => new import_browserServerBackend.BrowserServerBackend(config, browserContextFactory)
    };
    await mcpServer.start(factory, config.server);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  decorateCommand
});
