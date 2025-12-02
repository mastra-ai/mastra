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
var screenshot_exports = {};
__export(screenshot_exports, {
  default: () => screenshot_default
});
module.exports = __toCommonJS(screenshot_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
var javascript = __toESM(require("../codegen"));
var import_utils = require("./utils");
const screenshotSchema = import_bundle.z.object({
  type: import_bundle.z.enum(["png", "jpeg"]).default("png").describe("Image format for the screenshot. Default is png."),
  filename: import_bundle.z.string().optional().describe("File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified."),
  element: import_bundle.z.string().optional().describe("Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too."),
  ref: import_bundle.z.string().optional().describe("Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too."),
  fullPage: import_bundle.z.boolean().optional().describe("When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.")
});
const screenshot = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_take_screenshot",
    title: "Take a screenshot",
    description: `Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.`,
    inputSchema: screenshotSchema,
    type: "readOnly"
  },
  handle: async (tab, params, response) => {
    if (!!params.element !== !!params.ref)
      throw new Error("Both element and ref must be provided or neither.");
    if (params.fullPage && params.ref)
      throw new Error("fullPage cannot be used with element screenshots.");
    const fileType = params.type || "png";
    const fileName = await tab.context.outputFile(params.filename ?? (0, import_utils.dateAsFileName)(fileType), { origin: "llm", reason: "Saving screenshot" });
    const options = {
      type: fileType,
      quality: fileType === "png" ? void 0 : 90,
      scale: "css",
      path: fileName,
      ...params.fullPage !== void 0 && { fullPage: params.fullPage }
    };
    const isElementScreenshot = params.element && params.ref;
    const screenshotTarget = isElementScreenshot ? params.element : params.fullPage ? "full page" : "viewport";
    response.addCode(`// Screenshot ${screenshotTarget} and save it as ${fileName}`);
    const locator = params.ref ? await tab.refLocator({ element: params.element || "", ref: params.ref }) : null;
    if (locator)
      response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.screenshot(${javascript.formatObject(options)});`);
    else
      response.addCode(`await page.screenshot(${javascript.formatObject(options)});`);
    const buffer = locator ? await locator.screenshot(options) : await tab.page.screenshot(options);
    response.addResult(`Took the ${screenshotTarget} screenshot and saved it as ${fileName}`);
    if (!params.fullPage) {
      response.addImage({
        contentType: fileType === "png" ? "image/png" : "image/jpeg",
        data: buffer
      });
    }
  }
});
var screenshot_default = [
  screenshot
];
