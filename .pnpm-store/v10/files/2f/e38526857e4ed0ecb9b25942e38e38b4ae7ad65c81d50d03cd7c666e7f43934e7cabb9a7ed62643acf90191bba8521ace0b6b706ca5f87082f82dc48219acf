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
var api_exports = {};
__export(api_exports, {
  apiCodegen: () => apiCodegen,
  importPath: () => importPath,
  moduleIdentifier: () => moduleIdentifier
});
module.exports = __toCommonJS(api_exports);
var import_common = require("./common.js");
function importPath(modulePath) {
  const filePath = modulePath.replace(/\\/g, "/");
  const lastDot = filePath.lastIndexOf(".");
  return filePath.slice(0, lastDot === -1 ? void 0 : lastDot);
}
function moduleIdentifier(modulePath) {
  let safeModulePath = importPath(modulePath).replace(/\//g, "_").replace(/-/g, "_");
  if (["fullApi", "api", "internal", "components"].includes(safeModulePath)) {
    safeModulePath = `${safeModulePath}_`;
  }
  const reserved = [
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "let",
    "static",
    "yield",
    "await",
    "enum",
    "implements",
    "interface",
    "package",
    "private",
    "protected",
    "public"
  ];
  if (reserved.includes(safeModulePath)) {
    safeModulePath = `${safeModulePath}_`;
  }
  return safeModulePath;
}
function apiCodegen(modulePaths, opts) {
  const useTypeScript = opts?.useTypeScript ?? false;
  if (!useTypeScript) {
    const apiDTS = `${(0, import_common.header)("Generated `api` utility.")}
  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  ${modulePaths.map(
      (modulePath) => `import type * as ${moduleIdentifier(modulePath)} from "../${importPath(
        modulePath
      )}.js";`
    ).join("\n")}

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * \`\`\`js
   * const myFunctionReference = api.myModule.myFunction;
   * \`\`\`
   */
  declare const fullApi: ApiFromModules<{
    ${modulePaths.map(
      (modulePath) => `"${importPath(modulePath)}": typeof ${moduleIdentifier(modulePath)},`
    ).join("\n")}
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  `;
    const apiJS = `${(0, import_common.header)("Generated `api` utility.")}
  import { anyApi } from "convex/server";

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * \`\`\`js
   * const myFunctionReference = api.myModule.myFunction;
   * \`\`\`
   */
  export const api = anyApi;
  export const internal = anyApi;
  `;
    return {
      DTS: apiDTS,
      JS: apiJS
    };
  } else {
    const apiTS = `${(0, import_common.header)("Generated `api` utility.")}
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { anyApi } from "convex/server";
${modulePaths.map(
      (modulePath) => `import type * as ${moduleIdentifier(modulePath)} from "../${importPath(
        modulePath
      )}.js";`
    ).join("\n")}

const fullApi: ApiFromModules<{
  ${modulePaths.map(
      (modulePath) => `"${importPath(modulePath)}": typeof ${moduleIdentifier(modulePath)},`
    ).join("\n")}
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * \`\`\`js
 * const myFunctionReference = api.myModule.myFunction;
 * \`\`\`
 */
export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * \`\`\`js
 * const myFunctionReference = internal.myModule.myFunction;
 * \`\`\`
 */
export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;
`;
    return {
      TS: apiTS
    };
  }
}
//# sourceMappingURL=api.js.map
