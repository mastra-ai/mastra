import { z } from 'zod/v4';

export const OBSERVABILITY_TEXT_SEARCH_MAX_LENGTH = 256;

/**
 * Normalized text search input. Omit the field to disable search; empty input is invalid.
 * Matching and tokenization depend on the supporting storage adapter.
 * Length is measured in Unicode code points after case normalization.
 */
export const observabilityTextSearchSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(value => Array.from(value).length >= 3, 'Text search requires at least 3 characters')
  .refine(
    value => Array.from(value).length <= OBSERVABILITY_TEXT_SEARCH_MAX_LENGTH,
    `Text search must contain at most ${OBSERVABILITY_TEXT_SEARCH_MAX_LENGTH} characters`,
  );
