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
var form_exports = {};
__export(form_exports, {
  default: () => form_default
});
module.exports = __toCommonJS(form_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
var import_utils = require("./utils");
var codegen = __toESM(require("../codegen"));
const fillForm = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_fill_form",
    title: "Fill form",
    description: "Fill multiple form fields",
    inputSchema: import_bundle.z.object({
      fields: import_bundle.z.array(import_bundle.z.object({
        name: import_bundle.z.string().describe("Human-readable field name"),
        type: import_bundle.z.enum(["textbox", "checkbox", "radio", "combobox", "slider"]).describe("Type of the field"),
        ref: import_bundle.z.string().describe("Exact target field reference from the page snapshot"),
        value: import_bundle.z.string().describe("Value to fill in the field. If the field is a checkbox, the value should be `true` or `false`. If the field is a combobox, the value should be the text of the option.")
      })).describe("Fields to fill in")
    }),
    type: "input"
  },
  handle: async (tab, params, response) => {
    for (const field of params.fields) {
      const locator = await tab.refLocator({ element: field.name, ref: field.ref });
      const locatorSource = `await page.${await (0, import_utils.generateLocator)(locator)}`;
      if (field.type === "textbox" || field.type === "slider") {
        const secret = tab.context.lookupSecret(field.value);
        await locator.fill(secret.value);
        response.addCode(`${locatorSource}.fill(${secret.code});`);
      } else if (field.type === "checkbox" || field.type === "radio") {
        await locator.setChecked(field.value === "true");
        response.addCode(`${locatorSource}.setChecked(${field.value});`);
      } else if (field.type === "combobox") {
        await locator.selectOption({ label: field.value });
        response.addCode(`${locatorSource}.selectOption(${codegen.quote(field.value)});`);
      }
    }
  }
});
var form_default = [
  fillForm
];
