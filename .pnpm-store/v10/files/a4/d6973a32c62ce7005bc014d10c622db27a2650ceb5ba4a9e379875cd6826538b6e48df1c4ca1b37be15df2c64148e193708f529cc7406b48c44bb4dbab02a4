import { TempDir } from "../../bundler/fs.js";
import { Context } from "../../bundler/context.js";
import { TypeCheckMode } from "./typecheck.js";
import { ComponentDirectory } from "./components/definition/directoryStructure.js";
import { StartPushResponse } from "./deployApi/startPush.js";
import { LargeIndexDeletionCheck } from "./indexes.js";
export type CodegenOptions = {
    url?: string | undefined;
    adminKey?: string | undefined;
    dryRun: boolean;
    debug: boolean;
    typecheck: TypeCheckMode;
    init: boolean;
    commonjs: boolean;
    liveComponentSources: boolean;
    debugNodeApis: boolean;
    systemUdfs: boolean;
    largeIndexDeletionCheck: LargeIndexDeletionCheck;
    codegenOnlyThisComponent?: string | undefined;
};
export declare function doCodegenForNewProject(ctx: Context): Promise<undefined>;
export declare function doInitCodegen(ctx: Context, functionsDir: string, skipIfExists: boolean, opts?: {
    dryRun?: boolean;
    debug?: boolean;
}): Promise<void>;
/** Codegen only for an application (a root component) */
export declare function doCodegen(ctx: Context, functionsDir: string, typeCheckMode: TypeCheckMode, opts?: {
    dryRun?: boolean;
    generateCommonJSApi?: boolean;
    debug?: boolean;
}): Promise<void>;
export declare function doInitialComponentCodegen(ctx: Context, tmpDir: TempDir, componentDirectory: ComponentDirectory, opts?: {
    dryRun?: boolean;
    generateCommonJSApi?: boolean;
    debug?: boolean;
    verbose?: boolean;
}): Promise<void>;
export declare function isPublishedPackage(componentDirectory: ComponentDirectory): boolean;
export declare function doFinalComponentCodegen(ctx: Context, tmpDir: TempDir, rootComponent: ComponentDirectory, componentDirectory: ComponentDirectory, startPushResponse: StartPushResponse, componentsMap: Map<string, ComponentDirectory>, opts?: {
    dryRun?: boolean;
    debug?: boolean;
    generateCommonJSApi?: boolean;
}): Promise<void>;
//# sourceMappingURL=codegen.d.ts.map