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
var utils_exports = {};
__export(utils_exports, {
  callOnPageNoTrace: () => callOnPageNoTrace,
  dateAsFileName: () => dateAsFileName,
  generateLocator: () => generateLocator,
  waitForCompletion: () => waitForCompletion
});
module.exports = __toCommonJS(utils_exports);
var import_utils = require("playwright-core/lib/utils");
async function waitForCompletion(tab, callback) {
  const requests = /* @__PURE__ */ new Set();
  let frameNavigated = false;
  let waitCallback = () => {
  };
  const waitBarrier = new Promise((f) => {
    waitCallback = f;
  });
  const responseListener = (request) => {
    requests.delete(request);
    if (!requests.size)
      waitCallback();
  };
  const requestListener = (request) => {
    requests.add(request);
    void request.response().then(() => responseListener(request)).catch(() => {
    });
  };
  const frameNavigateListener = (frame) => {
    if (frame.parentFrame())
      return;
    frameNavigated = true;
    dispose();
    clearTimeout(timeout);
    void tab.waitForLoadState("load").then(waitCallback);
  };
  const onTimeout = () => {
    dispose();
    waitCallback();
  };
  tab.page.on("request", requestListener);
  tab.page.on("requestfailed", responseListener);
  tab.page.on("framenavigated", frameNavigateListener);
  const timeout = setTimeout(onTimeout, 1e4);
  const dispose = () => {
    tab.page.off("request", requestListener);
    tab.page.off("requestfailed", responseListener);
    tab.page.off("framenavigated", frameNavigateListener);
    clearTimeout(timeout);
  };
  try {
    const result = await callback();
    if (!requests.size && !frameNavigated)
      waitCallback();
    await waitBarrier;
    await tab.waitForTimeout(1e3);
    return result;
  } finally {
    dispose();
  }
}
async function generateLocator(locator) {
  try {
    const { resolvedSelector } = await locator._resolveSelector();
    return (0, import_utils.asLocator)("javascript", resolvedSelector);
  } catch (e) {
    throw new Error("Ref not found, likely because element was removed. Use browser_snapshot to see what elements are currently on the page.");
  }
}
async function callOnPageNoTrace(page, callback) {
  return await page._wrapApiCall(() => callback(page), { internal: true });
}
function dateAsFileName(extension) {
  const date = /* @__PURE__ */ new Date();
  return `page-${date.toISOString().replace(/[:.]/g, "-")}.${extension}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  callOnPageNoTrace,
  dateAsFileName,
  generateLocator,
  waitForCompletion
});
