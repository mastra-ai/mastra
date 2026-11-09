import type { ReactElement } from 'react';

export interface ModelPickerModel {
  /** Unique within its provider; reported back through `onValueChange` with the provider id. */
  id: string;
  /** Defaults to the id formatted by `formatModelName`, e.g. `claude-opus-4-6` reads "Claude Opus 4.6". */
  name?: string;
  /** Lists newest first; models without a date follow, by id. */
  releaseDate?: string;
  /** Extra search terms. The id, name and provider name always match. */
  keywords?: string[];
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
