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
var tab_exports = {};
__export(tab_exports, {
  Tab: () => Tab,
  TabEvents: () => TabEvents,
  renderModalStates: () => renderModalStates
});
module.exports = __toCommonJS(tab_exports);
var import_events = require("events");
var import_utils = require("playwright-core/lib/utils");
var import_utils2 = require("./tools/utils");
var import_log = require("../log");
var import_dialogs = require("./tools/dialogs");
var import_files = require("./tools/files");
const TabEvents = {
  modalState: "modalState"
};
class Tab extends import_events.EventEmitter {
  constructor(context, page, onPageClose) {
    super();
    this._lastTitle = "about:blank";
    this._consoleMessages = [];
    this._recentConsoleMessages = [];
    this._requests = /* @__PURE__ */ new Set();
    this._modalStates = [];
    this._downloads = [];
    this.context = context;
    this.page = page;
    this._onPageClose = onPageClose;
    page.on("console", (event) => this._handleConsoleMessage(messageToConsoleMessage(event)));
    page.on("pageerror", (error) => this._handleConsoleMessage(pageErrorToConsoleMessage(error)));
    page.on("request", (request) => this._requests.add(request));
    page.on("close", () => this._onClose());
    page.on("filechooser", (chooser) => {
      this.setModalState({
        type: "fileChooser",
        description: "File chooser",
        fileChooser: chooser,
        clearedBy: import_files.uploadFile.schema.name
      });
    });
    page.on("dialog", (dialog) => this._dialogShown(dialog));
    page.on("download", (download) => {
      void this._downloadStarted(download);
    });
    page.setDefaultNavigationTimeout(this.context.config.timeouts.navigation);
    page.setDefaultTimeout(this.context.config.timeouts.action);
    page[tabSymbol] = this;
    this._initializedPromise = this._initialize();
  }
  static forPage(page) {
    return page[tabSymbol];
  }
  static async collectConsoleMessages(page) {
    const result = [];
    const messages = await page.consoleMessages().catch(() => []);
    for (const message of messages)
      result.push(messageToConsoleMessage(message));
    const errors = await page.pageErrors().catch(() => []);
    for (const error of errors)
      result.push(pageErrorToConsoleMessage(error));
    return result;
  }
  async _initialize() {
    for (const message of await Tab.collectConsoleMessages(this.page))
      this._handleConsoleMessage(message);
    const requests = await this.page.requests().catch(() => []);
    for (const request of requests)
      this._requests.add(request);
  }
  modalStates() {
    return this._modalStates;
  }
  setModalState(modalState) {
    this._modalStates.push(modalState);
    this.emit(TabEvents.modalState, modalState);
  }
  clearModalState(modalState) {
    this._modalStates = this._modalStates.filter((state) => state !== modalState);
  }
  modalStatesMarkdown() {
    return renderModalStates(this.context, this.modalStates());
  }
  _dialogShown(dialog) {
    this.setModalState({
      type: "dialog",
      description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
      dialog,
      clearedBy: import_dialogs.handleDialog.schema.name
    });
  }
  async _downloadStarted(download) {
    const entry = {
      download,
      finished: false,
      outputFile: await this.context.outputFile(download.suggestedFilename(), { origin: "web", reason: "Saving download" })
    };
    this._downloads.push(entry);
    await download.saveAs(entry.outputFile);
    entry.finished = true;
  }
  _clearCollectedArtifacts() {
    this._consoleMessages.length = 0;
    this._recentConsoleMessages.length = 0;
    this._requests.clear();
  }
  _handleConsoleMessage(message) {
    this._consoleMessages.push(message);
    this._recentConsoleMessages.push(message);
  }
  _onClose() {
    this._clearCollectedArtifacts();
    this._onPageClose(this);
  }
  async updateTitle() {
    await this._raceAgainstModalStates(async () => {
      this._lastTitle = await (0, import_utils2.callOnPageNoTrace)(this.page, (page) => page.title());
    });
  }
  lastTitle() {
    return this._lastTitle;
  }
  isCurrentTab() {
    return this === this.context.currentTab();
  }
  async waitForLoadState(state, options) {
    await (0, import_utils2.callOnPageNoTrace)(this.page, (page) => page.waitForLoadState(state, options).catch(import_log.logUnhandledError));
  }
  async navigate(url) {
    this._clearCollectedArtifacts();
    const downloadEvent = (0, import_utils2.callOnPageNoTrace)(this.page, (page) => page.waitForEvent("download").catch(import_log.logUnhandledError));
    try {
      await this.page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (_e) {
      const e = _e;
      const mightBeDownload = e.message.includes("net::ERR_ABORTED") || e.message.includes("Download is starting");
      if (!mightBeDownload)
        throw e;
      const download = await Promise.race([
        downloadEvent,
        new Promise((resolve) => setTimeout(resolve, 3e3))
      ]);
      if (!download)
        throw e;
      await new Promise((resolve) => setTimeout(resolve, 500));
      return;
    }
    await this.waitForLoadState("load", { timeout: 5e3 });
  }
  async consoleMessages(type) {
    await this._initializedPromise;
    return this._consoleMessages.filter((message) => type ? message.type === type : true);
  }
  async requests() {
    await this._initializedPromise;
    return this._requests;
  }
  async captureSnapshot() {
    let tabSnapshot;
    const modalStates = await this._raceAgainstModalStates(async () => {
      const snapshot = await this.page._snapshotForAI();
      tabSnapshot = {
        url: this.page.url(),
        title: await this.page.title(),
        ariaSnapshot: snapshot,
        modalStates: [],
        consoleMessages: [],
        downloads: this._downloads
      };
    });
    if (tabSnapshot) {
      tabSnapshot.consoleMessages = this._recentConsoleMessages;
      this._recentConsoleMessages = [];
    }
    return tabSnapshot ?? {
      url: this.page.url(),
      title: "",
      ariaSnapshot: "",
      modalStates,
      consoleMessages: [],
      downloads: []
    };
  }
  _javaScriptBlocked() {
    return this._modalStates.some((state) => state.type === "dialog");
  }
  async _raceAgainstModalStates(action) {
    if (this.modalStates().length)
      return this.modalStates();
    const promise = new import_utils.ManualPromise();
    const listener = (modalState) => promise.resolve([modalState]);
    this.once(TabEvents.modalState, listener);
    return await Promise.race([
      action().then(() => {
        this.off(TabEvents.modalState, listener);
        return [];
      }),
      promise
    ]);
  }
  async waitForCompletion(callback) {
    await this._raceAgainstModalStates(() => (0, import_utils2.waitForCompletion)(this, callback));
  }
  async refLocator(params) {
    return (await this.refLocators([params]))[0];
  }
  async refLocators(params) {
    const snapshot = await this.page._snapshotForAI();
    return params.map((param) => {
      if (!snapshot.includes(`[ref=${param.ref}]`))
        throw new Error(`Ref ${param.ref} not found in the current page snapshot. Try capturing new snapshot.`);
      return this.page.locator(`aria-ref=${param.ref}`).describe(param.element);
    });
  }
  async waitForTimeout(time) {
    if (this._javaScriptBlocked()) {
      await new Promise((f) => setTimeout(f, time));
      return;
    }
    await (0, import_utils2.callOnPageNoTrace)(this.page, (page) => {
      return page.evaluate(() => new Promise((f) => setTimeout(f, 1e3)));
    });
  }
}
function messageToConsoleMessage(message) {
  return {
    type: message.type(),
    text: message.text(),
    toString: () => `[${message.type().toUpperCase()}] ${message.text()} @ ${message.location().url}:${message.location().lineNumber}`
  };
}
function pageErrorToConsoleMessage(errorOrValue) {
  if (errorOrValue instanceof Error) {
    return {
      type: "error",
      text: errorOrValue.message,
      toString: () => errorOrValue.stack || errorOrValue.message
    };
  }
  return {
    type: "error",
    text: String(errorOrValue),
    toString: () => String(errorOrValue)
  };
}
function renderModalStates(context, modalStates) {
  const result = ["### Modal state"];
  if (modalStates.length === 0)
    result.push("- There is no modal state present");
  for (const state of modalStates)
    result.push(`- [${state.description}]: can be handled by the "${state.clearedBy}" tool`);
  return result;
}
const tabSymbol = Symbol("tabSymbol");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Tab,
  TabEvents,
  renderModalStates
});
