declare const DEPENDENCY_TYPES: readonly ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
export type VersionType = "major" | "minor" | "patch" | "none";
export type DependencyType = typeof DEPENDENCY_TYPES[number];
export type AccessType = "public" | "restricted";
export type Release = {
    name: string;
    type: VersionType;
};
export type ComprehensiveRelease = {
    name: string;
    type: VersionType;
    oldVersion: string;
    newVersion: string;
    changesets: string[];
};
export type Changeset = {
    summary: string;
    releases: Array<Release>;
};
export type NewChangeset = Changeset & {
    id: string;
};
export type ReleasePlan = {
    changesets: NewChangeset[];
    releases: ComprehensiveRelease[];
    preState: PreState | undefined;
};
export type PackageJSON = {
    name: string;
    version: string;
    dependencies?: {
        [key: string]: string;
    };
    peerDependencies?: {
        [key: string]: string;
    };
    devDependencies?: {
        [key: string]: string;
    };
    optionalDependencies?: {
        [key: string]: string;
    };
    resolutions?: {
        [key: string]: string;
    };
    private?: boolean;
    publishConfig?: {
        access?: AccessType;
        directory?: string;
        registry?: string;
    };
};
export type PackageGroup = ReadonlyArray<string>;
export type Fixed = ReadonlyArray<PackageGroup>;
export type Linked = ReadonlyArray<PackageGroup>;
export interface PrivatePackages {
    version: boolean;
    tag: boolean;
}
export type Config = {
    changelog: false | readonly [string, any];
    commit: false | readonly [string, any];
    fixed: Fixed;
    linked: Linked;
    access: AccessType;
    baseBranch: string;
    changedFilePatterns: readonly string[];
    /** When false, Changesets won't format with Prettier */
    prettier: boolean;
    /** Features enabled for Private packages */
    privatePackages: PrivatePackages;
    /** The minimum bump type to trigger automatic update of internal dependencies that are part of the same release */
    updateInternalDependencies: "patch" | "minor";
    ignore: ReadonlyArray<string>;
    /** This is supposed to be used with pnpm's `link-workspace-packages: false` and Berry's `enableTransparentWorkspaces: false` */
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
    ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: Omit<Required<ExperimentalOptions>, "useCalculatedVersionForSnapshots">;
    snapshot: {
        useCalculatedVersion: boolean;
        prereleaseTemplate: string | null;
    };
};
export type WrittenConfig = {
    changelog?: false | readonly [string, any] | string;
    commit?: boolean | readonly [string, any] | string;
    fixed?: Fixed;
    linked?: Linked;
    access?: AccessType;
    baseBranch?: string;
    changedFilePatterns?: readonly string[];
    prettier?: boolean;
    /** Opt in to tracking non-npm / private packages */
    privatePackages?: false | {
        version?: boolean;
        tag?: boolean;
    };
    /** The minimum bump type to trigger automatic update of internal dependencies that are part of the same release */
    updateInternalDependencies?: "patch" | "minor";
    ignore?: ReadonlyArray<string>;
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
    snapshot?: {
        useCalculatedVersion?: boolean;
        prereleaseTemplate?: string;
    };
    ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH?: ExperimentalOptions;
};
export type ExperimentalOptions = {
    onlyUpdatePeerDependentsWhenOutOfRange?: boolean;
    updateInternalDependents?: "always" | "out-of-range";
    /** @deprecated Since snapshot feature is now stable, you should migrate to use "snapshot.useCalculatedVersion". */
    useCalculatedVersionForSnapshots?: boolean;
};
export type NewChangesetWithCommit = NewChangeset & {
    commit?: string;
};
export type ModCompWithPackage = ComprehensiveRelease & {
    packageJson: PackageJSON;
    dir: string;
};
export type GetReleaseLine = (changeset: NewChangesetWithCommit, type: VersionType, changelogOpts: null | Record<string, any>) => Promise<string>;
export type GetDependencyReleaseLine = (changesets: NewChangesetWithCommit[], dependenciesUpdated: ModCompWithPackage[], changelogOpts: any) => Promise<string>;
export type ChangelogFunctions = {
    getReleaseLine: GetReleaseLine;
    getDependencyReleaseLine: GetDependencyReleaseLine;
};
export type GetAddMessage = (changeset: Changeset, commitOptions: any) => Promise<string>;
export type GetVersionMessage = (releasePlan: ReleasePlan, commitOptions: any) => Promise<string>;
export type CommitFunctions = {
    getAddMessage?: GetAddMessage;
    getVersionMessage?: GetVersionMessage;
};
export type PreState = {
    mode: "pre" | "exit";
    tag: string;
    initialVersions: {
        [pkgName: string]: string;
    };
    changesets: string[];
};
export {};
