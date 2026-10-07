import { Ellipsis, Eye, Pencil, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ComposerAttachmentContext } from './composer-attachment-context';
import { Button } from '@/ds/components/Button/Button';
import { ContextMenu } from '@/ds/components/ContextMenu/context-menu';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/utils/cn';

export interface ComposerAttachmentProps {
  name: string;
  children: ReactNode;
  onRemove: () => void;
  /** Optional application-owned editor, available in the sleeve and context menu. */
  onEdit?: () => void;
  /** Overrides activation of the preview button or link supplied in children. */
  onPreview?: () => void;
  /** Inline entries allow a little more width for long filenames. */
  variant?: 'thumbnail' | 'inline';
}

export function ComposerAttachment({
  name,
  children,
  onRemove,
  onEdit,
  onPreview,
  variant = 'thumbnail',
}: ComposerAttachmentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const actionSelected = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement>();
  const [hasPreview, setHasPreview] = useState(false);

  // Existing adapters own their preview dialogs and links. Activate that same
  // control from the menu instead of duplicating preview state in the wrapper.
  function previewControl() {
    return contentRef.current?.querySelector<HTMLElement>('button:not(:disabled), a[href]');
  }

  function openMenu(anchor?: HTMLElement) {
    actionSelected.current = false;
    setMenuAnchor(anchor);
    setHasPreview(Boolean(onPreview || previewControl()));
    setMenuOpen(true);
  }

  function runMenuAction(action: () => void) {
    // Preview/edit may open a dialog; the closing menu must not steal its focus.
    actionSelected.current = true;
    setMenuOpen(false);
    action();
  }

  function openPreview() {
    if (onPreview) {
      onPreview();
      return;
    }
    previewControl()?.click();
  }

  function returnFocus() {
    if (actionSelected.current) return false;
    return menuAnchor ?? previewControl() ?? triggerRef.current;
  }

  return (
    <ContextMenu
      open={menuOpen}
      onOpenChange={open => {
        if (open) openMenu();
        else setMenuOpen(false);
      }}
    >
      <ContextMenu.Trigger
        ref={triggerRef}
        data-slot="composer-attachment"
        title={name}
        className={cn(
          raisedSurfaceStyle,
          'group/attachment relative h-17 shrink-0 rounded-(--attachment-radius) [--attachment-radius:var(--radius-xl)] [--attachment-thumbnail-size:--spacing(15)]',
          // Concentric corners: the inner radius is the outer radius minus its inset.
          '[--attachment-action-inset:--spacing(1)] [--attachment-action-radius:max(0px,calc(var(--attachment-radius)-var(--attachment-action-inset)))] [--attachment-action-width:--spacing(9)] [--attachment-sleeve-width:calc(var(--attachment-action-width)+2*var(--attachment-action-inset))]',
          variant === 'inline' ? 'w-72' : 'w-66',
        )}
        onClickCapture={event => {
          // Releasing a long press must not also activate the underlying file.
          if (menuOpen && !actionSelected.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyDown={event => {
          // Portalled preview dialogs also bubble through this React ancestor.
          if (!(event.target instanceof HTMLElement) || !event.currentTarget.contains(event.target)) return;
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            openMenu(event.target);
          }
        }}
      >
        <div
          ref={contentRef}
          data-slot="composer-attachment-cover"
          className={cn(
            raisedSurfaceStyle,
            surfaceStateLayerStyle,
            'absolute inset-0 z-10 flex min-w-0 items-center overflow-hidden rounded-[inherit]',
            'motion-safe:transition-[right,border-radius] motion-safe:duration-normal motion-safe:ease-out-custom',
            'group-focus-within/attachment:right-(--attachment-sleeve-width) group-data-popup-open/attachment:right-(--attachment-sleeve-width) group-[:hover]/attachment:right-(--attachment-sleeve-width)',
            // Tighten the facing edge so two large curves do not widen the visible gutter.
            'group-focus-within/attachment:rounded-r-(--attachment-action-inset) group-data-popup-open/attachment:rounded-r-(--attachment-action-inset) group-[:hover]/attachment:rounded-r-(--attachment-action-inset)',
            'max-sm:rounded-r-[inherit]! pointer-coarse:rounded-r-[inherit]!',
            'max-sm:right-0! max-sm:pr-[calc(--spacing(11)+2*var(--attachment-action-inset))]',
            'pointer-coarse:right-0! pointer-coarse:pr-[calc(--spacing(11)+2*var(--attachment-action-inset))]',
          )}
        >
          <ComposerAttachmentContext.Provider value={name}>{children}</ComposerAttachmentContext.Provider>
        </div>
        <div
          data-slot="composer-attachment-actions"
          className={cn(
            'absolute inset-y-(--attachment-action-inset) right-(--attachment-action-inset) flex w-(--attachment-action-width) flex-col gap-(--attachment-action-inset)',
            'translate-x-2 opacity-0 motion-safe:transition-[translate,opacity] motion-safe:duration-normal motion-safe:ease-out-custom',
            'group-[:hover]/attachment:translate-x-0 group-[:hover]/attachment:opacity-100',
            'group-focus-within/attachment:translate-x-0 group-focus-within/attachment:opacity-100',
            'group-data-popup-open/attachment:translate-x-0 group-data-popup-open/attachment:opacity-100',
            'max-sm:hidden pointer-coarse:hidden',
          )}
        >
          <Button
            type="button"
            variant="destructive-ghost"
            size="icon-sm"
            className="h-auto w-full flex-1 rounded-(--attachment-action-radius)"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
            title={`Remove ${name}`}
          >
            <X />
          </Button>
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-auto w-full flex-1 rounded-(--attachment-action-radius)"
              onClick={onEdit}
              aria-label={`Edit ${name}`}
              title={`Edit ${name}`}
            >
              <Pencil />
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute inset-y-(--attachment-action-inset) right-(--attachment-action-inset) z-20 hidden h-auto w-11 rounded-(--attachment-action-radius) max-sm:flex pointer-coarse:flex"
          aria-label={`Actions for ${name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={event => openMenu(event.currentTarget)}
        >
          <Ellipsis />
        </Button>
      </ContextMenu.Trigger>
      <ContextMenu.Content anchor={menuAnchor} collisionPadding={8} finalFocus={returnFocus}>
        {hasPreview && (
          <ContextMenu.Item className="min-h-11" onSelect={() => runMenuAction(openPreview)}>
            <Eye />
            <span>Preview</span>
          </ContextMenu.Item>
        )}
        {onEdit && (
          <ContextMenu.Item className="min-h-11" onSelect={() => runMenuAction(onEdit)}>
            <Pencil />
            <span>Edit</span>
          </ContextMenu.Item>
        )}
        {(hasPreview || onEdit) && <ContextMenu.Separator />}
        <ContextMenu.Item className="min-h-11" variant="destructive" onSelect={() => runMenuAction(onRemove)}>
          <X />
          <span>Remove</span>
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  );
}
