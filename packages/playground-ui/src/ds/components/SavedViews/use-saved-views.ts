import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { parseSavedViews, savedViewNameSchema, serializeSavedViews } from './saved-view-schema';
import type { SavedView, SavedViewSettingsSchema } from './saved-view-schema';
import { readSavedViewsRaw, subscribeSavedViews, writeSavedViewsRaw } from './saved-views-storage';
import type { FilterBarItem } from '@/ds/components/FilterBar/types';

export const NEW_SAVED_VIEW_NAME = 'Untitled view';

export const SAVED_VIEW_SCOPE_LABEL = 'Only you, in this browser';

export type SavedViewContent<TSettings> = {
  filters: FilterBarItem[];
  settings: TSettings;
};

export type SavedViewDraft<TSettings> = SavedViewContent<TSettings> & {
  viewId?: string;
  name: string;
};

export type SavedViewDraftChange<TSettings> = Partial<Omit<SavedViewDraft<TSettings>, 'viewId'>>;

export type UseSavedViewsOptions<TSettings> = {
  storageKey: string;
  // Keep it a module constant: a new schema re-parses every view.
  settingsSchema: SavedViewSettingsSchema<TSettings>;
  activeViewId: string | undefined;
  onActiveViewChange: (viewId: string | undefined) => void;
};

export type SavedViewsController<TSettings> = {
  views: SavedView<TSettings>[];
  activeView: SavedView<TSettings> | undefined;
  draft: SavedViewDraft<TSettings> | undefined;
  applied: SavedViewContent<TSettings> | undefined;
  select: (viewId: string | undefined) => void;
  create: (settings: TSettings, filters?: FilterBarItem[]) => void;
  edit: (viewId: string) => void;
  change: (patch: SavedViewDraftChange<TSettings>) => void;
  save: () => void;
  discard: () => void;
  rename: (viewId: string, name: string) => void;
  duplicate: (viewId: string) => void;
  remove: (viewId: string) => void;
};

function createSavedViewId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function validViewName(name: string): string | undefined {
  const parsed = savedViewNameSchema.safeParse(name);
  return parsed.success ? parsed.data : undefined;
}

export function useSavedViews<TSettings>({
  storageKey,
  settingsSchema,
  activeViewId,
  onActiveViewChange,
}: UseSavedViewsOptions<TSettings>): SavedViewsController<TSettings> {
  const raw = useSyncExternalStore(
    useCallback(listener => subscribeSavedViews(storageKey, listener), [storageKey]),
    () => readSavedViewsRaw(storageKey),
    () => null,
  );
  const views = useMemo(() => parseSavedViews(raw, settingsSchema), [raw, settingsSchema]);
  const [pendingDraft, setDraft] = useState<SavedViewDraft<TSettings>>();
  // A draft of a view the page navigated away from no longer applies.
  const draft = pendingDraft?.viewId === undefined || pendingDraft.viewId === activeViewId ? pendingDraft : undefined;

  const activeView = views.find(view => view.id === activeViewId);
  const write = (next: SavedView<TSettings>[]) => writeSavedViewsRaw(storageKey, serializeSavedViews(next));

  return {
    views,
    activeView,
    draft,
    applied: draft ?? activeView,
    select: viewId => {
      setDraft(undefined);
      onActiveViewChange(viewId);
    },
    create: (settings, filters = []) => setDraft({ name: NEW_SAVED_VIEW_NAME, filters, settings }),
    edit: viewId => {
      const view = views.find(candidate => candidate.id === viewId);
      if (!view) return;
      const { id, ...content } = view;
      setDraft({ ...content, viewId: id });
      if (viewId !== activeViewId) onActiveViewChange(viewId);
    },
    change: patch => {
      if (draft) {
        setDraft({ ...draft, ...patch });
        return;
      }
      if (!activeView) return;
      const { id, ...content } = activeView;
      setDraft({ ...content, ...patch, viewId: id });
    },
    save: () => {
      if (!draft) return;
      const { viewId, ...content } = draft;
      const saved: SavedView<TSettings> = {
        ...content,
        id: viewId ?? createSavedViewId(),
        name: validViewName(content.name) ?? views.find(view => view.id === viewId)?.name ?? NEW_SAVED_VIEW_NAME,
      };
      write(viewId ? views.map(view => (view.id === viewId ? saved : view)) : [...views, saved]);
      setDraft(undefined);
      if (saved.id !== activeViewId) onActiveViewChange(saved.id);
    },
    discard: () => setDraft(undefined),
    rename: (viewId, name) => {
      const nextName = validViewName(name);
      if (!nextName) return;
      write(views.map(view => (view.id === viewId ? { ...view, name: nextName } : view)));
      if (draft?.viewId === viewId) setDraft({ ...draft, name: nextName });
    },
    duplicate: viewId => {
      const index = views.findIndex(view => view.id === viewId);
      const original = views[index];
      if (!original) return;
      const copy: SavedView<TSettings> = {
        ...original,
        id: createSavedViewId(),
        name: validViewName(`${original.name} copy`) ?? original.name,
      };
      write(views.toSpliced(index + 1, 0, copy));
      setDraft(undefined);
      onActiveViewChange(copy.id);
    },
    remove: viewId => {
      write(views.filter(view => view.id !== viewId));
      if (draft?.viewId === viewId) setDraft(undefined);
      if (activeViewId === viewId) onActiveViewChange(undefined);
    },
  };
}
