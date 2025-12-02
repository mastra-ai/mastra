import { Context } from "../../../bundler/context.js";
export declare function ensureBackendBinaryDownloaded(ctx: Context, version: {
    kind: "latest";
    allowedVersion?: string | undefined;
} | {
    kind: "version";
    version: string;
}): Promise<{
    binaryPath: string;
    version: string;
}>;
/**
 * Finds the latest version of the convex backend that has a binary that works
 * on this platform.
 */
export declare function findLatestVersionWithBinary<RequireSuccess extends boolean>(ctx: Context, requireSuccess: RequireSuccess): Promise<RequireSuccess extends true ? string : string | null>;
export declare function ensureDashboardDownloaded(ctx: Context, version: string): Promise<void>;
//# sourceMappingURL=download.d.ts.map