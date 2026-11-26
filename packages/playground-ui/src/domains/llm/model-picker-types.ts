import type { ReactElement } from 'react';

export interface ModelPickerModel {
  /** Unique within its provider. Shown formatted by `formatModelName`, e.g. `claude-opus-4-6` reads "Claude Opus 4.6". */
  id: string;
  /** Lists newest first; models without a date follow, by id. */
  releaseDate?: string;
}

export interface ModelPickerProvider {
  id: string;
  name: string;
  /** `false` marks the provider as missing credentials: a red dot and "Not connected". */
  connected?: boolean;
  /**
   * Whether it gets its own filter pill. Defaults to `connected !== false`. Set `false` to tuck a usable provider
   * behind "+N" (e.g. the vendors one gateway serves), without marking it as missing credentials.
   */
  featured?: boolean;
  models: ModelPickerModel[];
}

export interface ModelPickerValue {
  provider: string;
  model: string;
}

export interface ModelPickerAddProvider {
  label: string;
  render: ReactElement;
}
