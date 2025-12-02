import { Context } from "../../../bundler/context.js";
export declare const DEFAULT_LOCAL_DASHBOARD_PORT = 6790;
export declare const DEFAULT_LOCAL_DASHBOARD_API_PORT = 6791;
/**
 * This runs the `dashboard-self-hosted` app locally.
 * It's currently just used for the `anonymous` flow, while everything else
 * uses `dashboard.convex.dev`, and some of the code below is written
 * assuming this is only used for `anonymous`.
 */
export declare function handleDashboard(ctx: Context, version: string): Promise<{
    dashboardPort: number;
    cleanupHandle: string;
} | undefined>;
export declare function checkIfDashboardIsRunning(ctx: Context): Promise<boolean>;
export declare function dashboardUrl(ctx: Context, deploymentName: string): string | null;
//# sourceMappingURL=dashboard.d.ts.map