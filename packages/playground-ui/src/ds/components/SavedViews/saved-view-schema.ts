import { z } from 'zod/v4';
import type { FilterBarItem } from '@/ds/components/FilterBar/types';

export const MAX_SAVED_VIEW_NAME_CHARS = 80;

export const SAVED_VIEWS_STORAGE_VERSION = 1;

const filterBarScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

export const savedViewFilterSchema = z.object({
  id: z.string().min(1),
  fieldId: z.string().min(1),
  operatorId: z.string().min(1),
  value: z.union([filterBarScalarSchema, z.array(filterBarScalarSchema)]),
}) satisfies z.ZodType<FilterBarItem>;

export const savedViewNameSchema = z.string().trim().min(1).max(MAX_SAVED_VIEW_NAME_CHARS);

export const storedSavedViewSchema = z.object({
  id: z.string().min(1),
  name: savedViewNameSchema,
  filters: z.array(savedViewFilterSchema),
  settings: z.unknown(),
});

// Views stay `unknown` so one malformed view is dropped on its own, not the whole list.
export const savedViewsDocumentSchema = z.object({
  version: z.literal(SAVED_VIEWS_STORAGE_VERSION),
  views: z.array(z.unknown()),
});

// Only `safeParse` is used, so the consumer's Zod version never has to match this package's.
export type SavedViewSettingsSchema<TSettings> = {
  safeParse: (value: unknown) => { success: true; data: TSettings } | { success: false };
};

export type SavedView<TSettings> = {
  id: string;
  name: string;
  filters: FilterBarItem[];
  settings: TSettings;
};

export function parseSavedViews<TSettings>(
  raw: string | null,
  settingsSchema: SavedViewSettingsSchema<TSettings>,
): SavedView<TSettings>[] {
  if (!raw) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  const document = savedViewsDocumentSchema.safeParse(json);
  if (!document.success) return [];
  return document.data.views.flatMap(candidate => {
    const view = storedSavedViewSchema.safeParse(candidate);
    if (!view.success) return [];
    const settings = settingsSchema.safeParse(view.data.settings);
    if (!settings.success) return [];
    return [{ ...view.data, settings: settings.data }];
  });
}

export function serializeSavedViews<TSettings>(views: readonly SavedView<TSettings>[]): string {
  return JSON.stringify({ version: SAVED_VIEWS_STORAGE_VERSION, views });
}
