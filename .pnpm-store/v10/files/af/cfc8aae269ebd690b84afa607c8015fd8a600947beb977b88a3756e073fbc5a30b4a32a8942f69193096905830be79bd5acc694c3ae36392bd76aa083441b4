"use strict";
import path from "path";
export async function handleDebugBundlePath(ctx, debugBundleDir, config) {
  if (!ctx.fs.exists(debugBundleDir)) {
    ctx.fs.mkdir(debugBundleDir);
  } else if (!ctx.fs.stat(debugBundleDir).isDirectory()) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Path \`${debugBundleDir}\` is not a directory. Please choose an empty directory for \`--debug-bundle-path\`.`
    });
  } else if (ctx.fs.listDir(debugBundleDir).length !== 0) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Directory \`${debugBundleDir}\` is not empty. Please remove it or choose an empty directory for \`--debug-bundle-path\`.`
    });
  }
  ctx.fs.writeUtf8File(
    path.join(debugBundleDir, "fullConfig.json"),
    JSON.stringify(config)
  );
  for (const moduleInfo of config.modules) {
    const trimmedPath = moduleInfo.path.endsWith(".js") ? moduleInfo.path.slice(0, moduleInfo.path.length - ".js".length) : moduleInfo.path;
    const environmentDir = path.join(debugBundleDir, moduleInfo.environment);
    ctx.fs.mkdir(path.dirname(path.join(environmentDir, `${trimmedPath}.js`)), {
      allowExisting: true,
      recursive: true
    });
    ctx.fs.writeUtf8File(
      path.join(environmentDir, `${trimmedPath}.js`),
      moduleInfo.source
    );
    if (moduleInfo.sourceMap !== void 0) {
      ctx.fs.writeUtf8File(
        path.join(environmentDir, `${trimmedPath}.js.map`),
        moduleInfo.sourceMap
      );
    }
  }
}
//# sourceMappingURL=debugBundlePath.js.map
