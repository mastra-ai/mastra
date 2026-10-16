import type { RefObject } from 'react';
import type { TargetType } from './target-selector';

export interface ExperimentTriggerInitialValues {
  initialDatasetId?: string;
  initialDatasetVersion?: number;
  initialScorerIds?: string[];
  initialTargetType?: TargetType;
  initialTargetId?: string;
  initialName?: string;
  initialDescription?: string;
}

export type TargetOption = { value: string; label: string; type: TargetType; id: string };
export type ScorerOption = { value: string; label: string; description?: string };
export type DatasetOption = { value: string; label: string };

/** The dialog's popup, so the fields' lists open inside it. */
export type FieldPopupContainer = RefObject<HTMLDivElement | null>;

export const toTargetValue = (type: TargetType, id: string) => `${type}:${id}`;

/** Combobox `isItemEqualToValue`: Base UI passes `null` for an empty value. */
export const sameValue = <T extends { value: string }>(a: T | null, b: T | null) => a?.value === b?.value;
