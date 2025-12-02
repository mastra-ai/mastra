import type { PackageJson } from "pkg-types";
export type WorkspacesRoot = {
    location: string;
    globs: string[];
};
export type Workspace = {
    location: string;
    package: PackageJson & {
        name: string;
    };
};
type Cache = {
    root: Map<string, WorkspacesRoot | null>;
    workspaces: Map<string, Workspace[]>;
    clear: () => void;
};
export declare function createWorkspacesCache(): Cache;
type Options = {
    stopDir?: string;
    cache?: Cache;
};
export declare function findWorkspacesRoot(dirname?: string, options?: Options): WorkspacesRoot | null;
export declare function findWorkspaces(dirname?: string, options?: Options): Workspace[] | null;
export {};
