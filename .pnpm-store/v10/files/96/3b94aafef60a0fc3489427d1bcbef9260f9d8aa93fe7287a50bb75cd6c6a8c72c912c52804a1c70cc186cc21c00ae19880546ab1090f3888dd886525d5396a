// NB: Bolt check uses a different dependnecy set to every other package.
// You need think before you use this.
const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

export type VersionType = "major" | "minor" | "patch" | "none";

export type DependencyType = typeof DEPENDENCY_TYPES[number];

export type AccessType = "public" | "restricted";

export type Release = { name: string; type: VersionType };

// This is a release that has been modified to include all relevant information
// about releasing - it is calculated and doesn't make sense as an artefact
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
  dependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  optionalDependencies?: { [key: string]: string };
  resolutions?: { [key: string]: string };
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

export type Config = {
  changelog: false | readonly [string, any];
  commit: boolean;
  fixed: Fixed;
  linked: Linked;
  access: AccessType;
  baseBranch: string;
  /** The minimum bump type to trigger automatic update of internal dependencies that are part of the same release */
  updateInternalDependencies: "patch" | "minor";
  ignore: ReadonlyArray<string>;
  /** This is supposed to be used with pnpm's `link-workspace-packages: false` and Berry's `enableTransparentWorkspaces: false` */
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: Required<
    ExperimentalOptions
  >;
};

export type WrittenConfig = {
  changelog?: false | readonly [string, any] | string;
  commit?: boolean;
  fixed?: Fixed;
  linked?: Linked;
  access?: AccessType;
  baseBranch?: string;
  /** The minimum bump type to trigger automatic update of internal dependencies that are part of the same release */
  updateInternalDependencies?: "patch" | "minor";
  ignore?: ReadonlyArray<string>;
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH?: ExperimentalOptions;
};

export type ExperimentalOptions = {
  onlyUpdatePeerDependentsWhenOutOfRange?: boolean;
  updateInternalDependents?: "always" | "out-of-range";
  useCalculatedVersionForSnapshots?: boolean;
};

export type NewChangesetWithCommit = NewChangeset & { commit?: string };

export type ModCompWithPackage = ComprehensiveRelease & {
  packageJson: PackageJSON;
  dir: string;
};

export type GetReleaseLine = (
  changeset: NewChangesetWithCommit,
  type: VersionType,
  changelogOpts: null | Record<string, any>
) => Promise<string>;

export type GetDependencyReleaseLine = (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithPackage[],
  changelogOpts: any
) => Promise<string>;

export type ChangelogFunctions = {
  getReleaseLine: GetReleaseLine;
  getDependencyReleaseLine: GetDependencyReleaseLine;
};

export type PreState = {
  mode: "pre" | "exit";
  tag: string;
  initialVersions: {
    [pkgName: string]: string;
  };
  changesets: string[];
};
