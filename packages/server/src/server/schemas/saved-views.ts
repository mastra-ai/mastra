import { z } from 'zod/v4';
import { paginationInfoSchema } from './common';

/** Maximum size of a saved view's `state` JSON. */
export const MAX_SAVED_VIEW_STATE_BYTES = 64 * 1024;
export const MAX_SAVED_VIEW_NAME_CHARS = 80;
const MAX_SAVED_VIEW_PAGE_CHARS = 64;

const textEncoder = new TextEncoder();

/**
 * What a view restores. The UI owns the full shape, so the server only checks
 * that it is a JSON object with an integer `version`, under the size cap.
 * Unknown keys are kept as-is.
 */
const savedViewStateSchema = z
  .object({ version: z.number().int() })
  .catchall(z.unknown())
  .refine(value => textEncoder.encode(JSON.stringify(value)).length <= MAX_SAVED_VIEW_STATE_BYTES, {
    message: `Must be at most ${MAX_SAVED_VIEW_STATE_BYTES / 1024} KB of JSON`,
  });

const savedViewNameSchema = z.string().trim().min(1).max(MAX_SAVED_VIEW_NAME_CHARS);
const savedViewPageSchema = z.string().trim().min(1).max(MAX_SAVED_VIEW_PAGE_CHARS);

export const savedViewIdPathParams = z.object({
  savedViewId: z.string().describe('Unique identifier for the saved view'),
});

export const listSavedViewsQuerySchema = z.object({
  page: savedViewPageSchema.optional().describe('Only return views for this Studio page, for example `traces`'),
});

export const createSavedViewBodySchema = z.object({
  page: savedViewPageSchema.describe('Studio page the view belongs to, for example `traces`'),
  name: savedViewNameSchema,
  state: savedViewStateSchema.describe(
    'What the view restores, such as filters, time range, sort and columns. Must include an integer `version`.',
  ),
});

export const updateSavedViewBodySchema = z.object({
  name: savedViewNameSchema.optional(),
  state: savedViewStateSchema.optional(),
});

export const savedViewResponseSchema = z.object({
  id: z.string(),
  page: z.string(),
  name: z.string(),
  authorId: z.string().nullable().describe('Who created the view. `null` when the server runs without auth.'),
  state: z.object({ version: z.number() }).catchall(z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const listSavedViewsResponseSchema = z.object({
  views: z.array(savedViewResponseSchema),
  pagination: paginationInfoSchema,
});
