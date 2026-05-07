import { useEffect, useRef, useState, useCallback } from 'react';

type OmType = 'observation' | 'reflection';

/**
 * Renders absolutely-positioned background highlights behind messages that have
 * been observed by Observational Memory.
 *
 * Purely DOM-driven: finds all `[data-om-badge]` elements in the container,
 * then for each badge measures the region from the previous same-type badge
 * (or the top of the container) down to the bottom of the current badge.
 *
 * Observations span back to the previous badge of any type.
 * Reflections span back to the previous reflection badge (or the beginning).
 *
 * - Only the most recent highlight (regardless of type) is always visible.
 * - Other highlights appear on hover over their badge.
 */
export function BracketOverlay({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [highlights, setHighlights] = useState<HighlightPosition[]>([]);
  const [hoveredCycleId, setHoveredCycleId] = useState<string | null>(null);
  const prevHighlightsRef = useRef<string>('');
  const rafRef = useRef<number>(0);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      if (prevHighlightsRef.current !== '') {
        prevHighlightsRef.current = '';
        setHighlights([]);
      }
      return;
    }

    const containerRect = container.getBoundingClientRect();

    // Find all badge elements in DOM order
    const badges = Array.from(container.querySelectorAll<HTMLElement>('[data-om-badge]'));

    if (badges.length === 0) {
      if (prevHighlightsRef.current !== '') {
        prevHighlightsRef.current = '';
        setHighlights([]);
      }
      return;
    }

    const newHighlights: HighlightPosition[] = [];

    for (let i = 0; i < badges.length; i++) {
      const badge = badges[i];
      const cycleId = badge.getAttribute('data-om-badge') || '';
      const state = (badge.getAttribute('data-om-state') || 'complete') as HighlightPosition['state'];
      const omType = (badge.getAttribute('data-om-type') || 'observation') as OmType;

      const badgeRect = badge.getBoundingClientRect();

      // Find the anchor point (top of the highlight).
      // - Observations: bottom of the previous badge (any type)
      // - Reflections: bottom of the previous reflection badge
      let top: number;
      const anchorBadge = findPreviousBadge(badges, i, omType);
      if (anchorBadge) {
        const anchorMarginBottom = parseFloat(getComputedStyle(anchorBadge).marginBottom) || 0;
        top = anchorBadge.getBoundingClientRect().bottom + anchorMarginBottom - containerRect.top;
      } else {
        top = 0;
      }

      // Bottom: bottom of the current badge + its margin (highlight includes the badge and its spacing)
      const badgeMarginBottom = parseFloat(getComputedStyle(badge).marginBottom) || 0;
      const bottom = badgeRect.bottom + badgeMarginBottom - containerRect.top;
      const height = bottom - top;

      if (height <= 0) continue;

      newHighlights.push({
        cycleId,
        omType,
        state,
        top,
        height,
      });
    }

    // Only update state if highlights actually changed (prevents infinite MutationObserver loops)
    const key = JSON.stringify(newHighlights);
    if (key !== prevHighlightsRef.current) {
      prevHighlightsRef.current = key;
      setHighlights(newHighlights);
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    measure();

    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    });
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    });
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [measure, containerRef]);

  // Listen for hover events on badges
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const badge = (e.target as HTMLElement).closest('[data-om-badge]');
      if (badge) {
        setHoveredCycleId(badge.getAttribute('data-om-badge'));
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const badge = (e.target as HTMLElement).closest('[data-om-badge]');
      if (badge) {
        setHoveredCycleId(null);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
    };
  }, [containerRef]);

  if (highlights.length === 0) return null;

  // Show the latest highlight by default, but hide it when hovering another badge
  const latestCycleId = highlights[highlights.length - 1]?.cycleId ?? null;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
      {highlights.map(highlight => {
        const isLatest = highlight.cycleId === latestCycleId;
        const isHovered = highlight.cycleId === hoveredCycleId;
        // Show only the hovered highlight, or show latest when nothing is hovered
        const isVisible = hoveredCycleId ? isHovered : isLatest;

        return <HighlightBlock key={highlight.cycleId} highlight={highlight} visible={isVisible} />;
      })}
    </div>
  );
}

/**
 * Find the previous badge to anchor the highlight's top edge.
 * - Observations anchor to the previous badge of any type (excluding failed ones).
 * - Reflections anchor to the previous successful reflection badge only (skipping failed reflections).
 */
function findPreviousBadge(badges: HTMLElement[], currentIndex: number, omType: OmType): HTMLElement | null {
  for (let j = currentIndex - 1; j >= 0; j--) {
    const badge = badges[j];
    const badgeState = badge.getAttribute('data-om-state');

    // Skip failed badges - they shouldn't be used as anchors
    if (badgeState === 'failed') {
      continue;
    }

    if (omType === 'observation') {
      // Observations anchor to any previous non-failed badge
      return badge;
    }
    // Reflections anchor only to previous successful reflections
    if (badge.getAttribute('data-om-type') === 'reflection') {
      return badge;
    }
  }
  return null;
}

interface HighlightPosition {
  cycleId: string;
  omType: OmType;
  state:
    | 'loading'
    | 'complete'
    | 'failed'
    | 'disconnected'
    | 'buffering'
    | 'buffering-complete'
    | 'buffering-failed'
    | 'activated';
  /** Top position relative to the container (in px) */
  top: number;
  /** Height of the highlight block (in px) */
  height: number;
}

function HighlightBlock({ highlight, visible }: { highlight: HighlightPosition; visible: boolean }) {
  const color = getStateColor(highlight.state);
  const isBufferingState = highlight.state.startsWith('buffering');

  return (
    <div
      className="absolute left-0 right-0 transition-opacity duration-200"
      style={{
        top: highlight.top,
        height: highlight.height,
        border: `3px ${isBufferingState ? 'dashed' : 'solid'} ${color}`,
        borderRadius: '0.5rem',
        opacity: visible ? 1 : 0,
      }}
    />
  );
}

function getStateColor(state: HighlightPosition['state']): string {
  switch (state) {
    case 'complete':
      return 'rgba(34, 197, 94, 0.4)';
    case 'loading':
      return 'rgba(59, 130, 246, 0.4)';
    case 'failed':
      return 'rgba(239, 68, 68, 0.4)';
    case 'disconnected':
      return 'rgba(234, 179, 8, 0.4)';
    // Buffering states use purple color
    case 'buffering':
      return 'rgba(168, 85, 247, 0.4)';
    case 'buffering-complete':
      return 'rgba(168, 85, 247, 0.4)';
    case 'buffering-failed':
      return 'rgba(239, 68, 68, 0.4)';
    // Activation state uses green — same as sync observation/reflection 'complete'
    case 'activated':
      return 'rgba(34, 197, 94, 0.4)';
    default:
      return 'rgba(34, 197, 94, 0.4)';
  }
}
