/**
 * A saved view: a named copy of an observability list page's URL state.
 *
 * `savedViewStateSchema` validates the whole state (used by the page that applies it).
 * `savedViewStateEnvelopeSchema` checks only what storage needs (version, page, size), so a page
 * can add state without a server deploy.
 */
import { z } from 'zod/v4';
import { filterNodeSchema } from './filter-node';

export const SAVED_VIEW_SCHEMA_VERSION = 1;
export const SAVED_VIEW_PAGES = ['traces', 'spans', 'threads', 'logs'] as const;
/** Max size of a saved view's state, as UTF-8 JSON. */
export const SAVED_VIEW_STATE_MAX_BYTES = 16 * 1024;

export type SavedViewPage = (typeof SAVED_VIEW_PAGES)[number];

const savedViewPageSchema = z.enum(SAVED_VIEW_PAGES);
const timestamp = z.string().datetime({ offset: true });

const utf8Bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const withinSizeLimit = (value: unknown) => utf8Bytes(value) <= SAVED_VIEW_STATE_MAX_BYTES;
const sizeLimitMessage = `Saved view state must be at most ${SAVED_VIEW_STATE_MAX_BYTES} bytes as JSON`;

export const savedViewDateRangeSchema = z.union([
  z.object({ preset: z.string().min(1) }).strict(),
  z
    .object({
      from: timestamp,
      /** Omitted: the range is open-ended and runs to "now". */
      to: timestamp.optional(),
    })
    .strict()
    .refine(({ from, to }) => to === undefined || Date.parse(from) <= Date.parse(to), {
      message: '`from` must not be after `to`',
      path: ['to'],
    }),
]);

export const savedViewSortSchema = z.object({
  field: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
});

export const savedViewColumnSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
});

export const savedViewStateSchema = z
  .object({
    schemaVersion: z.literal(SAVED_VIEW_SCHEMA_VERSION),
    page: savedViewPageSchema,
    filters: z.array(filterNodeSchema),
    dateRange: savedViewDateRangeSchema.optional(),
    sort: savedViewSortSchema.optional(),
    /** In display order. */
    columns: z
      .array(savedViewColumnSchema)
      .refine(columns => new Set(columns.map(column => column.id)).size === columns.length, {
        message: 'Column ids must be unique',
      })
      .optional(),
    /** Per-page extras, e.g. the traces `listMode`. */
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(withinSizeLimit, { message: sizeLimitMessage });

export type SavedViewState = z.infer<typeof savedViewStateSchema>;
export type SavedViewDateRange = z.infer<typeof savedViewDateRangeSchema>;
export type SavedViewSort = z.infer<typeof savedViewSortSchema>;
export type SavedViewColumn = z.infer<typeof savedViewColumnSchema>;

/** What a store checks before saving: a known version and page, within the size limit. */
export const savedViewStateEnvelopeSchema = z
  .looseObject({
    schemaVersion: z.literal(SAVED_VIEW_SCHEMA_VERSION),
    page: savedViewPageSchema,
  })
  .refine(withinSizeLimit, { message: sizeLimitMessage });

export type SavedViewStateEnvelope = z.infer<typeof savedViewStateEnvelopeSchema>;
