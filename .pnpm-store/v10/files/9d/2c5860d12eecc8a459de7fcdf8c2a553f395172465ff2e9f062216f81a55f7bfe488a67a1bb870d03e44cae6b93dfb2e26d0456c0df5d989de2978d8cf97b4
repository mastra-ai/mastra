"use strict";
import path from "path";
import {
  DEFINITION_FILENAME_JS,
  DEFINITION_FILENAME_TS
} from "../constants.js";
import { getFunctionsDirectoryPath } from "../../config.js";
export function qualifiedDefinitionPath(directory, workingDir = ".") {
  const definitionPath = path.relative(workingDir, directory.definitionPath);
  const posixDefinitionPath = definitionPath.split(path.sep).join(path.posix.sep);
  return `./${posixDefinitionPath}`;
}
export function isComponentDirectory(ctx, directory, isRoot) {
  let isRootWithoutConfig = false;
  if (!ctx.fs.exists(directory)) {
    return {
      kind: "ok",
      component: {
        isRoot,
        path: path.resolve(directory),
        definitionPath: path.resolve(
          path.join(directory, DEFINITION_FILENAME_TS)
        ),
        isRootWithoutConfig: true
      }
    };
  }
  const dirStat = ctx.fs.stat(directory);
  if (!dirStat.isDirectory()) {
    return { kind: "err", why: `Not a directory` };
  }
  let filename = DEFINITION_FILENAME_TS;
  let definitionPath = path.resolve(path.join(directory, filename));
  if (!ctx.fs.exists(definitionPath)) {
    filename = DEFINITION_FILENAME_JS;
    definitionPath = path.resolve(path.join(directory, filename));
  }
  if (!ctx.fs.exists(definitionPath)) {
    isRootWithoutConfig = true;
  } else {
    const definitionStat = ctx.fs.stat(definitionPath);
    if (!definitionStat.isFile()) {
      return {
        kind: "err",
        why: `Component definition ${filename} isn't a file`
      };
    }
  }
  return {
    kind: "ok",
    component: {
      isRoot,
      path: path.resolve(directory),
      definitionPath,
      isRootWithoutConfig
    }
  };
}
export async function buildComponentDirectory(ctx, definitionPath) {
  const convexDir = path.resolve(await getFunctionsDirectoryPath(ctx));
  const isRoot = path.dirname(path.resolve(definitionPath)) === convexDir;
  const isComponent = isComponentDirectory(
    ctx,
    path.dirname(definitionPath),
    isRoot
  );
  if (isComponent.kind === "err") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Invalid component directory (${isComponent.why}): ${path.dirname(definitionPath)}`
    });
  }
  return isComponent.component;
}
export function toComponentDefinitionPath(rootComponent, component) {
  const relativePath = path.relative(
    rootComponent.path,
    component.path
  );
  const definitionPath = relativePath.split(path.sep).join(path.posix.sep);
  return definitionPath;
}
export function toAbsolutePath(rootComponent, componentDefinitionPath) {
  const relativePath = componentDefinitionPath.split(path.posix.sep).join(path.sep);
  return path.normalize(path.join(rootComponent.path, relativePath));
}
//# sourceMappingURL=directoryStructure.js.map
