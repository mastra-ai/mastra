import path from "path";
import { Context } from "../../bundler/context.js";
import { entryPoints } from "../../bundler/index.js";
import {
  ComponentDirectory,
  toAbsolutePath,
  toComponentDefinitionPath,
  ComponentDefinitionPath,
} from "../lib/components/definition/directoryStructure.js";
import { StartPushResponse } from "../lib/deployApi/startPush.js";
import { importPath, moduleIdentifier } from "./api.js";
import { apiComment, compareStrings, header } from "./common.js";
import {
  ComponentExports,
  EvaluatedComponentDefinition,
} from "../lib/deployApi/componentDefinition.js";
import { Identifier, Reference } from "../lib/deployApi/types.js";
import { CanonicalizedModulePath } from "../lib/deployApi/paths.js";
import {
  AnalyzedFunction,
  AnalyzedModule,
  Visibility,
} from "../lib/deployApi/modules.js";
import { parseValidator, validatorToType } from "./validator_helpers.js";

export function componentApiJs() {
  const lines = [];
  lines.push(header("Generated `api` utility."));
  lines.push(`
    import { anyApi, componentsGeneric } from "convex/server";

    ${apiComment("api", undefined)}
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

// This is also used for root components
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

export async function componentApiDTS(
  ctx: Context,
  startPush: StartPushResponse,
  rootComponent: ComponentDirectory,
  componentDirectory: ComponentDirectory,
  componentsMap: Map<string, ComponentDirectory>,
  opts: { staticApi: boolean; useComponentApiImports: boolean },
) {
  const definitionPath = toComponentDefinitionPath(
    rootComponent,
    componentDirectory,
  );

  const analysis = startPush.analysis[definitionPath];
  if (!analysis) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No analysis found for component ${definitionPath} orig: ${definitionPath}\nin\n${Object.keys(startPush.analysis).toString()}`,
    });
  }

  const lines = [];
  lines.push(header("Generated `api` utility."));
  let apiLines: AsyncGenerator<string>;
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
        printedMessage: `No analysis found for child component ${childComponent.path}`,
      });
    }
    if (opts.useComponentApiImports) {
      const absolutePath = toAbsolutePath(
        rootComponent,
        childComponent.path as ComponentDefinitionPath,
      );

      let childComponentWithRelativePath = componentsMap?.get(absolutePath);
      if (!childComponentWithRelativePath) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Invalid child component directory: ${childComponent.path}`,
        });
      }

      let importPath;

      // If the user uses a different import specifier than the absolute path of the child component, use the import specifier.
      if (
        childComponentWithRelativePath.importSpecifier &&
        childComponentWithRelativePath.importSpecifier !== childComponent.path
      ) {
        importPath = childComponentWithRelativePath.importSpecifier;
      } else {
        importPath = `../${childComponent.path}`;
      }
      lines.push(
        `  "${childComponent.name}": import("${importPath}/_generated/component.js").ComponentApi<"${childComponent.name}">,`,
      );
    } else {
      for await (const line of codegenExports(
        ctx,
        childComponent.name,
        childComponentAnalysis,
      )) {
        lines.push(line);
      }
    }
  }

  lines.push("};");

  return lines.join("\n");
}

export async function componentTS(
  ctx: Context,
  startPush: StartPushResponse,
  rootComponent: ComponentDirectory,
  componentDirectory: ComponentDirectory,
) {
  const definitionPath = toComponentDefinitionPath(
    rootComponent,
    componentDirectory,
  );
  const analysis = startPush.analysis[definitionPath];
  if (!analysis) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No analysis found for component ${definitionPath} orig: ${definitionPath}\nin\n${Object.keys(startPush.analysis).toString()}`,
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
    `export type ComponentApi<Name extends string | undefined = string | undefined> = `,
  );
  for await (const line of codegenExport(
    ctx,
    analysis,
    analysis.definition.exports,
    "Name",
  )) {
    lines.push(line);
  }
  lines.push(`;`);
  return lines.join("\n");
}

export async function componentApiTSWithTypes(
  ctx: Context,
  startPush: StartPushResponse,
  rootComponent: ComponentDirectory,
  componentDirectory: ComponentDirectory,
  componentsMap: Map<string, ComponentDirectory>,
  opts: { staticApi: boolean; useComponentApiImports: boolean },
) {
  const definitionPath = toComponentDefinitionPath(
    rootComponent,
    componentDirectory,
  );

  const analysis = startPush.analysis[definitionPath];
  if (!analysis) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No analysis found for component ${definitionPath} orig: ${definitionPath}\nin\n${Object.keys(startPush.analysis).toString()}`,
    });
  }

  const lines = [];
  lines.push(header("Generated `api` utility."));
  let apiLines: AsyncGenerator<string>;
  if (opts.staticApi) {
    apiLines = codegenStaticApiObjectsTS(ctx, analysis);
  } else {
    apiLines = codegenDynamicApiObjectsTS(ctx, componentDirectory);
  }
  for await (const line of apiLines) {
    lines.push(line);
  }

  // Generate components section
  lines.push(`
  export const components = componentsGeneric() as unknown as {`);
  for (const childComponent of analysis.definition.childComponents) {
    const childComponentAnalysis = startPush.analysis[childComponent.path];
    if (!childComponentAnalysis) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No analysis found for child component ${childComponent.path}`,
      });
    }
    if (opts.useComponentApiImports) {
      const absolutePath = toAbsolutePath(
        rootComponent,
        childComponent.path as ComponentDefinitionPath,
      );

      let childComponentWithRelativePath = componentsMap?.get(absolutePath);
      if (!childComponentWithRelativePath) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Invalid child component directory: ${childComponent.path}`,
        });
      }

      let importPath;

      // If the user uses a different import specifier than the absolute path of the child component, use the import specifier.
      if (
        childComponentWithRelativePath.importSpecifier &&
        childComponentWithRelativePath.importSpecifier !== childComponent.path
      ) {
        importPath = childComponentWithRelativePath.importSpecifier;
      } else {
        importPath = `../${childComponent.path}`;
      }
      lines.push(
        `  "${childComponent.name}": import("${importPath}/_generated/component.js").ComponentApi<"${childComponent.name}">,`,
      );
    } else {
      for await (const line of codegenExports(
        ctx,
        childComponent.name,
        childComponentAnalysis,
      )) {
        lines.push(line);
      }
    }
  }
  lines.push("};");

  return lines.join("\n");
}

async function* codegenStaticApiObjects(
  ctx: Context,
  analysis: EvaluatedComponentDefinition,
) {
  yield `import type { FunctionReference } from "convex/server";`;
  yield `import type { GenericId as Id } from "convex/values";`;

  const apiTree = await buildApiTree(ctx, analysis.functions, {
    kind: "public",
  });
  yield apiComment("api", "public");
  yield `export declare const api:`;
  yield* codegenApiTree(ctx, apiTree);
  yield ";";

  yield apiComment("internal", "internal");
  const internalTree = await buildApiTree(ctx, analysis.functions, {
    kind: "internal",
  });
  yield `export declare const internal:`;
  yield* codegenApiTree(ctx, internalTree);
  yield ";";
}

async function* codegenStaticApiObjectsTS(
  ctx: Context,
  analysis: EvaluatedComponentDefinition,
) {
  yield `import type { FunctionReference } from "convex/server";`;
  yield `import type { GenericId as Id } from "convex/values";`;
  yield `import { anyApi, componentsGeneric } from "convex/server";`;

  const apiTree = await buildApiTree(ctx, analysis.functions, {
    kind: "public",
  });
  yield apiComment("api", "public");
  yield `export const api:`;
  yield* codegenApiTree(ctx, apiTree);
  yield "= anyApi as any;";

  yield apiComment("internal", "internal");
  const internalTree = await buildApiTree(ctx, analysis.functions, {
    kind: "internal",
  });
  yield `export const internal:`;
  yield* codegenApiTree(ctx, internalTree);
  yield "= anyApi as any;";
}

async function* codegenDynamicApiObjects(
  ctx: Context,
  componentDirectory: ComponentDirectory,
) {
  const absModulePaths = await entryPoints(ctx, componentDirectory.path);
  const modulePaths = absModulePaths
    .map((p) => path.relative(componentDirectory.path, p))
    .sort();
  for (const modulePath of modulePaths) {
    const ident = moduleIdentifier(modulePath);
    const path = importPath(modulePath);
    yield `import type * as ${ident} from "../${path}.js";`;
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
    const path = importPath(modulePath);
    yield `  "${path}": typeof ${ident},`;
  }
  yield `}>;`;
  yield `
    ${apiComment("api", "public")}
    export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
    ${apiComment("internal", "internal")}
    export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  `;
}

async function* codegenDynamicApiObjectsTS(
  ctx: Context,
  componentDirectory: ComponentDirectory,
) {
  const absModulePaths = await entryPoints(ctx, componentDirectory.path);
  const modulePaths = absModulePaths
    .map((p) => path.relative(componentDirectory.path, p))
    .sort();
  for (const modulePath of modulePaths) {
    const ident = moduleIdentifier(modulePath);
    const path = importPath(modulePath);
    yield `import type * as ${ident} from "../${path}.js";`;
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
    const path = importPath(modulePath);
    yield `  "${path}": typeof ${ident},`;
  }
  yield `}> = anyApi as any;`;
  yield `
    ${apiComment("api", "public")}
    export const api: FilterApi<typeof fullApi, FunctionReference<any, "public">> = anyApi as any;
    ${apiComment("internal", "internal")}
    export const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">> = anyApi as any;
  `;
}

interface ApiTree {
  [identifier: string]:
    | { type: "branch"; branch: ApiTree }
    | { type: "leaf"; leaf: AnalyzedFunction };
}

async function buildApiTree(
  ctx: Context,
  functions: Record<CanonicalizedModulePath, AnalyzedModule>,
  visibility: Visibility,
): Promise<ApiTree> {
  const root: ApiTree = {};
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
            printedMessage: `Ambiguous function name: ${f.name} in ${modulePath}`,
          });
        }
        current = next.branch;
      }
      if (current[f.name]) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Duplicate function name: ${f.name} in ${modulePath}`,
        });
      }
      current[f.name] = { type: "leaf", leaf: f };
    }
  }
  return root;
}

async function* codegenApiTree(
  ctx: Context,
  tree: ApiTree,
): AsyncGenerator<string> {
  yield "{";
  // Sort entries alphabetically for stable output
  const sortedEntries = Object.entries(tree).sort(([a], [b]) =>
    compareStrings(a, b),
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
          printedMessage: `Function ${subtree.leaf.name} has no visibility`,
        });
      }
      const ref = await codegenFunctionReference(
        ctx,
        subtree.leaf,
        visibility,
        true,
        undefined,
      );
      yield `"${identifier}": ${ref},`;
    }
  }
  yield "}";
}

async function* codegenExports(
  ctx: Context,
  name: Identifier,
  analysis: EvaluatedComponentDefinition,
): AsyncGenerator<string> {
  yield `${name}: {`;
  const exports = analysis.definition.exports.branch;
  const entries = Array.from(exports).sort(([a], [b]) => compareStrings(a, b));
  for (const [name, componentExport] of entries) {
    yield `${name}:`;
    yield* codegenExport(ctx, analysis, componentExport, undefined);
    yield ",";
  }
  yield "},";
}

async function* codegenExport(
  ctx: Context,
  analysis: EvaluatedComponentDefinition,
  componentExport: ComponentExports,
  componentPath: string | undefined,
): AsyncGenerator<string> {
  if (componentExport.type === "leaf") {
    yield await resolveFunctionReference(
      ctx,
      analysis,
      componentExport.leaf,
      "internal",
      componentPath,
    );
  } else if (componentExport.type === "branch") {
    yield "{";
    const entries = Array.from(componentExport.branch).sort(([a], [b]) =>
      compareStrings(a, b),
    );
    for (const [name, childExport] of entries) {
      yield `${name}:`;
      yield* codegenExport(ctx, analysis, childExport, componentPath);
      yield ",";
    }
    yield "}";
  }
}

export async function resolveFunctionReference(
  ctx: Context,
  analysis: EvaluatedComponentDefinition,
  reference: Reference,
  visibility: "public" | "internal",
  componentPath: string | undefined,
) {
  if (!reference.startsWith("_reference/function/")) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Invalid function reference: ${reference}`,
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
      printedMessage: `Module not found: ${modulePath}`,
    });
  }
  const analyzedFunction = analyzedModule.functions.find(
    (f) => f.name === functionName,
  );
  if (!analyzedFunction) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Function not found: ${functionName}`,
    });
  }
  return await codegenFunctionReference(
    ctx,
    analyzedFunction,
    visibility,
    false,
    componentPath,
  );
}

async function codegenFunctionReference(
  ctx: Context,
  analyzedFunction: AnalyzedFunction,
  visibility: "public" | "internal",
  useIdType: boolean,
  componentPath: string | undefined,
): Promise<string> {
  // The server sends down `udfType` capitalized.
  const udfType = analyzedFunction.udfType.toLowerCase();

  let argsType = "any";
  try {
    const argsValidator = parseValidator(analyzedFunction.args);
    if (argsValidator) {
      if (argsValidator.type === "object" || argsValidator.type === "any") {
        argsType = validatorToType(argsValidator, useIdType);
      } else {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error(
          `Unexpected argument validator type: ${argsValidator.type}`,
        );
      }
    }
  } catch (e) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Invalid function args: ${analyzedFunction.args}`,
      errForSentry: e,
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
      errForSentry: e,
    });
  }

  return `FunctionReference<"${udfType}", "${visibility}", ${argsType}, ${returnsType}${componentPath ? `, ${componentPath}` : ""}>`;
}

function canonicalizeModulePath(modulePath: string): CanonicalizedModulePath {
  if (!modulePath.endsWith(".js")) {
    return modulePath + ".js";
  }
  return modulePath;
}
