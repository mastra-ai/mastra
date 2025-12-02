import { Context } from "../../bundler/context.js";
export declare function importIntoDeployment(ctx: Context, filePath: string, options: {
    deploymentUrl: string;
    adminKey: string;
    deploymentNotice: string;
    snapshotImportDashboardLink: string | undefined;
    table?: string;
    format?: "csv" | "jsonLines" | "jsonArray" | "zip";
    replace?: boolean;
    append?: boolean;
    replaceAll?: boolean;
    yes?: boolean;
    component?: string;
}): Promise<undefined>;
type InProgressImportState = {
    state: "in_progress";
    progress_message?: string | undefined;
    checkpoint_messages?: string[] | undefined;
};
type SnapshotImportState = {
    state: "uploaded";
} | {
    state: "waiting_for_confirmation";
    message_to_confirm?: string;
    require_manual_confirmation?: boolean;
} | InProgressImportState | {
    state: "completed";
    num_rows_written: bigint;
} | {
    state: "failed";
    error_message: string;
};
export declare function waitForStableImportState(ctx: Context, args: {
    importId: string;
    deploymentUrl: string;
    adminKey: string;
    onProgress: (ctx: Context, state: InProgressImportState, checkpointCount: number) => number;
}): Promise<SnapshotImportState>;
export declare function confirmImport(ctx: Context, args: {
    importId: string;
    adminKey: string;
    deploymentUrl: string;
    onError: (e: any) => Promise<void>;
}): Promise<undefined>;
export declare function uploadForImport(ctx: Context, args: {
    deploymentUrl: string;
    adminKey: string;
    filePath: string;
    importArgs: {
        tableName?: string | undefined;
        componentPath?: string | undefined;
        mode: string;
        format: string;
    };
    onImportFailed: (e: any) => Promise<void>;
}): Promise<string>;
export {};
//# sourceMappingURL=convexImport.d.ts.map