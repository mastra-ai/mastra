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
var sessionLog_exports = {};
__export(sessionLog_exports, {
  SessionLog: () => SessionLog
});
module.exports = __toCommonJS(sessionLog_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_log = require("../log");
var import_config = require("./config");
class SessionLog {
  constructor(sessionFolder) {
    this._ordinal = 0;
    this._pendingEntries = [];
    this._sessionFileQueue = Promise.resolve();
    this._folder = sessionFolder;
    this._file = import_path.default.join(this._folder, "session.md");
  }
  static async create(config, clientInfo) {
    const sessionFolder = await (0, import_config.outputFile)(config, clientInfo, `session-${Date.now()}`, { origin: "code", reason: "Saving session" });
    await import_fs.default.promises.mkdir(sessionFolder, { recursive: true });
    console.error(`Session: ${sessionFolder}`);
    return new SessionLog(sessionFolder);
  }
  logResponse(response) {
    const entry = {
      timestamp: performance.now(),
      toolCall: {
        toolName: response.toolName,
        toolArgs: response.toolArgs,
        result: response.result(),
        isError: response.isError()
      },
      code: response.code(),
      tabSnapshot: response.tabSnapshot()
    };
    this._appendEntry(entry);
  }
  logUserAction(action, tab, code, isUpdate) {
    code = code.trim();
    if (isUpdate) {
      const lastEntry = this._pendingEntries[this._pendingEntries.length - 1];
      if (lastEntry?.userAction?.name === action.name) {
        lastEntry.userAction = action;
        lastEntry.code = code;
        return;
      }
    }
    if (action.name === "navigate") {
      const lastEntry = this._pendingEntries[this._pendingEntries.length - 1];
      if (lastEntry?.tabSnapshot?.url === action.url)
        return;
    }
    const entry = {
      timestamp: performance.now(),
      userAction: action,
      code,
      tabSnapshot: {
        url: tab.page.url(),
        title: "",
        ariaSnapshot: action.ariaSnapshot || "",
        modalStates: [],
        consoleMessages: [],
        downloads: []
      }
    };
    this._appendEntry(entry);
  }
  _appendEntry(entry) {
    this._pendingEntries.push(entry);
    if (this._flushEntriesTimeout)
      clearTimeout(this._flushEntriesTimeout);
    this._flushEntriesTimeout = setTimeout(() => this._flushEntries(), 1e3);
  }
  async _flushEntries() {
    clearTimeout(this._flushEntriesTimeout);
    const entries = this._pendingEntries;
    this._pendingEntries = [];
    const lines = [""];
    for (const entry of entries) {
      const ordinal = (++this._ordinal).toString().padStart(3, "0");
      if (entry.toolCall) {
        lines.push(
          `### Tool call: ${entry.toolCall.toolName}`,
          `- Args`,
          "```json",
          JSON.stringify(entry.toolCall.toolArgs, null, 2),
          "```"
        );
        if (entry.toolCall.result) {
          lines.push(
            entry.toolCall.isError ? `- Error` : `- Result`,
            "```",
            entry.toolCall.result,
            "```"
          );
        }
      }
      if (entry.userAction) {
        const actionData = { ...entry.userAction };
        delete actionData.ariaSnapshot;
        delete actionData.selector;
        delete actionData.signals;
        lines.push(
          `### User action: ${entry.userAction.name}`,
          `- Args`,
          "```json",
          JSON.stringify(actionData, null, 2),
          "```"
        );
      }
      if (entry.code) {
        lines.push(
          `- Code`,
          "```js",
          entry.code,
          "```"
        );
      }
      if (entry.tabSnapshot) {
        const fileName = `${ordinal}.snapshot.yml`;
        import_fs.default.promises.writeFile(import_path.default.join(this._folder, fileName), entry.tabSnapshot.ariaSnapshot).catch(import_log.logUnhandledError);
        lines.push(`- Snapshot: ${fileName}`);
      }
      lines.push("", "");
    }
    this._sessionFileQueue = this._sessionFileQueue.then(() => import_fs.default.promises.appendFile(this._file, lines.join("\n")));
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SessionLog
});
