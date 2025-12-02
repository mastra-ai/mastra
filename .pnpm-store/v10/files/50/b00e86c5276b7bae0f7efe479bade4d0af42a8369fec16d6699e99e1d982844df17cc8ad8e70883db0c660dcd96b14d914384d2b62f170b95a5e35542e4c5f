"use strict";
import { logOutput } from "../../bundler/log.js";
import path from "path";
export function recursivelyDelete(ctx, deletePath, opts) {
  const dryRun = !!opts?.dryRun;
  let st;
  try {
    st = ctx.fs.stat(deletePath);
  } catch (err) {
    if (err.code === "ENOENT" && opts?.force) {
      return;
    }
    throw err;
  }
  if (st.isDirectory()) {
    for (const entry of ctx.fs.listDir(deletePath)) {
      recursivelyDelete(ctx, path.join(deletePath, entry.name), opts);
    }
    if (dryRun) {
      logOutput(`Command would delete directory: ${deletePath}`);
      return;
    }
    try {
      ctx.fs.rmdir(deletePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  } else {
    if (dryRun) {
      logOutput(`Command would delete file: ${deletePath}`);
      return;
    }
    try {
      ctx.fs.unlink(deletePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
}
export async function recursivelyCopy(ctx, nodeFs, src, dest) {
  const st = nodeFs.stat(src);
  if (st.isDirectory()) {
    nodeFs.mkdir(dest, { recursive: true });
    for (const entry of nodeFs.listDir(src)) {
      await recursivelyCopy(
        ctx,
        nodeFs,
        path.join(src, entry.name),
        path.join(dest, entry.name)
      );
    }
  } else {
    await nodeFs.writeFileStream(dest, nodeFs.createReadStream(src, {}));
  }
}
//# sourceMappingURL=fsUtils.js.map
