import { z } from 'zod/v4';

export const OBSERVABILITY_TEXT_SEARCH_MAX_LENGTH = 1024;

/**
 * Case-insensitive literal substring search. Omit the field to disable search;
 * empty input is invalid. Whitespace inside the term and punctuation are literal.
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
