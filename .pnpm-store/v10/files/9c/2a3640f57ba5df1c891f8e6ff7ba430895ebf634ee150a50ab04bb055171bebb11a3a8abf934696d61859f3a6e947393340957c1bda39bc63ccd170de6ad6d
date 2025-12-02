import esbuild, { BuildFailure, LogLevel, Plugin } from "esbuild";
import { Context } from "./context.js";
export declare function innerEsbuild({ entryPoints, platform, dir, extraConditions, generateSourceMaps, plugins, chunksFolder, logLevel, }: {
    entryPoints: string[];
    platform: esbuild.Platform;
    dir: string;
    extraConditions: string[];
    generateSourceMaps: boolean;
    plugins: Plugin[];
    chunksFolder: string;
    logLevel?: LogLevel;
}): Promise<esbuild.BuildResult<{
    entryPoints: string[];
    bundle: true;
    platform: esbuild.Platform;
    format: "esm";
    target: string;
    jsx: "automatic";
    outdir: string;
    outbase: string;
    conditions: string[];
    plugins: esbuild.Plugin[];
    write: false;
    sourcemap: boolean;
    splitting: true;
    chunkNames: string;
    treeShaking: true;
    minifySyntax: true;
    minifyIdentifiers: true;
    minifyWhitespace: false;
    keepNames: true;
    define: {
        "process.env.NODE_ENV": string;
    };
    metafile: true;
    logLevel: esbuild.LogLevel;
}>>;
export declare function isEsbuildBuildError(e: any): e is BuildFailure;
/**
 * Bundle non-"use node" entry points one at a time to track down the first file with an error
 * is being imported.
 */
export declare function debugIsolateBundlesSerially(ctx: Context, { entryPoints, extraConditions, dir, }: {
    entryPoints: string[];
    extraConditions: string[];
    dir: string;
}): Promise<void>;
//# sourceMappingURL=debugBundle.d.ts.map