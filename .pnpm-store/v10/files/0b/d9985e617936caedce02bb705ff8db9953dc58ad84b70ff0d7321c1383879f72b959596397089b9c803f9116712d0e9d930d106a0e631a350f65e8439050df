import { Context } from "../../../bundler/context.js";
export type LocalDeploymentKind = "local" | "anonymous";
export declare function rootDeploymentStateDir(kind: LocalDeploymentKind): string;
export declare function deploymentStateDir(deploymentKind: LocalDeploymentKind, deploymentName: string): string;
export type LocalDeploymentConfig = {
    ports: {
        cloud: number;
        site: number;
    };
    backendVersion: string;
    adminKey: string;
    instanceSecret?: string;
};
export declare function loadDeploymentConfig(ctx: Context, deploymentKind: LocalDeploymentKind, deploymentName: string): LocalDeploymentConfig | null;
export declare function saveDeploymentConfig(ctx: Context, deploymentKind: LocalDeploymentKind, deploymentName: string, config: LocalDeploymentConfig): void;
export declare function binariesDir(): string;
export declare function dashboardZip(): string;
export declare function versionedBinaryDir(version: string): string;
export declare function executablePath(version: string): string;
export declare function executableName(): string;
export declare function dashboardDir(): string;
export declare function resetDashboardDir(ctx: Context): Promise<void>;
export declare function dashboardOutDir(): string;
export type DashboardConfig = {
    port: number;
    apiPort: number;
    version: string;
};
export declare function loadDashboardConfig(ctx: Context): any;
export declare function saveDashboardConfig(ctx: Context, config: DashboardConfig): void;
export declare function loadUuidForAnonymousUser(ctx: Context): any;
export declare function ensureUuidForAnonymousUser(ctx: Context): any;
//# sourceMappingURL=filePaths.d.ts.map