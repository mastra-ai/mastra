import type { Plugin } from "esbuild";
import { Context } from "./context.js";
export type ExternalPackage = {
    path: string;
};
export declare function createExternalPlugin(ctx: Context, externalPackages: Map<string, ExternalPackage>): {
    plugin: Plugin;
    externalModuleNames: Set<string>;
    bundledModuleNames: Set<string>;
};
export declare function computeExternalPackages(ctx: Context, externalPackagesAllowList: string[]): Promise<Map<string, ExternalPackage>>;
export declare function shouldMarkExternal(packageName: string, packageJsonVersion: string, externalPackagesAllowList: string[]): boolean;
export declare function findExactVersionAndDependencies(ctx: Context, moduleName: string, modulePath: string): Promise<{
    version: string;
    peerAndOptionalDependencies: Set<string>;
}>;
//# sourceMappingURL=external.d.ts.map