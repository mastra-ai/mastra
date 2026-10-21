import type { ReactNode } from 'react';
import { SavedViewActions } from './saved-view-actions';
import type { SavedViewsController } from './use-saved-views';
import { cn } from '@/lib/utils';

export type SavedViewEditorProps<TState> = {
  views: SavedViewsController<TState>;
  /** The page's own controls, e.g. its `FilterBar`. Editing them while a view is active makes unsaved changes. */
  children?: ReactNode;
  className?: string;
};

/** The page's controls followed by `SavedViewActions`, on one row. */
export function SavedViewEditor<TState>({ views, children, className }: SavedViewEditorProps<TState>) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {children}
      <SavedViewActions views={views} className="ml-auto" />
    </div>
  );
}
