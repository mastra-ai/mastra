import type { SavedViewsController } from './use-saved-views';
import { Button } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type SavedViewActionsProps<TState> = {
  views: SavedViewsController<TState>;
  className?: string;
};

/** "Reset changes" and "Save to this view", shown only while the active view has unsaved changes. */
export function SavedViewActions<TState>({ views, className }: SavedViewActionsProps<TState>) {
  if (!views.unsaved) return null;
  return (
    <div className={cn('flex shrink-0 items-center gap-3', className)}>
      <Txt as="span" variant="caption" tone="muted">
        Unsaved changes
      </Txt>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" disabled={views.pending} onClick={views.reset}>
          Reset changes
        </Button>
        <Button type="button" variant="primary" size="sm" disabled={views.pending} onClick={() => views.save()}>
          Save to this view
        </Button>
      </div>
    </div>
  );
}
