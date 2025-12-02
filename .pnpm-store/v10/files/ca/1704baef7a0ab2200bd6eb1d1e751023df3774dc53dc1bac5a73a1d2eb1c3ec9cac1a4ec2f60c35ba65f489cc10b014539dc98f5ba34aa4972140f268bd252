import { PackageJSON } from "@changesets/types";
export declare type Tool = "yarn" | "bolt" | "pnpm" | "lerna" | "root";
export declare type Package = {
    packageJson: PackageJSON;
    dir: string;
};
export declare type Packages = {
    tool: Tool;
    packages: Package[];
    root: Package;
};
export declare class PackageJsonMissingNameError extends Error {
    directories: string[];
    constructor(directories: string[]);
}
export declare function getPackages(dir: string): Promise<Packages>;
export declare function getPackagesSync(dir: string): Packages;
