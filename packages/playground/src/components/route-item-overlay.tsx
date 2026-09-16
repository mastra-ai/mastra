import { cn } from '@mastra/playground-ui/utils/cn';

export type RouteItemOverlayProps = {
  /** Accessible label for the floating dialog. */
  label: string;
  /**
   * Widens the panel column (e.g. when a detail split is shown inside),
   * mirroring the `sidePanelWidth="wide"` behavior of `TracesLayout` on the traces page.
   */
  wide?: boolean;
  children: React.ReactNode;
};

/**
 * Floating side panel for `items/:itemId` child routes. The overlay spans its
 * closest positioned ancestor; full-height pages leave that anchor to the Studio
 * frame. It stays click-through except for the panel, so the list beneath remains
 * interactive. The panel is transparent — the cards carry the visible frames.
 *
 * Same layout pattern as `TracesLayout`: a 2-column CSS grid whose column
 * template animates between normal and wide.
 */
export function RouteItemOverlay({ label, wide = false, children }: RouteItemOverlayProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-50',
        'grid transition-[grid-template-columns] duration-300 ease-in-out',
        wide ? 'grid-cols-[1fr_4fr]' : 'grid-cols-[1fr_1fr]',
      )}
    >
      {/* Click-through spacer (left column). */}
      <div className="pointer-events-none" />
      <div
        role="dialog"
        data-item-panel
        aria-label={label}
        className="pointer-events-auto h-full min-h-0 min-w-0 overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}
