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
var keyboard_exports = {};
__export(keyboard_exports, {
  default: () => keyboard_default
});
module.exports = __toCommonJS(keyboard_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
var import_snapshot = require("./snapshot");
var import_utils = require("./utils");
const pressKey = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_press_key",
    title: "Press a key",
    description: "Press a key on the keyboard",
    inputSchema: import_bundle.z.object({
      key: import_bundle.z.string().describe("Name of the key to press or a character to generate, such as `ArrowLeft` or `a`")
    }),
    type: "input"
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    response.addCode(`// Press ${params.key}`);
    response.addCode(`await page.keyboard.press('${params.key}');`);
    await tab.waitForCompletion(async () => {
      await tab.page.keyboard.press(params.key);
    });
  }
});
const typeSchema = import_snapshot.elementSchema.extend({
  text: import_bundle.z.string().describe("Text to type into the element"),
  submit: import_bundle.z.boolean().optional().describe("Whether to submit entered text (press Enter after)"),
  slowly: import_bundle.z.boolean().optional().describe("Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.")
});
const type = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_type",
    title: "Type text",
    description: "Type text into editable element",
    inputSchema: typeSchema,
    type: "input"
  },
  handle: async (tab, params, response) => {
    const locator = await tab.refLocator(params);
    const secret = tab.context.lookupSecret(params.text);
    await tab.waitForCompletion(async () => {
      if (params.slowly) {
        response.setIncludeSnapshot();
        response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.pressSequentially(${secret.code});`);
        await locator.pressSequentially(secret.value);
      } else {
        response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.fill(${secret.code});`);
        await locator.fill(secret.value);
      }
      if (params.submit) {
        response.setIncludeSnapshot();
        response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.press('Enter');`);
        await locator.press("Enter");
      }
    });
  }
});
var keyboard_default = [
  pressKey,
  type
];
