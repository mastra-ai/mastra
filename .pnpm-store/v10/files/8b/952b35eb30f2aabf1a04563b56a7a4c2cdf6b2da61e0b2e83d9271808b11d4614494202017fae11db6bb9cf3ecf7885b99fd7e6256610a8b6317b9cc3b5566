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
var pdf_exports = {};
__export(pdf_exports, {
  default: () => pdf_default
});
module.exports = __toCommonJS(pdf_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
var javascript = __toESM(require("../codegen"));
var import_utils = require("./utils");
const pdfSchema = import_bundle.z.object({
  filename: import_bundle.z.string().optional().describe("File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.")
});
const pdf = (0, import_tool.defineTabTool)({
  capability: "pdf",
  schema: {
    name: "browser_pdf_save",
    title: "Save as PDF",
    description: "Save page as PDF",
    inputSchema: pdfSchema,
    type: "readOnly"
  },
  handle: async (tab, params, response) => {
    const fileName = await tab.context.outputFile(params.filename ?? (0, import_utils.dateAsFileName)("pdf"), { origin: "llm", reason: "Saving PDF" });
    response.addCode(`await page.pdf(${javascript.formatObject({ path: fileName })});`);
    response.addResult(`Saved page as ${fileName}`);
    await tab.page.pdf({ path: fileName });
  }
});
var pdf_default = [
  pdf
];
