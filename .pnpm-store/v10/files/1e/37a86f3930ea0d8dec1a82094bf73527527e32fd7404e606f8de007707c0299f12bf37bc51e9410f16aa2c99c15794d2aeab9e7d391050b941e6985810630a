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
var context_exports = {};
__export(context_exports, {
  Context: () => Context,
  InputRecorder: () => InputRecorder
});
module.exports = __toCommonJS(context_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_utilsBundle = require("playwright-core/lib/utilsBundle");
var import_log = require("../log");
var import_tab = require("./tab");
var import_config = require("./config");
var codegen = __toESM(require("./codegen"));
var import_utils = require("./tools/utils");
const testDebug = (0, import_utilsBundle.debug)("pw:mcp:test");
class Context {
  constructor(options) {
    this._tabs = [];
    this._abortController = new AbortController();
    this.config = options.config;
    this.sessionLog = options.sessionLog;
    this.options = options;
    this._browserContextFactory = options.browserContextFactory;
    this._clientInfo = options.clientInfo;
    testDebug("create context");
    Context._allContexts.add(this);
  }
  static {
    this._allContexts = /* @__PURE__ */ new Set();
  }
  static async disposeAll() {
    await Promise.all([...Context._allContexts].map((context) => context.dispose()));
  }
  tabs() {
    return this._tabs;
  }
  currentTab() {
    return this._currentTab;
  }
  currentTabOrDie() {
    if (!this._currentTab)
      throw new Error('No open pages available. Use the "browser_navigate" tool to navigate to a page first.');
    return this._currentTab;
  }
  async newTab() {
    const { browserContext } = await this._ensureBrowserContext();
    const page = await browserContext.newPage();
    this._currentTab = this._tabs.find((t) => t.page === page);
    return this._currentTab;
  }
  async selectTab(index) {
    const tab = this._tabs[index];
    if (!tab)
      throw new Error(`Tab ${index} not found`);
    await tab.page.bringToFront();
    this._currentTab = tab;
    return tab;
  }
  async ensureTab() {
    const { browserContext } = await this._ensureBrowserContext();
    if (!this._currentTab)
      await browserContext.newPage();
    return this._currentTab;
  }
  async closeTab(index) {
    const tab = index === void 0 ? this._currentTab : this._tabs[index];
    if (!tab)
      throw new Error(`Tab ${index} not found`);
    const url = tab.page.url();
    await tab.page.close();
    return url;
  }
  async outputFile(fileName, options) {
    return (0, import_config.outputFile)(this.config, this._clientInfo, fileName, options);
  }
  _onPageCreated(page) {
    const tab = new import_tab.Tab(this, page, (tab2) => this._onPageClosed(tab2));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
  }
  _onPageClosed(tab) {
    const index = this._tabs.indexOf(tab);
    if (index === -1)
      return;
    this._tabs.splice(index, 1);
    if (this._currentTab === tab)
      this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
    if (!this._tabs.length)
      void this.closeBrowserContext();
  }
  async closeBrowserContext() {
    if (!this._closeBrowserContextPromise)
      this._closeBrowserContextPromise = this._closeBrowserContextImpl().catch(import_log.logUnhandledError);
    await this._closeBrowserContextPromise;
    this._closeBrowserContextPromise = void 0;
  }
  isRunningTool() {
    return this._runningToolName !== void 0;
  }
  setRunningTool(name) {
    this._runningToolName = name;
  }
  async _closeBrowserContextImpl() {
    if (!this._browserContextPromise)
      return;
    testDebug("close context");
    const promise = this._browserContextPromise;
    this._browserContextPromise = void 0;
    await promise.then(async ({ browserContext, close }) => {
      if (this.config.saveTrace)
        await browserContext.tracing.stop();
      const videos = this.config.saveVideo ? browserContext.pages().map((page) => page.video()).filter((video) => !!video) : [];
      await close(async () => {
        for (const video of videos) {
          const name = await this.outputFile((0, import_utils.dateAsFileName)("webm"), { origin: "code", reason: "Saving video" });
          await import_fs.default.promises.mkdir(import_path.default.dirname(name), { recursive: true });
          const p = await video.path();
          if (import_fs.default.existsSync(p)) {
            try {
              await import_fs.default.promises.rename(p, name);
            } catch (e) {
              if (e.code !== "EXDEV")
                (0, import_log.logUnhandledError)(e);
              try {
                await import_fs.default.promises.copyFile(p, name);
                await import_fs.default.promises.unlink(p);
              } catch (e2) {
                (0, import_log.logUnhandledError)(e2);
              }
            }
          }
        }
      });
    });
  }
  async dispose() {
    this._abortController.abort("MCP context disposed");
    await this.closeBrowserContext();
    Context._allContexts.delete(this);
  }
  async _setupRequestInterception(context) {
    if (this.config.network?.allowedOrigins?.length) {
      await context.route("**", (route) => route.abort("blockedbyclient"));
      for (const origin of this.config.network.allowedOrigins)
        await context.route(originOrHostGlob(origin), (route) => route.continue());
    }
    if (this.config.network?.blockedOrigins?.length) {
      for (const origin of this.config.network.blockedOrigins)
        await context.route(originOrHostGlob(origin), (route) => route.abort("blockedbyclient"));
    }
  }
  async ensureBrowserContext() {
    const { browserContext } = await this._ensureBrowserContext();
    return browserContext;
  }
  _ensureBrowserContext() {
    if (!this._browserContextPromise) {
      this._browserContextPromise = this._setupBrowserContext();
      this._browserContextPromise.catch(() => {
        this._browserContextPromise = void 0;
      });
    }
    return this._browserContextPromise;
  }
  async _setupBrowserContext() {
    if (this._closeBrowserContextPromise)
      throw new Error("Another browser context is being closed.");
    const result = await this._browserContextFactory.createContext(this._clientInfo, this._abortController.signal, this._runningToolName);
    const { browserContext } = result;
    await this._setupRequestInterception(browserContext);
    if (this.sessionLog)
      await InputRecorder.create(this, browserContext);
    for (const page of browserContext.pages())
      this._onPageCreated(page);
    browserContext.on("page", (page) => this._onPageCreated(page));
    if (this.config.saveTrace) {
      await browserContext.tracing.start({
        name: "trace-" + Date.now(),
        screenshots: true,
        snapshots: true,
        _live: true
      });
    }
    return result;
  }
  lookupSecret(secretName) {
    if (!this.config.secrets?.[secretName])
      return { value: secretName, code: codegen.quote(secretName) };
    return {
      value: this.config.secrets[secretName],
      code: `process.env['${secretName}']`
    };
  }
}
function originOrHostGlob(originOrHost) {
  try {
    const url = new URL(originOrHost);
    if (url.origin !== "null")
      return `${url.origin}/**`;
  } catch {
  }
  return `*://${originOrHost}/**`;
}
class InputRecorder {
  constructor(context, browserContext) {
    this._context = context;
    this._browserContext = browserContext;
  }
  static async create(context, browserContext) {
    const recorder = new InputRecorder(context, browserContext);
    await recorder._initialize();
    return recorder;
  }
  async _initialize() {
    const sessionLog = this._context.sessionLog;
    await this._browserContext._enableRecorder({
      mode: "recording",
      recorderMode: "api"
    }, {
      actionAdded: (page, data, code) => {
        if (this._context.isRunningTool())
          return;
        const tab = import_tab.Tab.forPage(page);
        if (tab)
          sessionLog.logUserAction(data.action, tab, code, false);
      },
      actionUpdated: (page, data, code) => {
        if (this._context.isRunningTool())
          return;
        const tab = import_tab.Tab.forPage(page);
        if (tab)
          sessionLog.logUserAction(data.action, tab, code, true);
      },
      signalAdded: (page, data) => {
        if (this._context.isRunningTool())
          return;
        if (data.signal.name !== "navigation")
          return;
        const tab = import_tab.Tab.forPage(page);
        const navigateAction = {
          name: "navigate",
          url: data.signal.url,
          signals: []
        };
        if (tab)
          sessionLog.logUserAction(navigateAction, tab, `await page.goto('${data.signal.url}');`, false);
      }
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Context,
  InputRecorder
});
