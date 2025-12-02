import { Context } from "../../bundler/context.js";
import { logOutput } from "../../bundler/log.js";
import path from "path";
import { NodeFs } from "../../bundler/fs.js";

export function recursivelyDelete(
  ctx: Context,
  deletePath: string,
  opts?: { force?: boolean; dryRun?: boolean },
) {
  const dryRun = !!opts?.dryRun;
  let st;
  try {
    st = ctx.fs.stat(deletePath);
  } catch (err: any) {
    if (err.code === "ENOENT" && opts?.force) {
      return;
    }
    // eslint-disable-next-line no-restricted-syntax
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
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        // eslint-disable-next-line no-restricted-syntax
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
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        // eslint-disable-next-line no-restricted-syntax
        throw err;
      }
    }
  }
}

export async function recursivelyCopy(
  ctx: Context,
  nodeFs: NodeFs,
  src: string,
  dest: string,
) {
  const st = nodeFs.stat(src);
  if (st.isDirectory()) {
    nodeFs.mkdir(dest, { recursive: true });
    for (const entry of nodeFs.listDir(src)) {
      await recursivelyCopy(
        ctx,
        nodeFs,
        path.join(src, entry.name),
        path.join(dest, entry.name),
      );
    }
  } else {
    // Don't use writeUtf8File to allow copying arbitrary files
    await nodeFs.writeFileStream(dest, nodeFs.createReadStream(src, {}));
  }
}
