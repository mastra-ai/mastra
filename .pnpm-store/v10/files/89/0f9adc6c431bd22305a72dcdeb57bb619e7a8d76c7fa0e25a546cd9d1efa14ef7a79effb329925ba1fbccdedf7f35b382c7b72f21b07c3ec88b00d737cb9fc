import { Context } from "../../bundler/context.js";
export declare function exportFromDeployment(ctx: Context, options: {
    deploymentUrl: string;
    adminKey: string;
    path: string;
    includeFileStorage?: boolean;
    deploymentNotice: string;
    snapshotExportDashboardLink: string | undefined;
}): Promise<undefined>;
type SnapshotExportState = {
    state: "requested";
} | {
    state: "in_progress";
} | {
    state: "failed";
} | {
    state: "completed";
    complete_ts: bigint;
    start_ts: bigint;
    zip_object_key: string;
};
export declare function startSnapshotExport(ctx: Context, args: {
    includeStorage: boolean;
    inputPath: string;
    adminKey: string;
    deploymentUrl: string;
}): Promise<SnapshotExportState>;
export declare function downloadSnapshotExport(ctx: Context, args: {
    snapshotExportTs: bigint;
    inputPath: string;
    adminKey: string;
    deploymentUrl: string;
}): Promise<{
    filePath: string;
}>;
export {};
//# sourceMappingURL=convexExport.d.ts.map