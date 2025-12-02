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
var snapshot_exports = {};
__export(snapshot_exports, {
  default: () => snapshot_default,
  elementSchema: () => elementSchema
});
module.exports = __toCommonJS(snapshot_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
var javascript = __toESM(require("../codegen"));
var import_utils = require("./utils");
const snapshot = (0, import_tool.defineTool)({
  capability: "core",
  schema: {
    name: "browser_snapshot",
    title: "Page snapshot",
    description: "Capture accessibility snapshot of the current page, this is better than screenshot",
    inputSchema: import_bundle.z.object({}),
    type: "readOnly"
  },
  handle: async (context, params, response) => {
    await context.ensureTab();
    response.setIncludeSnapshot();
  }
});
const elementSchema = import_bundle.z.object({
  element: import_bundle.z.string().describe("Human-readable element description used to obtain permission to interact with the element"),
  ref: import_bundle.z.string().describe("Exact target element reference from the page snapshot")
});
const clickSchema = elementSchema.extend({
  doubleClick: import_bundle.z.boolean().optional().describe("Whether to perform a double click instead of a single click"),
  button: import_bundle.z.enum(["left", "right", "middle"]).optional().describe("Button to click, defaults to left"),
  modifiers: import_bundle.z.array(import_bundle.z.enum(["Alt", "Control", "ControlOrMeta", "Meta", "Shift"])).optional().describe("Modifier keys to press")
});
const click = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_click",
    title: "Click",
    description: "Perform click on a web page",
    inputSchema: clickSchema,
    type: "input"
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    const locator = await tab.refLocator(params);
    const options = {
      button: params.button,
      modifiers: params.modifiers
    };
    const formatted = javascript.formatObject(options, " ", "oneline");
    const optionsAttr = formatted !== "{}" ? formatted : "";
    if (params.doubleClick)
      response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.dblclick(${optionsAttr});`);
    else
      response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.click(${optionsAttr});`);
    await tab.waitForCompletion(async () => {
      if (params.doubleClick)
        await locator.dblclick(options);
      else
        await locator.click(options);
    });
  }
});
const drag = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_drag",
    title: "Drag mouse",
    description: "Perform drag and drop between two elements",
    inputSchema: import_bundle.z.object({
      startElement: import_bundle.z.string().describe("Human-readable source element description used to obtain the permission to interact with the element"),
      startRef: import_bundle.z.string().describe("Exact source element reference from the page snapshot"),
      endElement: import_bundle.z.string().describe("Human-readable target element description used to obtain the permission to interact with the element"),
      endRef: import_bundle.z.string().describe("Exact target element reference from the page snapshot")
    }),
    type: "input"
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    const [startLocator, endLocator] = await tab.refLocators([
      { ref: params.startRef, element: params.startElement },
      { ref: params.endRef, element: params.endElement }
    ]);
    await tab.waitForCompletion(async () => {
      await startLocator.dragTo(endLocator);
    });
    response.addCode(`await page.${await (0, import_utils.generateLocator)(startLocator)}.dragTo(page.${await (0, import_utils.generateLocator)(endLocator)});`);
  }
});
const hover = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_hover",
    title: "Hover mouse",
    description: "Hover over element on page",
    inputSchema: elementSchema,
    type: "input"
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    const locator = await tab.refLocator(params);
    response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.hover();`);
    await tab.waitForCompletion(async () => {
      await locator.hover();
    });
  }
});
const selectOptionSchema = elementSchema.extend({
  values: import_bundle.z.array(import_bundle.z.string()).describe("Array of values to select in the dropdown. This can be a single value or multiple values.")
});
const selectOption = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_select_option",
    title: "Select option",
    description: "Select an option in a dropdown",
    inputSchema: selectOptionSchema,
    type: "input"
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    const locator = await tab.refLocator(params);
    response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.selectOption(${javascript.formatObject(params.values)});`);
    await tab.waitForCompletion(async () => {
      await locator.selectOption(params.values);
    });
  }
});
const pickLocator = (0, import_tool.defineTabTool)({
  capability: "testing",
  schema: {
    name: "browser_generate_locator",
    title: "Create locator for element",
    description: "Generate locator for the given element to use in tests",
    inputSchema: elementSchema,
    type: "readOnly"
  },
  handle: async (tab, params, response) => {
    const locator = await tab.refLocator(params);
    response.addResult(await (0, import_utils.generateLocator)(locator));
  }
});
var snapshot_default = [
  snapshot,
  click,
  drag,
  hover,
  selectOption,
  pickLocator
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  elementSchema
});
