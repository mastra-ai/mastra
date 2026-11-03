import type { ReactNode } from 'react';
import type { SavedViewsController } from './use-saved-views';
import { Button } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type SavedViewEditorProps<TSettings> = {
  views: SavedViewsController<TSettings>;
  /** Shown next to the save button of a new view, e.g. where it is saved ("Saved in this browser"). */
  saveCaption?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function SavedViewEditor<TSettings>({
  views,
  saveCaption,
  children,
  className,
}: SavedViewEditorProps<TSettings>) {
  const { draft } = views;
  const creating = draft?.viewId === undefined;
  return (
    <div
      role={draft ? 'group' : undefined}
      aria-label={draft ? `Edit view ${draft.name}` : undefined}
      className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
    >
      {children}
      {draft && (
        <>
          {!creating && views.unsaved && (
            <Txt as="span" variant="caption" tone="muted">
              Unsaved changes
            </Txt>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {creating && saveCaption && (
              <Txt as="span" variant="caption" tone="muted" className="max-sm:hidden">
                {saveCaption}
              </Txt>
            )}
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" disabled={views.pending} onClick={views.discard}>
                {creating ? 'Cancel' : 'Reset'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!views.unsaved || views.pending}
                onClick={views.save}
              >
                {creating ? 'Save view' : 'Save changes'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
