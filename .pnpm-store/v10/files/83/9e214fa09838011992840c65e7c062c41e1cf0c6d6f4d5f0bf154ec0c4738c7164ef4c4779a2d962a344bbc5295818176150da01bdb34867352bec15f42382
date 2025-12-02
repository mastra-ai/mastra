import fs from 'node:fs/promises';
import { i as internalFixDefaultCJSExports } from './utils-DwzdDEfz.js';
import 'magic-string';
import 'mlly';

function transformDtsDefaultCJSExports(code, fileName, options = {}) {
  return internalFixDefaultCJSExports(code, {
    fileName,
    // we don't need the imports (used only for exporting types optimization)
    imports: []
  }, options);
}
async function fixDtsFileDefaultCJSExports(dtsPath, options = {}) {
  const result = transformDtsDefaultCJSExports(
    await fs.readFile(dtsPath, "utf-8"),
    dtsPath,
    options
  );
  if (result) {
    await fs.writeFile(dtsPath, result, "utf8");
  }
  return !!result;
}
async function transformESMDtsToCJSDts(dtsPath, dtsDestPath, options = {}) {
  if (dtsPath === dtsDestPath) {
    throw new Error(`dtsPath and dtsDestPath should be different: ${dtsPath}`);
  }
  const code = await fs.readFile(dtsPath, "utf-8");
  const result = transformDtsDefaultCJSExports(
    code,
    dtsPath,
    options
  ) ?? code;
  const { transformLocalImports = defaultLocalImportsTransformer } = options;
  await fs.writeFile(
    dtsDestPath,
    transformLocalImports(result, dtsPath, dtsDestPath),
    "utf8"
  );
}
function defaultLocalImportsTransformer(code, dtsPath, dtsDestPath) {
  const from = dtsPath.endsWith(".d.mts") ? /\s+(from\s+["'].\.?\/.*(\.mjs)["'];?)\s+/g : /\s+(from\s+["'].\.?\/.*(\.js)["'];?)\s+/g;
  let matcher = from.exec(code);
  if (!matcher) {
    return code;
  }
  const extension = dtsDestPath.endsWith("d.ts") ? ".js" : ".cjs";
  while (matcher) {
    code = code.replaceAll(matcher[1], matcher[1].replace(matcher[2], extension));
    matcher = from.exec(code);
  }
  return code;
}

export { defaultLocalImportsTransformer, fixDtsFileDefaultCJSExports, transformDtsDefaultCJSExports, transformESMDtsToCJSDts };
