import path from "path";
import esbuild, { BuildFailure, LogLevel, Plugin } from "esbuild";
import { Context } from "./context.js";
import {
  logError,
  changeSpinner,
  logFailure,
  logVerbose,
  logMessage,
} from "./log.js";
import { wasmPlugin } from "./wasm.js";
import dependencyTrackerPlugin from "./depgraph.js";

export async function innerEsbuild({
  entryPoints,
  platform,
  dir,
  extraConditions,
  generateSourceMaps,
  plugins,
  chunksFolder,
  logLevel,
}: {
  entryPoints: string[];
  platform: esbuild.Platform;
  dir: string;
  extraConditions: string[];
  generateSourceMaps: boolean;
  plugins: Plugin[];
  chunksFolder: string;
  logLevel?: LogLevel;
}) {
  const result = await esbuild.build({
    entryPoints,
    bundle: true,
    platform: platform,
    format: "esm",
    target: "esnext",
    jsx: "automatic",
    outdir: "out",
    outbase: dir,
    conditions: ["convex", "module", ...extraConditions],
    plugins,
    write: false,
    sourcemap: generateSourceMaps,
    splitting: true,
    chunkNames: path.join(chunksFolder, "[hash]"),
    treeShaking: true,
    minifySyntax: true,
    minifyIdentifiers: true,
    // Enabling minifyWhitespace breaks sourcemaps on convex backends.
    // The sourcemaps produced are valid on https://evanw.github.io/source-map-visualization
    // but something we're doing (perhaps involving https://github.com/getsentry/rust-sourcemap)
    // makes everything map to the same line.
    minifyWhitespace: false, // false is the default, just showing for clarify.
    keepNames: true,
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    metafile: true,
    logLevel: logLevel || "warning",
  });
  return result;
}

export function isEsbuildBuildError(e: any): e is BuildFailure {
  return (
    "errors" in e &&
    "warnings" in e &&
    Array.isArray(e.errors) &&
    Array.isArray(e.warnings)
  );
}

/**
 * Bundle non-"use node" entry points one at a time to track down the first file with an error
 * is being imported.
 */
export async function debugIsolateBundlesSerially(
  ctx: Context,
  {
    entryPoints,
    extraConditions,
    dir,
  }: {
    entryPoints: string[];
    extraConditions: string[];
    dir: string;
  },
): Promise<void> {
  logMessage(
    `Bundling convex entry points one at a time to track down things that can't be bundled for the Convex JS runtime.`,
  );
  let i = 1;
  for (const entryPoint of entryPoints) {
    changeSpinner(
      `bundling entry point ${entryPoint} (${i++}/${entryPoints.length})...`,
    );

    const { plugin, tracer } = dependencyTrackerPlugin();
    try {
      await innerEsbuild({
        entryPoints: [entryPoint],
        platform: "browser",
        generateSourceMaps: true,
        chunksFolder: "_deps",
        extraConditions,
        dir,
        plugins: [plugin, wasmPlugin],
        logLevel: "silent",
      });
    } catch (error) {
      if (!isEsbuildBuildError(error) || !error.errors[0]) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: null,
        });
      }

      const buildError = error.errors[0];
      const errorFile = buildError.location?.file;
      if (!errorFile) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: null,
        });
      }

      const importedPath = buildError.text.match(/"([^"]+)"/)?.[1];
      if (!importedPath) continue;

      const full = path.resolve(errorFile);
      logError("");
      logError(
        `Bundling ${entryPoint} resulted in ${error.errors.length} esbuild errors.`,
      );
      logError(`One of the bundling errors occurred while bundling ${full}:\n`);
      logError(
        esbuild
          .formatMessagesSync([buildError], {
            kind: "error",
            color: true,
          })
          .join("\n"),
      );
      logError("It would help to avoid importing this file.");
      const chains = tracer.traceImportChains(entryPoint, full);
      const chain: string[] = chains[0];
      chain.reverse();

      logError(``);
      if (chain.length > 0) {
        const problematicFileRelative = formatFilePath(dir, chain[0]);

        if (chain.length === 1) {
          logError(`  ${problematicFileRelative}`);
        } else {
          logError(`  ${problematicFileRelative} is imported by`);

          for (let i = 1; i < chain.length - 1; i++) {
            const fileRelative = formatFilePath(dir, chain[i]);
            logError(`  ${fileRelative}, which is imported by`);
          }

          const entryPointFile = chain[chain.length - 1];
          const entryPointRelative = formatFilePath(dir, entryPointFile);

          logError(`  ${entryPointRelative}, which doesn't use "use node"\n`);
          logError(
            `  For registered action functions to use Node.js APIs in any code they run they must be defined\n` +
              `  in a file with 'use node' at the top. See https://docs.convex.dev/functions/runtimes#nodejs-runtime\n`,
          );
        }
      }

      logFailure("Bundling failed");
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: "Bundling failed.",
      });
    }
    logVerbose(`${entryPoint} bundled`);
  }
}

// Helper function to format file paths consistently
function formatFilePath(baseDir: string, filePath: string): string {
  // If it's already a relative path like "./shared", just return it
  if (!path.isAbsolute(filePath)) {
    // For relative paths, ensure they start with "convex/"
    if (!filePath.startsWith("convex/")) {
      // If it's a path like "./subdir/file.ts" or "subdir/file.ts"
      const cleanPath = filePath.replace(/^\.\//, "");
      return `convex/${cleanPath}`;
    }
    return filePath;
  }

  // Get the path relative to the base directory
  const relativePath = path.relative(baseDir, filePath);

  // Remove any leading "./" that path.relative might add
  const cleanPath = relativePath.replace(/^\.\//, "");

  // Check if this is a path within the convex directory
  const isConvexPath =
    cleanPath.startsWith("convex/") ||
    cleanPath.includes("/convex/") ||
    path.dirname(cleanPath) === "convex";

  if (isConvexPath) {
    // If it already starts with convex/, return it as is
    if (cleanPath.startsWith("convex/")) {
      return cleanPath;
    }

    // For files in the convex directory
    if (path.dirname(cleanPath) === "convex") {
      const filename = path.basename(cleanPath);
      return `convex/${filename}`;
    }

    // For files in subdirectories of convex
    const convexIndex = cleanPath.indexOf("convex/");
    if (convexIndex >= 0) {
      return cleanPath.substring(convexIndex);
    }
  }

  // For any other path, assume it's in the convex directory
  // This handles cases where the file is in a subdirectory of convex
  // but the path doesn't include "convex/" explicitly
  return `convex/${cleanPath}`;
}
