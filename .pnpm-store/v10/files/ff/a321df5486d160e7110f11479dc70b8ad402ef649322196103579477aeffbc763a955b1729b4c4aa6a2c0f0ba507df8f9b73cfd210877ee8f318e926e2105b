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
var matcherHint_exports = {};
__export(matcherHint_exports, {
  ExpectError: () => ExpectError,
  callLogText: () => callLogText,
  formatMatcherMessage: () => formatMatcherMessage,
  isJestError: () => isJestError
});
module.exports = __toCommonJS(matcherHint_exports);
var import_utils = require("playwright-core/lib/utils");
var import_expectBundle = require("../common/expectBundle");
function formatMatcherMessage(state, details) {
  const receiver = details.receiver ?? (details.locator ? "locator" : "page");
  let message = (0, import_expectBundle.DIM_COLOR)("expect(") + (0, import_expectBundle.RECEIVED_COLOR)(receiver) + (0, import_expectBundle.DIM_COLOR)(")" + (state.promise ? "." + state.promise : "") + (state.isNot ? ".not" : "") + ".") + details.matcherName + (0, import_expectBundle.DIM_COLOR)("(") + (0, import_expectBundle.EXPECTED_COLOR)(details.expectation) + (0, import_expectBundle.DIM_COLOR)(")") + " failed\n\n";
  const diffLines = details.printedDiff?.split("\n");
  if (diffLines?.length === 2) {
    details.printedExpected = diffLines[0];
    details.printedReceived = diffLines[1];
    details.printedDiff = void 0;
  }
  const align = !details.errorMessage && details.printedExpected?.startsWith("Expected:") && (!details.printedReceived || details.printedReceived.startsWith("Received:"));
  if (details.locator)
    message += `Locator: ${align ? " " : ""}${String(details.locator)}
`;
  if (details.printedExpected)
    message += details.printedExpected + "\n";
  if (details.printedReceived)
    message += details.printedReceived + "\n";
  if (details.timedOut && details.timeout)
    message += `Timeout: ${align ? " " : ""}${details.timeout}ms
`;
  if (details.printedDiff)
    message += details.printedDiff + "\n";
  if (details.errorMessage) {
    message += details.errorMessage;
    if (!details.errorMessage.endsWith("\n"))
      message += "\n";
  }
  message += callLogText(details.log);
  return message;
}
class ExpectError extends Error {
  constructor(jestError, customMessage, stackFrames) {
    super("");
    this.name = jestError.name;
    this.message = jestError.message;
    this.matcherResult = jestError.matcherResult;
    if (customMessage)
      this.message = customMessage + "\n\n" + this.message;
    this.stack = this.name + ": " + this.message + "\n" + (0, import_utils.stringifyStackFrames)(stackFrames).join("\n");
  }
}
function isJestError(e) {
  return e instanceof Error && "matcherResult" in e;
}
const callLogText = (log) => {
  if (!log || !log.some((l) => !!l))
    return "";
  return `
Call log:
${(0, import_expectBundle.DIM_COLOR)(log.join("\n"))}
`;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ExpectError,
  callLogText,
  formatMatcherMessage,
  isJestError
});
