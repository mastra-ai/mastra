import type { UserConfig } from 'tsdown';

export interface LibConfig extends UserConfig {
  /** Packages whose declarations `generateTypes` copies into this package instead of importing them. */
  bundledTypes?: string[];
}

export function defineLibConfig(config: LibConfig): UserConfig;
