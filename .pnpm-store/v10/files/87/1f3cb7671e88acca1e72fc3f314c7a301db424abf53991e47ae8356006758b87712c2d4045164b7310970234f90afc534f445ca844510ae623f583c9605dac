"use strict";
import path from "path";
import { entryPoints } from "../../bundler/index.js";
import {
  toAbsolutePath,
  toComponentDefinitionPath
} from "../lib/components/definition/directoryStructure.js";
import { importPath, moduleIdentifier } from "./api.js";
import { apiComment, compareStrings, header } from "./common.js";
import { parseValidator, validatorToType } from "./validator_helpers.js";
export function componentApiJs() {
  const lines = [];
  lines.push(header("Generated `api` utility."));
  lines.push(`
    import { anyApi, componentsGeneric } from "convex/server";

    ${apiComment("api", void 0)}
    export const api = anyApi;
    export const internal = anyApi;
    export const components = componentsGeneric();
  `);
  return lines.join("\n");
}
export function rootComponentApiCJS() {
  const lines = [];
  lines.push(header("Generated `api` utility."));
  lines.push(`const { anyApi } = require("convex/server");`);
  lines.push(`module.exports = {
    api: anyApi,
    internal: anyApi,
  };`);
  return lines.join("\n");
}
export function componentApiStubDTS() {
  const lines = [];
  lines.push(header("Generated `api` utility."));
  lines.push(`import type { AnyApi, AnyComponents } from "convex/server";`);
  lines.push(`
    export declare const api: AnyApi;
    export declare const internal: AnyApi;
    export declare const components: AnyComponents;
  `);
  return lines.join("\n");
}
export function componentApiStubTS() {
  const lines = [];
  lines.push(header("Generated `api` utility."));
  lines.push(`
    import type { AnyApi, AnyComponents } from "convex/server";
    import { anyApi, componentsGeneric } from "convex/server";

    export const api: AnyApi = anyApi;
    export const internal: AnyApi = anyApi;
    export const components: AnyComponents = componentsGeneric();
  `);
  return lines.join("\n");
}
export async function componentApiDTS(ctx, startPush, rootComponent, componentDirectory, componentsMap, opts) {
  const definitionPath = toComponentDefinitionPath(
    rootComponent,
    componentDirectory
  );
  const analysis = startPush.analysis[definitionPath];
  if (!analysis) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No analysis found for component ${definitionPath} orig: ${definitionPath}
in
${Object.keys(startPush.analysis).toString()}`
    });
  }
  const lines = [];
  lines.push(header("Generated `api` utility."));
  let apiLines;
  if (opts.staticApi) {
    apiLines = codegenStaticApiObjects(ctx, analysis);
  } else {
    apiLines = codegenDynamicApiObjects(ctx, componentDirectory);
  }
  for await (const line of apiLines) {
    lines.push(line);
  }
  lines.push(`
  export declare const components: {`);
  for (const childComponent of analysis.definition.childComponents) {
    const childComponentAnalysis = startPush.analysis[childComponent.path];
    if (!childComponentAnalysis) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No analysis found for child component ${childComponent.path}`
      });
    }
    if (opts.useComponentApiImports) {
      const absolutePath = toAbsolutePath(
        rootComponent,
        childComponent.path
      );
      let childComponentWithRelativePath = componentsMap?.get(absolutePath);
      if (!childComponentWithRelativePath) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Invalid child component directory: ${childComponent.path}`
        });
      }
      let importPath2;
      if (childComponentWithRelativePath.importSpecifier && childComponentWithRelativePath.importSpecifier !== childComponent.path) {
        importPath2 = childComponentWithRelativePath.importSpecifier;
      } else {
        importPath2 = `../${childComponent.path}`;
      }
      lines.push(
        `  "${childComponent.name}": import("${importPath2}/_generated/component.js").ComponentApi<"${childComponent.name}">,`
      );
    } else {
      for await (const line of codegenExports(
        ctx,
        childComponent.name,
        childComponentAnalysis
      )) {
        lines.push(line);
      }
    }
  }
  lines.push("};");
  return lines.join("\n");
}
export async function componentTS(ctx, startPush, rootComponent, componentDirectory) {
  const definitionPath = toComponentDefinitionPath(
    rootComponent,
    componentDirectory
  );
  const analysis = startPush.analysis[definitionPath];
  if (!analysis) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No analysis found for component ${definitionPath} orig: ${definitionPath}
in
${Object.keys(startPush.analysis).toString()}`
    });
  }
  const lines = [];
  lines.push(header("Generated `ComponentApi` utility."));
  lines.push(`
    import type { FunctionReference } from "convex/server";

    /**
    * A utility for referencing a Convex component's exposed API.
    *
    * Useful when expecting a parameter like \`components.myComponent\`.
    * Usage:
    * \`\`\`ts
    * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
    *   return ctx.runQuery(component.someFile.someQuery, { ...args });
    * }
    * \`\`\`
    */`);
  lines.push(
    `export type ComponentApi<Name extends string | undefined = string | undefined> = `
  );
  for await (const line of codegenExport(
    ctx,
    analysis,
    analysis.definition.exports,
    "Name"
  )) {
    lines.push(line);
  }
  lines.push(`;`);
  return lines.join("\n");
}
export async function componentApiTSWithTypes(ctx, startPush, rootComponent, componentDirectory, componentsMap, opts) {
  const definitionPath = toComponentDefinitionPath(
    rootComponent,
    componentDirectory
  );
  const analysis = startPush.analysis[definitionPath];
  if (!analysis) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No analysis found for component ${definitionPath} orig: ${definitionPath}
in
${Object.keys(startPush.analysis).toString()}`
    });
  }
  const lines = [];
  lines.push(header("Generated `api` utility."));
  let apiLines;
  if (opts.staticApi) {
    apiLines = codegenStaticApiObjectsTS(ctx, analysis);
  } else {
    apiLines = codegenDynamicApiObjectsTS(ctx, componentDirectory);
  }
  for await (const line of apiLines) {
    lines.push(line);
  }
  lines.push(`
  export const components = componentsGeneric() as unknown as {`);
  for (const childComponent of analysis.definition.childComponents) {
    const childComponentAnalysis = startPush.analysis[childComponent.path];
    if (!childComponentAnalysis) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No analysis found for child component ${childComponent.path}`
      });
    }
    if (opts.useComponentApiImports) {
      const absolutePath = toAbsolutePath(
        rootComponent,
        childComponent.path
      );
      let childComponentWithRelativePath = componentsMap?.get(absolutePath);
      if (!childComponentWithRelativePath) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Invalid child component directory: ${childComponent.path}`
        });
      }
      let importPath2;
      if (childComponentWithRelativePath.importSpecifier && childComponentWithRelativePath.importSpecifier !== childComponent.path) {
        importPath2 = childComponentWithRelativePath.importSpecifier;
      } else {
        importPath2 = `../${childComponent.path}`;
      }
      lines.push(
        `  "${childComponent.name}": import("${importPath2}/_generated/component.js").ComponentApi<"${childComponent.name}">,`
      );
    } else {
      for await (const line of codegenExports(
        ctx,
        childComponent.name,
        childComponentAnalysis
      )) {
        lines.push(line);
      }
    }
  }
  lines.push("};");
  return lines.join("\n");
}
async function* codegenStaticApiObjects(ctx, analysis) {
  yield `import type { FunctionReference } from "convex/server";`;
  yield `import type { GenericId as Id } from "convex/values";`;
  const apiTree = await buildApiTree(ctx, analysis.functions, {
    kind: "public"
  });
  yield apiComment("api", "public");
  yield `export declare const api:`;
  yield* codegenApiTree(ctx, apiTree);
  yield ";";
  yield apiComment("internal", "internal");
  const internalTree = await buildApiTree(ctx, analysis.functions, {
    kind: "internal"
  });
  yield `export declare const internal:`;
  yield* codegenApiTree(ctx, internalTree);
  yield ";";
}
async function* codegenStaticApiObjectsTS(ctx, analysis) {
  yield `import type { FunctionReference } from "convex/server";`;
  yield `import type { GenericId as Id } from "convex/values";`;
  yield `import { anyApi, componentsGeneric } from "convex/server";`;
  const apiTree = await buildApiTree(ctx, analysis.functions, {
    kind: "public"
  });
  yield apiComment("api", "public");
  yield `export const api:`;
  yield* codegenApiTree(ctx, apiTree);
  yield "= anyApi as any;";
  yield apiComment("internal", "internal");
  const internalTree = await buildApiTree(ctx, analysis.functions, {
    kind: "internal"
  });
  yield `export const internal:`;
  yield* codegenApiTree(ctx, internalTree);
  yield "= anyApi as any;";
}
async function* codegenDynamicApiObjects(ctx, componentDirectory) {
  const absModulePaths = await entryPoints(ctx, componentDirectory.path);
  const modulePaths = absModulePaths.map((p) => path.relative(componentDirectory.path, p)).sort();
  for (const modulePath of modulePaths) {
    const ident = moduleIdentifier(modulePath);
    const path2 = importPath(modulePath);
    yield `import type * as ${ident} from "../${path2}.js";`;
  }
  yield `
    import type {
      ApiFromModules,
      FilterApi,
      FunctionReference,
    } from "convex/server";

    declare const fullApi: ApiFromModules<{
  `;
  for (const modulePath of modulePaths) {
    const ident = moduleIdentifier(modulePath);
    const path2 = importPath(modulePath);
    yield `  "${path2}": typeof ${ident},`;
  }
  yield `}>;`;
  yield `
    ${apiComment("api", "public")}
    export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
    ${apiComment("internal", "internal")}
    export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  `;
}
async function* codegenDynamicApiObjectsTS(ctx, componentDirectory) {
  const absModulePaths = await entryPoints(ctx, componentDirectory.path);
  const modulePaths = absModulePaths.map((p) => path.relative(componentDirectory.path, p)).sort();
  for (const modulePath of modulePaths) {
    const ident = moduleIdentifier(modulePath);
    const path2 = importPath(modulePath);
    yield `import type * as ${ident} from "../${path2}.js";`;
  }
  yield `
    import type {
      ApiFromModules,
      FilterApi,
      FunctionReference,
    } from "convex/server";
    import { anyApi, componentsGeneric } from "convex/server";

    const fullApi: ApiFromModules<{
  `;
  for (const modulePath of modulePaths) {
    const ident = moduleIdentifier(modulePath);
    const path2 = importPath(modulePath);
    yield `  "${path2}": typeof ${ident},`;
  }
  yield `}> = anyApi as any;`;
  yield `
    ${apiComment("api", "public")}
    export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;
    ${apiComment("internal", "internal")}
    export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;
  `;
}
async function buildApiTree(ctx, functions, visibility) {
  const root = {};
  for (const [modulePath, module] of Object.entries(functions)) {
    const p = importPath(modulePath);
    if (p.startsWith("_deps/")) {
      continue;
    }
    for (const f of module.functions) {
      if (f.visibility?.kind !== visibility.kind) {
        continue;
      }
      let current = root;
      for (const pathComponent of p.split("/")) {
        let next = current[pathComponent];
        if (!next) {
          next = { type: "branch", branch: {} };
          current[pathComponent] = next;
        }
        if (next.type === "leaf") {
          return await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: `Ambiguous function name: ${f.name} in ${modulePath}`
          });
        }
        current = next.branch;
      }
      if (current[f.name]) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Duplicate function name: ${f.name} in ${modulePath}`
        });
      }
      current[f.name] = { type: "leaf", leaf: f };
    }
  }
  return root;
}
async function* codegenApiTree(ctx, tree) {
  yield "{";
  const sortedEntries = Object.entries(tree).sort(
    ([a], [b]) => compareStrings(a, b)
  );
  for (const [identifier, subtree] of sortedEntries) {
    if (subtree.type === "branch") {
      yield `"${identifier}":`;
      yield* codegenApiTree(ctx, subtree.branch);
      yield ",";
    } else {
      const visibility = subtree.leaf.visibility?.kind;
      if (!visibility) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Function ${subtree.leaf.name} has no visibility`
        });
      }
      const ref = await codegenFunctionReference(
        ctx,
        subtree.leaf,
        visibility,
        true,
        void 0
      );
      yield `"${identifier}": ${ref},`;
    }
  }
  yield "}";
}
async function* codegenExports(ctx, name, analysis) {
  yield `${name}: {`;
  const exports = analysis.definition.exports.branch;
  const entries = Array.from(exports).sort(([a], [b]) => compareStrings(a, b));
  for (const [name2, componentExport] of entries) {
    yield `${name2}:`;
    yield* codegenExport(ctx, analysis, componentExport, void 0);
    yield ",";
  }
  yield "},";
}
async function* codegenExport(ctx, analysis, componentExport, componentPath) {
  if (componentExport.type === "leaf") {
    yield await resolveFunctionReference(
      ctx,
      analysis,
      componentExport.leaf,
      "internal",
      componentPath
    );
  } else if (componentExport.type === "branch") {
    yield "{";
    const entries = Array.from(componentExport.branch).sort(
      ([a], [b]) => compareStrings(a, b)
    );
    for (const [name, childExport] of entries) {
      yield `${name}:`;
      yield* codegenExport(ctx, analysis, childExport, componentPath);
      yield ",";
    }
    yield "}";
  }
}
export async function resolveFunctionReference(ctx, analysis, reference, visibility, componentPath) {
  if (!reference.startsWith("_reference/function/")) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Invalid function reference: ${reference}`
    });
  }
  const udfPath = reference.slice("_reference/function/".length);
  const [modulePath, functionName] = udfPath.split(":");
  const canonicalizedModulePath = canonicalizeModulePath(modulePath);
  const analyzedModule = analysis.functions[canonicalizedModulePath];
  if (!analyzedModule) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Module not found: ${modulePath}`
    });
  }
  const analyzedFunction = analyzedModule.functions.find(
    (f) => f.name === functionName
  );
  if (!analyzedFunction) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Function not found: ${functionName}`
    });
  }
  return await codegenFunctionReference(
    ctx,
    analyzedFunction,
    visibility,
    false,
    componentPath
  );
}
async function codegenFunctionReference(ctx, analyzedFunction, visibility, useIdType, componentPath) {
  const udfType = analyzedFunction.udfType.toLowerCase();
  let argsType = "any";
  try {
    const argsValidator = parseValidator(analyzedFunction.args);
    if (argsValidator) {
      if (argsValidator.type === "object" || argsValidator.type === "any") {
        argsType = validatorToType(argsValidator, useIdType);
      } else {
        throw new Error(
          `Unexpected argument validator type: ${argsValidator.type}`
        );
      }
    }
  } catch (e) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Invalid function args: ${analyzedFunction.args}`,
      errForSentry: e
    });
  }
  let returnsType = "any";
  try {
    const returnsValidator = parseValidator(analyzedFunction.returns);
    if (returnsValidator) {
      returnsType = validatorToType(returnsValidator, useIdType);
    }
  } catch (e) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Invalid function returns: ${analyzedFunction.returns}`,
      errForSentry: e
    });
  }
  return `FunctionReference<"${udfType}", "${visibility}", ${argsType}, ${returnsType}${componentPath ? `, ${componentPath}` : ""}>`;
}
function canonicalizeModulePath(modulePath) {
  if (!modulePath.endsWith(".js")) {
    return modulePath + ".js";
  }
  return modulePath;
}
//# sourceMappingURL=component_api.js.map
