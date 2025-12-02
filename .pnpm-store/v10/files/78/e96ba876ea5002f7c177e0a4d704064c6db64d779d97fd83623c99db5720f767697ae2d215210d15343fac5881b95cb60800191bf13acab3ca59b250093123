import { header } from "./common.js";

export function importPath(modulePath: string) {
  // Replace backslashes with forward slashes.
  const filePath = modulePath.replace(/\\/g, "/");
  // Strip off the file extension.
  const lastDot = filePath.lastIndexOf(".");
  return filePath.slice(0, lastDot === -1 ? undefined : lastDot);
}

export function moduleIdentifier(modulePath: string) {
  // TODO: This encoding is ambiguous (`foo/bar` vs `foo_bar` vs `foo-bar`).
  // Also we should be renaming keywords like `delete`.
  let safeModulePath = importPath(modulePath)
    .replace(/\//g, "_")
    .replace(/-/g, "_");
  // Escape existing variable names in this file
  if (["fullApi", "api", "internal", "components"].includes(safeModulePath)) {
    safeModulePath = `${safeModulePath}_`;
  }
  // Escape reserved words which are legal property names unescaped but are not
  // legal identifiers.
  // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words
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
    "public",
  ];
  if (reserved.includes(safeModulePath)) {
    safeModulePath = `${safeModulePath}_`;
  }
  return safeModulePath;
}

export function apiCodegen(
  modulePaths: string[],
  opts?: { useTypeScript?: boolean },
) {
  const useTypeScript = opts?.useTypeScript ?? false;

  if (!useTypeScript) {
    // Generate separate .js and .d.ts files
    const apiDTS = `${header("Generated `api` utility.")}
  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  ${modulePaths
    .map(
      (modulePath) =>
        `import type * as ${moduleIdentifier(modulePath)} from "../${importPath(
          modulePath,
        )}.js";`,
    )
    .join("\n")}

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * \`\`\`js
   * const myFunctionReference = api.myModule.myFunction;
   * \`\`\`
   */
  declare const fullApi: ApiFromModules<{
    ${modulePaths
      .map(
        (modulePath) =>
          `"${importPath(modulePath)}": typeof ${moduleIdentifier(modulePath)},`,
      )
      .join("\n")}
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  `;

    const apiJS = `${header("Generated `api` utility.")}
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
      JS: apiJS,
    };
  } else {
    // Generate combined .ts file
    const apiTS = `${header("Generated `api` utility.")}
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { anyApi } from "convex/server";
${modulePaths
  .map(
    (modulePath) =>
      `import type * as ${moduleIdentifier(modulePath)} from "../${importPath(
        modulePath,
      )}.js";`,
  )
  .join("\n")}

const fullApi: ApiFromModules<{
  ${modulePaths
    .map(
      (modulePath) =>
        `"${importPath(modulePath)}": typeof ${moduleIdentifier(modulePath)},`,
    )
    .join("\n")}
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
      TS: apiTS,
    };
  }
}
