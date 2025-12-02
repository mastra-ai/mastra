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
var verify_exports = {};
__export(verify_exports, {
  default: () => verify_default
});
module.exports = __toCommonJS(verify_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
var javascript = __toESM(require("../codegen"));
var import_utils = require("./utils");
const verifyElement = (0, import_tool.defineTabTool)({
  capability: "testing",
  schema: {
    name: "browser_verify_element_visible",
    title: "Verify element visible",
    description: "Verify element is visible on the page",
    inputSchema: import_bundle.z.object({
      role: import_bundle.z.string().describe('ROLE of the element. Can be found in the snapshot like this: `- {ROLE} "Accessible Name":`'),
      accessibleName: import_bundle.z.string().describe('ACCESSIBLE_NAME of the element. Can be found in the snapshot like this: `- role "{ACCESSIBLE_NAME}"`')
    }),
    type: "assertion"
  },
  handle: async (tab, params, response) => {
    const locator = tab.page.getByRole(params.role, { name: params.accessibleName });
    if (await locator.count() === 0) {
      response.addError(`Element with role "${params.role}" and accessible name "${params.accessibleName}" not found`);
      return;
    }
    response.addCode(`await expect(page.getByRole(${javascript.escapeWithQuotes(params.role)}, { name: ${javascript.escapeWithQuotes(params.accessibleName)} })).toBeVisible();`);
    response.addResult("Done");
  }
});
const verifyText = (0, import_tool.defineTabTool)({
  capability: "testing",
  schema: {
    name: "browser_verify_text_visible",
    title: "Verify text visible",
    description: `Verify text is visible on the page. Prefer ${verifyElement.schema.name} if possible.`,
    inputSchema: import_bundle.z.object({
      text: import_bundle.z.string().describe('TEXT to verify. Can be found in the snapshot like this: `- role "Accessible Name": {TEXT}` or like this: `- text: {TEXT}`')
    }),
    type: "assertion"
  },
  handle: async (tab, params, response) => {
    const locator = tab.page.getByText(params.text).filter({ visible: true });
    if (await locator.count() === 0) {
      response.addError("Text not found");
      return;
    }
    response.addCode(`await expect(page.getByText(${javascript.escapeWithQuotes(params.text)})).toBeVisible();`);
    response.addResult("Done");
  }
});
const verifyList = (0, import_tool.defineTabTool)({
  capability: "testing",
  schema: {
    name: "browser_verify_list_visible",
    title: "Verify list visible",
    description: "Verify list is visible on the page",
    inputSchema: import_bundle.z.object({
      element: import_bundle.z.string().describe("Human-readable list description"),
      ref: import_bundle.z.string().describe("Exact target element reference that points to the list"),
      items: import_bundle.z.array(import_bundle.z.string()).describe("Items to verify")
    }),
    type: "assertion"
  },
  handle: async (tab, params, response) => {
    const locator = await tab.refLocator({ ref: params.ref, element: params.element });
    const itemTexts = [];
    for (const item of params.items) {
      const itemLocator = locator.getByText(item);
      if (await itemLocator.count() === 0) {
        response.addError(`Item "${item}" not found`);
        return;
      }
      itemTexts.push(await itemLocator.textContent());
    }
    const ariaSnapshot = `\`
- list:
${itemTexts.map((t) => `  - listitem: ${javascript.escapeWithQuotes(t, '"')}`).join("\n")}
\``;
    response.addCode(`await expect(page.locator('body')).toMatchAriaSnapshot(${ariaSnapshot});`);
    response.addResult("Done");
  }
});
const verifyValue = (0, import_tool.defineTabTool)({
  capability: "testing",
  schema: {
    name: "browser_verify_value",
    title: "Verify value",
    description: "Verify element value",
    inputSchema: import_bundle.z.object({
      type: import_bundle.z.enum(["textbox", "checkbox", "radio", "combobox", "slider"]).describe("Type of the element"),
      element: import_bundle.z.string().describe("Human-readable element description"),
      ref: import_bundle.z.string().describe("Exact target element reference that points to the element"),
      value: import_bundle.z.string().describe('Value to verify. For checkbox, use "true" or "false".')
    }),
    type: "assertion"
  },
  handle: async (tab, params, response) => {
    const locator = await tab.refLocator({ ref: params.ref, element: params.element });
    const locatorSource = `page.${await (0, import_utils.generateLocator)(locator)}`;
    if (params.type === "textbox" || params.type === "slider" || params.type === "combobox") {
      const value = await locator.inputValue();
      if (value !== params.value) {
        response.addError(`Expected value "${params.value}", but got "${value}"`);
        return;
      }
      response.addCode(`await expect(${locatorSource}).toHaveValue(${javascript.quote(params.value)});`);
    } else if (params.type === "checkbox" || params.type === "radio") {
      const value = await locator.isChecked();
      if (value !== (params.value === "true")) {
        response.addError(`Expected value "${params.value}", but got "${value}"`);
        return;
      }
      const matcher = value ? "toBeChecked" : "not.toBeChecked";
      response.addCode(`await expect(${locatorSource}).${matcher}();`);
    }
    response.addResult("Done");
  }
});
var verify_default = [
  verifyElement,
  verifyText,
  verifyList,
  verifyValue
];
