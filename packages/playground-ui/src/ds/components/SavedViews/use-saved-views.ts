import { useState, useSyncExternalStore } from 'react';
import { parseSavedViews, savedViewNameSchema, serializeSavedViews } from './saved-view-schema';
import type { SavedView, SavedViewSettingsSchema } from './saved-view-schema';
import { readSavedViewsRaw, savedViewsSubscriber, writeSavedViewsRaw } from './saved-views-storage';
import type { FilterBarItem } from '@/ds/components/FilterBar/types';

const NEW_SAVED_VIEW_NAME = 'Untitled view';

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
  settingsSchema: SavedViewSettingsSchema<TSettings>;
  activeViewId: string | undefined;
  onActiveViewChange: (viewId: string | undefined) => void;
};

export type SavedViewsController<TSettings> = {
  views: SavedView<TSettings>[];
  activeView: SavedView<TSettings> | undefined;
  draft: SavedViewDraft<TSettings> | undefined;
  unsaved: boolean;
  storageError: string | undefined;
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

function sameViewContent<TSettings>(draft: SavedViewDraft<TSettings>, view: SavedView<TSettings>): boolean {
  return (
    JSON.stringify([draft.name, draft.filters, draft.settings]) ===
    JSON.stringify([view.name, view.filters, view.settings])
  );
}

export function useSavedViews<TSettings>({
  storageKey,
  settingsSchema,
  activeViewId,
  onActiveViewChange,
}: UseSavedViewsOptions<TSettings>): SavedViewsController<TSettings> {
  const raw = useSyncExternalStore(
    savedViewsSubscriber(storageKey),
    () => readSavedViewsRaw(storageKey),
    () => null,
  );
  const views = parseSavedViews(raw, settingsSchema);
  const [failedStorageKey, setFailedStorageKey] = useState<string>();
  const [pendingDraft, setDraft] = useState<SavedViewDraft<TSettings>>();
  const [draftScope, setDraftScope] = useState({ storageKey, activeViewId });
  const draftView = views.find(view => view.id === pendingDraft?.viewId);
  const draftViewDeleted = pendingDraft?.viewId !== undefined && !draftView;
  const storageKeyChanged = draftScope.storageKey !== storageKey;
  if (storageKeyChanged || draftScope.activeViewId !== activeViewId || draftViewDeleted) {
    setDraftScope({ storageKey, activeViewId });
    if (storageKeyChanged || draftViewDeleted || pendingDraft?.viewId !== activeViewId) setDraft(undefined);
  }
  const draft = pendingDraft?.viewId === undefined || pendingDraft.viewId === activeViewId ? pendingDraft : undefined;
  const unsaved = draft !== undefined && (!draftView || !sameViewContent(draft, draftView));

  const activeView = views.find(view => view.id === activeViewId);
  const write = (next: SavedView<TSettings>[]) => {
    const saved = writeSavedViewsRaw(storageKey, serializeSavedViews(next));
    setFailedStorageKey(saved ? undefined : storageKey);
    return saved;
  };

  return {
    views,
    activeView,
    draft,
    unsaved,
    storageError:
      failedStorageKey === storageKey
        ? 'Could not save changes. Check your browser storage settings and try again.'
        : undefined,
    applied: draft ?? activeView,
    select: viewId => {
      setFailedStorageKey(undefined);
      setDraft(undefined);
      onActiveViewChange(viewId);
    },
    create: (settings, filters = []) => setDraft({ name: NEW_SAVED_VIEW_NAME, filters, settings }),
    edit: viewId => {
      if (draft?.viewId === viewId) return;
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
      if (!write(viewId ? views.map(view => (view.id === viewId ? saved : view)) : [...views, saved])) return;
      setDraft(undefined);
      if (saved.id !== activeViewId) onActiveViewChange(saved.id);
    },
    discard: () => {
      setFailedStorageKey(undefined);
      setDraft(undefined);
    },
    rename: (viewId, name) => {
      const nextName = validViewName(name);
      if (!nextName) return;
      if (!write(views.map(view => (view.id === viewId ? { ...view, name: nextName } : view)))) return;
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
      if (!write(views.toSpliced(index + 1, 0, copy))) return;
      setDraft(undefined);
      onActiveViewChange(copy.id);
    },
    remove: viewId => {
      if (!write(views.filter(view => view.id !== viewId))) return;
      if (draft?.viewId === viewId) setDraft(undefined);
      if (activeViewId === viewId) onActiveViewChange(undefined);
    },
  };
}
