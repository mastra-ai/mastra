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
  /** `false` marks the provider as missing credentials. */
  connected?: boolean;
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
