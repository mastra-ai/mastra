import type { ReactElement, ReactNode } from 'react';

export interface ModelPickerModel {
  /** Unique within its provider; reported back through `onValueChange` with the provider id. */
  id: string;
  name: string;
  /** Extra search terms. */
  keywords?: string[];
  /** Shown after the name, e.g. a "Default" badge. */
  badge?: ReactNode;
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
