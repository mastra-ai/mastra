import type { Package } from '@manypkg/get-packages';

export type BumpType = 'major' | 'minor' | 'patch';

export type VersionBumps = Record<string, BumpType>;

export interface ChangedPackage {
  name: string;
  path: string;
  version: string;
}

export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface UpdatedPeerDependencies {
  directUpdatedPackages: string[];
  indirectUpdatedPackages: string[];
}

export interface PreSelectedPackages {
  major: string[];
  minor: string[];
  patch: string[];
}

export interface PromptResults {
  packages?: string[];
  major?: string[];
  minor?: string[];
  patch?: string[];
}

export interface BumpSelections {
  packages: string[];
  major: string[];
  minor: string[];
  patch: string[];
}

export interface CliArgs {
  message: string;
  skipPrompt: boolean;
  major: string[];
  minor: string[];
  patch: string[];
}

export interface PublicPackage extends Package {
  packageJson: PackageJson;
}
