import { CheckIcon, LockIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SavedViewsController } from './use-saved-views';
import { Button } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type SavedViewEditorProps<TSettings> = {
  views: SavedViewsController<TSettings>;
  children: ReactNode;
  className?: string;
};

export function SavedViewEditor<TSettings>({ views, children, className }: SavedViewEditorProps<TSettings>) {
  const { draft } = views;
  if (!draft) return null;
  return (
    <div
      role="group"
      aria-label={`Edit view ${draft.name}`}
      className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
    >
      {children}
      <Txt
        as="span"
        variant="caption"
        tone="muted"
        className="ml-auto flex shrink-0 items-center gap-1 max-sm:hidden [&_svg]:size-3"
      >
        <LockIcon aria-hidden />
        Only you, in this browser
      </Txt>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" tooltip="Cancel" onClick={views.discard}>
          <XIcon />
        </Button>
        <Button type="button" variant="primary" size="icon-sm" tooltip="Save view" onClick={views.save}>
          <CheckIcon />
        </Button>
      </div>
    </div>
  );
}
