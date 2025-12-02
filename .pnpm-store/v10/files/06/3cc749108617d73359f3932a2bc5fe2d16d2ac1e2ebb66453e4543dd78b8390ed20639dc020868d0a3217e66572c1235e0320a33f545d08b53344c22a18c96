import esbuild from "esbuild";
import { Filesystem } from "./fs.js";
import { Context } from "./context.js";
export { nodeFs, RecordingFs } from "./fs.js";
export type { Filesystem } from "./fs.js";
export declare const actionsDir = "actions";
export declare function walkDir(fs: Filesystem, dirPath: string, shouldSkipDir?: (dirPath: string) => boolean, depth?: number): Generator<{
    isDir: boolean;
    path: string;
    depth: number;
}, void, void>;
type ModuleEnvironment = "node" | "isolate";
export interface Bundle {
    path: string;
    source: string;
    sourceMap?: string | undefined;
    environment: ModuleEnvironment;
}
export interface BundleHash {
    path: string;
    hash: string;
    environment: ModuleEnvironment;
}
export declare function bundle(ctx: Context, dir: string, entryPoints: string[], generateSourceMaps: boolean, platform: esbuild.Platform, chunksFolder?: string, externalPackagesAllowList?: string[], extraConditions?: string[]): Promise<{
    modules: Bundle[];
    externalDependencies: Map<string, string>;
    bundledModuleNames: Set<string>;
}>;
export declare function bundleSchema(ctx: Context, dir: string, extraConditions: string[]): Promise<Bundle[]>;
export declare function bundleAuthConfig(ctx: Context, dir: string): Promise<Bundle[]>;
export declare function doesImportConvexHttpRouter(source: string): Promise<boolean>;
export declare function entryPoints(ctx: Context, dir: string): Promise<string[]>;
export declare const useNodeDirectiveRegex: RegExp;
export declare function mustBeIsolate(relPath: string): boolean;
export declare function entryPointsByEnvironment(ctx: Context, dir: string): Promise<{
    isolate: string[];
    node: string[];
}>;
//# sourceMappingURL=index.d.ts.map