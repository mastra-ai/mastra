import type {
  DataOmObservationStartPart,
  DataOmObservationEndPart,
  DataOmObservationFailedPart,
  DataOmBufferingStartPart,
  DataOmBufferingEndPart,
  DataOmBufferingFailedPart,
  DataOmActivationPart,
} from '@mastra/memory/processors';

/**
 * Frontend OM (observational memory) types.
 *
 * The part shapes are owned by `@mastra/memory` (single source of truth) and
 * imported above. This file only composes the frontend-specific unions and
 * augmentations on top of them, so the union types stay out of function
 * signatures and are easy to maintain in one place.
 */

/**
 * Synthetic fields added to a part's `data` by `markOmMarkersAsDisconnected`
 * on stream interruption. They are not part of the backend types, so they are
 * modelled here as an optional augmentation.
 */
export type OmAugmentation = { disconnectedAt?: string; _state?: string };

export type AugmentData<T extends { data: unknown }> = Omit<T, 'data'> & { data: T['data'] & OmAugmentation };

/**
 * The OM cycle parts collected per cycleId. Each slot holds the canonical
 * `@mastra/memory` part shape (augmented with the synthetic fields) for that
 * marker.
 */
export type OmCycleParts = {
  start?: AugmentData<DataOmObservationStartPart>;
  end?: AugmentData<DataOmObservationEndPart>;
  failed?: AugmentData<DataOmObservationFailedPart>;
  bufferingStart?: AugmentData<DataOmBufferingStartPart>;
  bufferingEnd?: AugmentData<DataOmBufferingEndPart>;
  bufferingFailed?: AugmentData<DataOmBufferingFailedPart>;
  activation?: AugmentData<DataOmActivationPart>;
};

export type OmCycleStatus =
  | 'observing'
  | 'observed'
  | 'buffering'
  | 'buffering-complete'
  | 'activated'
  | 'failed'
  | 'buffering-failed'
  | 'disconnected';

export type OmCycleViewModel = {
  cycleId: string;
  recordId?: string;
  status: OmCycleStatus;
  operationType?: unknown;
  observations?: unknown;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  omData: Record<string, unknown>;
  isLoading: boolean;
};

export type OmIndexablePart =
  | OmCycleParts['start']
  | OmCycleParts['end']
  | OmCycleParts['failed']
  | OmCycleParts['bufferingStart']
  | OmCycleParts['bufferingEnd']
  | OmCycleParts['bufferingFailed']
  | OmCycleParts['activation'];
